import type { D1Database } from '@cloudflare/workers-types'
import type { SessionUser } from '../../middleware/auth'
import { SupportTicketRepository } from '../../repositories/SupportTicketRepository'
import { SupportAgentRepository } from '../../repositories/SupportAgentRepository'
import { SUPPORT_AI_TOOL_DEFS, SupportAiTools } from './SupportAiTools'
import { hasEmailBinding, sendSupportTicketEmail, type SendEmailBinding } from '../../lib/email'

const AI_MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
] as const
const MAX_TOOL_ROUNDS = 5

const SYSTEM_PROMPT = `Você é a nano IA de suporte do SISCR, um ERP SaaS brasileiro (vendas, financeiro, estoque, NF-e, frota).
Responda em português, de forma curta e prática.
SEMPRE use as ferramentas antes de falar de cadastros, pedidos, notas ou financeiro. Nunca invente números, nomes, pedidos ou notas.
- Perguntas sobre cobrança, inadimplência ou “como está o financeiro” → resumo_financeiro.
- Busca por nome/e-mail/CPF/CNPJ em cadastros → buscar_pessoa.
Se não souber, se o usuário pedir um humano, ou se o caso exigir o time SISCR (bug, certificado A1, SEFAZ fora), chame criar_ticket.
Não execute alterações no ERP — só leitura e abertura de chamado.
Quando criar um ticket, confirme ao usuário que um atendente vai assumir.`

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string }

type AiToolCall = {
  name?: string
  arguments?: Record<string, unknown> | string
  function?: { name: string; arguments?: Record<string, unknown> | string }
}

type AiRunResult = {
  response?: string
  result?: { response?: string; tool_calls?: AiToolCall[] }
  tool_calls?: AiToolCall[]
  choices?: Array<{ message?: { content?: string; tool_calls?: AiToolCall[] } }>
}

export class SupportAiService {
  constructor(
    private readonly tickets: SupportTicketRepository,
    private readonly db: D1Database,
  ) {}

  async getOrCreateSession(user: SessionUser) {
    const existing = await this.tickets.findOpenSessionForUser(user.tenantId, user.userId)
    if (existing) {
      const messages = await this.tickets.listMessagesBySession(existing.id)
      return { session: existing, messages }
    }
    const now = new Date().toISOString()
    const session = {
      id: crypto.randomUUID(),
      tenant_id: user.tenantId,
      user_id: user.userId,
      ticket_id: null,
      created_at: now,
      updated_at: now,
    }
    await this.tickets.createSession(session)
    await this.tickets.insertMessage({
      id: crypto.randomUUID(),
      ticket_id: null,
      session_id: session.id,
      author_type: 'ai',
      author_id: 'ai',
      author_nome: 'Assistente SISCR',
      body: 'Olá! Sou a assistente do SISCR. Posso consultar seus cadastros, pedidos, notas e financeiro. Se precisar, encaminho para um humano.',
      created_at: now,
    })
    const messages = await this.tickets.listMessagesBySession(session.id)
    return { session, messages }
  }

  async chat(
    user: SessionUser,
    sessionId: string,
    userMessage: string,
    env: {
      AI?: Ai
      DB_SHARED: D1Database
      EMAIL?: SendEmailBinding
      EMAIL_FROM?: string
      SUPPORT_DESK_URL?: string
    },
  ) {
    const session = await this.tickets.findSession(sessionId)
    if (!session || session.tenant_id !== user.tenantId || session.user_id !== user.userId) {
      return { error: 'Sessão não encontrada.', status: 404 as const }
    }

    const now = new Date().toISOString()
    await this.tickets.insertMessage({
      id: crypto.randomUUID(),
      ticket_id: session.ticket_id,
      session_id: session.id,
      author_type: 'client',
      author_id: user.userId,
      author_nome: user.nome,
      body: userMessage,
      created_at: now,
    })

    if (session.ticket_id) {
      await this.tickets.updateTicket(session.ticket_id, { status: 'waiting_agent' })
      const messages = await this.tickets.listMessagesBySession(session.id)
      return { reply: null, ticketId: session.ticket_id, messages, handedOff: true }
    }

    const history = await this.tickets.listMessagesBySession(session.id)
    const tools = new SupportAiTools(this.db, user.tenantId)
    const { reply, ticketCreated, subject } = await this.runModel(history, tools, env.AI)

    let ticketId: string | null = session.ticket_id
    if (ticketCreated) {
      const created = await this.escalate(user, session.id, subject || userMessage.slice(0, 80), env)
      ticketId = created.ticketId
    }

    await this.tickets.insertMessage({
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      session_id: session.id,
      author_type: 'ai',
      author_id: 'ai',
      author_nome: 'Assistente SISCR',
      body: reply,
      created_at: new Date().toISOString(),
    })

    const messages = await this.tickets.listMessagesBySession(session.id)
    return { reply, ticketId, messages, handedOff: Boolean(ticketId) }
  }

  async escalate(
    user: SessionUser,
    sessionId: string,
    subject: string,
    env: {
      EMAIL?: SendEmailBinding
      EMAIL_FROM?: string
      SUPPORT_DESK_URL?: string
    },
  ) {
    const session = await this.tickets.findSession(sessionId)
    if (!session || session.tenant_id !== user.tenantId || session.user_id !== user.userId) {
      return { error: 'Sessão não encontrada.', status: 404 as const, ticketId: null as string | null }
    }
    if (session.ticket_id) {
      return { ticketId: session.ticket_id }
    }

    const tenant = await this.db
      .prepare(`SELECT id, slug, nome FROM tenants WHERE id = ?`)
      .bind(user.tenantId)
      .first<{ id: string; slug: string; nome: string }>()

    const now = new Date().toISOString()
    const ticketId = crypto.randomUUID()
    await this.tickets.createTicket({
      id: ticketId,
      tenant_id: user.tenantId,
      tenant_slug: tenant?.slug ?? user.tenantSlug,
      tenant_nome: tenant?.nome ?? user.tenantSlug,
      created_by_user_id: user.userId,
      created_by_nome: user.nome,
      created_by_email: user.email,
      assigned_agent_id: null,
      kind: 'support',
      source: 'ai',
      status: 'open',
      priority: 'normal',
      subject: subject.trim().slice(0, 160) || 'Ajuda no SISCR',
      parent_ticket_id: null,
      ai_session_id: sessionId,
      created_at: now,
      updated_at: now,
    })
    await this.tickets.attachSessionToTicket(sessionId, ticketId)
    await this.tickets.attachSessionMessagesToTicket(sessionId, ticketId)
    await this.tickets.insertMessage({
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      session_id: sessionId,
      author_type: 'system',
      author_id: 'ai',
      author_nome: 'Sistema',
      body: 'Chamado aberto. Um atendente SISCR vai entrar nesta conversa.',
      created_at: now,
    })

    try {
      const agents = new SupportAgentRepository(this.db)
      const emails = await agents.listActiveEmails()
      if (hasEmailBinding(env) && emails.length > 0) {
        await sendSupportTicketEmail(
          env,
          emails.map((e) => e.email),
          {
            subject: subject.trim().slice(0, 160) || 'Ajuda no SISCR',
            ticketId,
            tenantNome: tenant?.nome ?? user.tenantSlug,
            tenantSlug: tenant?.slug ?? user.tenantSlug,
            userNome: user.nome,
            userEmail: user.email,
          },
        )
      }
    } catch (err) {
      console.error('[support.escalate] e-mail:', err)
    }

    return { ticketId }
  }

  async addClientTicketMessage(user: SessionUser, ticketId: string, body: string) {
    const ticket = await this.tickets.findTicket(ticketId)
    if (!ticket || ticket.tenant_id !== user.tenantId || ticket.created_by_user_id !== user.userId) {
      return { error: 'Ticket não encontrado.', status: 404 as const }
    }
    const message = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      session_id: ticket.ai_session_id,
      author_type: 'client' as const,
      author_id: user.userId,
      author_nome: user.nome,
      body,
      created_at: new Date().toISOString(),
    }
    await this.tickets.insertMessage(message)
    await this.tickets.updateTicket(ticketId, { status: 'waiting_agent' })
    return { message }
  }

  async getSession(user: SessionUser, sessionId: string) {
    const session = await this.tickets.findSession(sessionId)
    if (!session || session.tenant_id !== user.tenantId || session.user_id !== user.userId) return null
    const messages = await this.tickets.listMessagesBySession(sessionId)
    return { session, messages }
  }

  async listUserTickets(user: SessionUser) {
    return this.tickets.listTicketsForUser(user.tenantId, user.userId)
  }

  async getUserTicket(user: SessionUser, ticketId: string) {
    const ticket = await this.tickets.findTicket(ticketId)
    if (!ticket || ticket.tenant_id !== user.tenantId || ticket.created_by_user_id !== user.userId) return null
    const messages = await this.tickets.listMessagesByTicket(ticketId)
    return { ticket, messages }
  }

  private async runModel(
    history: Array<{ author_type: string; body: string }>,
    tools: SupportAiTools,
    ai: Ai | undefined,
  ): Promise<{ reply: string; ticketCreated: boolean; subject?: string }> {
    if (!ai) {
      return this.fallbackReply(history, tools)
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-20).map((m) => ({
        role: (m.author_type === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.body,
      })),
    ]

    let ticketCreated = false
    let subject: string | undefined
    let lastText = ''
    let model: string = AI_MODELS[0]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let raw: AiRunResult | null = null
      for (const candidate of round === 0 ? AI_MODELS : [model]) {
        try {
          raw = (await (ai.run as (model: string, input: unknown) => Promise<AiRunResult>)(candidate, {
            messages,
            tools: SUPPORT_AI_TOOL_DEFS,
            max_tokens: 700,
          })) as AiRunResult
          model = candidate
          break
        } catch (err) {
          console.error('[support.ai] run', candidate, err)
        }
      }
      if (!raw) {
        return this.fallbackReply(history, tools)
      }

      const calls = normalizeToolCalls(raw)
      if (calls.length === 0) {
        lastText = extractText(raw)
        break
      }

      messages.push({
        role: 'assistant',
        content: JSON.stringify(calls),
      })

      for (const call of calls) {
        if (call.name === 'criar_ticket') {
          ticketCreated = true
          subject = typeof call.args.subject === 'string' ? call.args.subject : undefined
          messages.push({
            role: 'tool',
            name: 'criar_ticket',
            content: JSON.stringify({ ok: true, message: 'Ticket será aberto agora.' }),
          })
          continue
        }
        const result = await tools.execute(call.name, call.args)
        messages.push({
          role: 'tool',
          name: call.name,
          content: JSON.stringify(result),
        })
      }
    }

    if (ticketCreated && !lastText) {
      lastText =
        'Abri um chamado para o time SISCR com o histórico desta conversa. Um atendente entra aqui em seguida.'
    }
    if (!lastText) {
      return this.fallbackReply(history, tools)
    }
    return { reply: lastText, ticketCreated, subject }
  }

  private async fallbackReply(
    history: Array<{ author_type: string; body: string }>,
    tools: SupportAiTools,
  ): Promise<{
    reply: string
    ticketCreated: boolean
    subject?: string
  }> {
    const last = [...history].reverse().find((m) => m.author_type === 'client')?.body ?? ''
    const lower = last.toLowerCase()
    const wantsHuman = /falar com (humano|atendente)|quero (um )?atendente|abrir (um )?(chamado|ticket)/.test(lower)
    if (wantsHuman) {
      return {
        reply: 'Vou abrir um chamado para o time SISCR. Um atendente assume esta conversa.',
        ticketCreated: true,
        subject: last.slice(0, 80) || 'Ajuda no SISCR',
      }
    }

    if (/financeiro|cobrar|inadimpl|vencid|a receber|contas? a receber/.test(lower)) {
      const result = await tools.execute('resumo_financeiro', {})
      return { reply: formatToolFallback('financeiro', result), ticketCreated: false }
    }

    if (/cadastro|cliente|fornecedor|funcion[aá]rio|pessoa|cpf|cnpj/.test(lower)) {
      const q = inferSearchQuery(last)
      if (q) {
        const result = await tools.execute('buscar_pessoa', { q })
        return { reply: formatToolFallback(`cadastro "${q}"`, result), ticketCreated: false }
      }
    }

    return {
      reply:
        'Posso consultar cadastros, pedidos, notas e o financeiro desta empresa. Diga o nome, número ou o que precisa cobrar. Se preferir um humano, diga “falar com atendente”.',
      ticketCreated: false,
    }
  }
}

function extractText(raw: AiRunResult): string {
  const fromChoices = raw.choices?.[0]?.message?.content
  const text = raw.response ?? raw.result?.response ?? (typeof fromChoices === 'string' ? fromChoices : '')
  return (text ?? '').trim()
}

function normalizeToolCalls(raw: AiRunResult): Array<{ name: string; args: Record<string, unknown> }> {
  const calls = [
    ...(raw.tool_calls ?? []),
    ...(raw.result?.tool_calls ?? []),
    ...(raw.choices?.[0]?.message?.tool_calls ?? []),
  ]
  const out: Array<{ name: string; args: Record<string, unknown> }> = []
  for (const call of calls) {
    const name = call.name ?? call.function?.name
    if (!name) continue
    const rawArgs = call.arguments ?? call.function?.arguments ?? {}
    let args: Record<string, unknown> = {}
    if (typeof rawArgs === 'string') {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>
      } catch {
        args = { q: rawArgs }
      }
    } else {
      args = rawArgs
    }
    out.push({ name, args })
  }
  return out
}

function inferSearchQuery(text: string): string {
  const stop = new Set([
    'consulta',
    'consulte',
    'consultar',
    'busca',
    'buscar',
    'procura',
    'procurar',
    'existe',
    'existem',
    'tem',
    'nos',
    'nas',
    'cadastros',
    'cadastro',
    'cliente',
    'clientes',
    'pessoa',
    'pessoas',
    'preciso',
    'saber',
    'como',
    'esta',
    'está',
    'veja',
    'ver',
  ])
  return text
    .replace(/[?,.!]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stop.has(t.toLowerCase()))
    .join(' ')
    .trim()
}

function formatToolFallback(label: string, result: { ok: boolean; data?: unknown; error?: string }): string {
  if (!result.ok) {
    return `Não consegui consultar ${label} agora. Se quiser, posso abrir um chamado para um atendente.`
  }

  if (label === 'financeiro' && result.data && typeof result.data === 'object') {
    const data = result.data as {
      totais?: Record<string, unknown>
      contas_vencidas?: Array<{ pessoa_nome?: string; descricao?: string; valor?: number; vencimento?: string }>
    }
    const t = data.totais ?? {}
    const vencidas = data.contas_vencidas ?? []
    const lines = [
      `Em aberto: ${Number(t.qtd_em_aberto ?? 0)} conta(s), ${brl(t.total_em_aberto)}.`,
      `Já vencidas (cobrar): ${Number(t.qtd_vencidas ?? 0)} conta(s), ${brl(t.total_vencido)}.`,
      `Vencem em 7 dias: ${Number(t.qtd_vence_7d ?? 0)} conta(s), ${brl(t.total_vence_7d)}.`,
    ]
    if (vencidas.length > 0) {
      lines.push('Contas atrasadas:')
      for (const c of vencidas) {
        lines.push(
          `- ${c.pessoa_nome || 'sem nome'} · ${c.descricao || ''} · ${brl(c.valor)} · venc. ${c.vencimento}`,
        )
      }
    } else {
      lines.push('Não há contas vencidas no momento.')
    }
    return lines.join('\n')
  }

  if (Array.isArray(result.data)) {
    if (result.data.length === 0) return `Não encontrei ${label} nesta empresa.`
    const lines = result.data.map((row) => {
      const r = row as { nome?: string; cpf_cnpj?: string; email?: string; tipo_cadastro?: string }
      return `- ${r.nome || 'sem nome'}${r.tipo_cadastro ? ` (${r.tipo_cadastro})` : ''}${r.cpf_cnpj ? ` · ${r.cpf_cnpj}` : ''}${r.email ? ` · ${r.email}` : ''}`
    })
    return `Encontrei ${result.data.length} registro(s) em ${label}:\n${lines.join('\n')}`
  }

  return `Consulta de ${label}:\n${JSON.stringify(result.data, null, 2)}`
}

function brl(n: unknown) {
  return Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function createSupportAiService(db: D1Database) {
  return new SupportAiService(new SupportTicketRepository(db), db)
}
