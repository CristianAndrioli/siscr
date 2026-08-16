import type { D1Database } from '@cloudflare/workers-types'
import { PasswordHasher } from '../../lib/password'
import { SupportAgentRepository } from '../../repositories/SupportAgentRepository'
import {
  SupportTicketRepository,
  type SupportTicketKind,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../../repositories/SupportTicketRepository'
import type { DeskAgent } from '../../middleware/deskAuth'

export class SupportDeskService {
  constructor(
    private readonly agents: SupportAgentRepository,
    private readonly tickets: SupportTicketRepository,
    private readonly db: D1Database,
  ) {}

  async login(email: string, password: string): Promise<DeskAgent | { error: string; status: number }> {
    const row = await this.agents.findByEmail(email)
    if (!row || row.ativo !== 1) {
      return { error: 'E-mail ou senha incorretos.', status: 401 }
    }
    const ok = await PasswordHasher.verify(password, row.password_hash)
    if (!ok) {
      return { error: 'E-mail ou senha incorretos.', status: 401 }
    }
    if (PasswordHasher.needsRehash(row.password_hash)) {
      try {
        const fresh = await PasswordHasher.hash(password)
        await this.agents.updatePassword(row.id, fresh, row.must_change_password === 1)
      } catch (err) {
        console.error('[desk.login] Falha ao rehash:', err)
      }
    }
    return {
      agentId: row.id,
      email: row.email,
      nome: row.nome,
      role: row.role,
      mustChangePassword: row.must_change_password === 1,
    }
  }

  async changePassword(agentId: string, currentPassword: string, newPassword: string) {
    const row = await this.agents.findById(agentId)
    if (!row) return { error: 'Agente não encontrado.', status: 404 as const }
    const ok = await PasswordHasher.verify(currentPassword, row.password_hash)
    if (!ok) return { error: 'Senha atual incorreta.', status: 401 as const }
    const hash = await PasswordHasher.hash(newPassword)
    await this.agents.updatePassword(agentId, hash, true)
    return { ok: true as const }
  }

  async listAgents() {
    return this.agents.list()
  }

  async createAgent(input: {
    nome: string
    email: string
    password: string
    role: 'master' | 'agent'
    createdBy: string
  }) {
    const existing = await this.agents.findByEmail(input.email)
    if (existing) return { error: 'Já existe um usuário com este e-mail.', status: 409 as const }
    const id = crypto.randomUUID()
    const hash = await PasswordHasher.hash(input.password)
    await this.agents.insert({
      id,
      nome: input.nome,
      email: input.email,
      passwordHash: hash,
      role: input.role,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    })
    return { id }
  }

  async updateAgent(id: string, patch: { nome?: string; role?: 'master' | 'agent'; ativo?: boolean }) {
    const row = await this.agents.findById(id)
    if (!row) return { error: 'Agente não encontrado.', status: 404 as const }
    await this.agents.update(id, {
      nome: patch.nome,
      role: patch.role,
      ativo: patch.ativo === undefined ? undefined : patch.ativo ? 1 : 0,
    })
    return { ok: true as const }
  }

  async listTickets(filters: {
    kind?: SupportTicketKind
    status?: SupportTicketStatus
    q?: string
  }) {
    return this.tickets.listTickets(filters)
  }

  async getTicket(id: string) {
    const ticket = await this.tickets.findTicket(id)
    if (!ticket) return null
    const messages = await this.tickets.listMessagesByTicket(id)
    return { ticket, messages }
  }

  async claimTicket(ticketId: string, agentId: string) {
    const ticket = await this.tickets.findTicket(ticketId)
    if (!ticket) return { error: 'Ticket não encontrado.', status: 404 as const }
    await this.tickets.updateTicket(ticketId, {
      assigned_agent_id: agentId,
      status: ticket.status === 'open' || ticket.status === 'waiting_agent' ? 'in_progress' : ticket.status,
    })
    return { ok: true as const }
  }

  async updateTicketStatus(ticketId: string, status?: SupportTicketStatus, priority?: SupportTicketPriority) {
    const ticket = await this.tickets.findTicket(ticketId)
    if (!ticket) return { error: 'Ticket não encontrado.', status: 404 as const }
    await this.tickets.updateTicket(ticketId, { status, priority })
    return { ok: true as const }
  }

  async addAgentMessage(ticketId: string, agent: DeskAgent, body: string) {
    const ticket = await this.tickets.findTicket(ticketId)
    if (!ticket) return { error: 'Ticket não encontrado.', status: 404 as const }
    const now = new Date().toISOString()
    const message = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      session_id: ticket.ai_session_id,
      author_type: 'agent' as const,
      author_id: agent.agentId,
      author_nome: agent.nome,
      body,
      created_at: now,
    }
    await this.tickets.insertMessage(message)
    await this.tickets.updateTicket(ticketId, { status: 'waiting_client', assigned_agent_id: agent.agentId })
    return { message }
  }

  async createDevelopmentTicket(parentId: string, agent: DeskAgent, subject: string, body?: string) {
    const parent = await this.tickets.findTicket(parentId)
    if (!parent) return { error: 'Ticket de origem não encontrado.', status: 404 as const }
    if (parent.kind !== 'support') {
      return { error: 'Só é possível criar desenvolvimento a partir de um ticket de suporte.', status: 400 as const }
    }
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await this.tickets.createTicket({
      id,
      tenant_id: parent.tenant_id,
      tenant_slug: parent.tenant_slug,
      tenant_nome: parent.tenant_nome,
      created_by_user_id: parent.created_by_user_id,
      created_by_nome: agent.nome,
      created_by_email: agent.email,
      assigned_agent_id: agent.agentId,
      kind: 'development',
      source: 'agent',
      status: 'open',
      priority: parent.priority,
      subject,
      parent_ticket_id: parentId,
      ai_session_id: null,
      created_at: now,
      updated_at: now,
    })
    await this.tickets.insertMessage({
      id: crypto.randomUUID(),
      ticket_id: id,
      session_id: null,
      author_type: 'system',
      author_id: agent.agentId,
      author_nome: agent.nome,
      body: body?.trim() || `Ticket de desenvolvimento criado a partir de ${parentId}.`,
      created_at: now,
    })
    const ticket = await this.tickets.findTicket(id)
    return { ticket }
  }

  async tenantSnapshot(tenantId: string) {
    return this.db
      .prepare(
        `SELECT t.id, t.slug, t.nome, t.status, t.plan_id, p.nome as plan_nome
         FROM tenants t
         LEFT JOIN plans p ON p.id = t.plan_id
         WHERE t.id = ?`,
      )
      .bind(tenantId)
      .first()
  }

  async listClients() {
    const [tenants, empresas, users, filiais, tickets] = await Promise.all([
      this.db
        .prepare(
          `SELECT t.id, t.slug, t.nome, t.status, t.plan_id, t.subscription_expires_at, t.created_at,
                  t.stripe_subscription_id,
                  p.nome as plan_nome,
                  p.max_empresas, p.max_filiais, p.max_usuarios, p.max_docs_fiscais_mes
           FROM tenants t
           LEFT JOIN plans p ON p.id = t.plan_id
           ORDER BY t.created_at DESC`,
        )
        .all<DeskTenantRow>(),
      this.db
        .prepare(
          `SELECT tenant_id, id, razao_social, nome_fantasia, cnpj, cnae, crt, regime_tributario,
                  cidade, uf, email, telefone, inscricao_estadual, COALESCE(ativo, 1) as ativo
           FROM empresas
           ORDER BY razao_social`,
        )
        .all<DeskEmpresaRow>(),
      this.db.prepare(`SELECT tenant_id, COUNT(*) as n FROM users WHERE ativo = 1 GROUP BY tenant_id`).all<{ tenant_id: string; n: number }>(),
      this.db
        .prepare(
          `SELECT tenant_id, empresa_id, id, nome, cnpj, cidade, uf, ativa
           FROM filiais
           ORDER BY nome`,
        )
        .all<DeskFilialRow>(),
      this.db
        .prepare(
          `SELECT tenant_id, COUNT(*) as n FROM support_tickets
           WHERE status NOT IN ('resolved', 'closed')
           GROUP BY tenant_id`,
        )
        .all<{ tenant_id: string; n: number }>(),
    ])

    const countMap = (rows: { tenant_id: string; n: number }[] | undefined) => {
      const map = new Map<string, number>()
      for (const row of rows ?? []) map.set(row.tenant_id, row.n)
      return map
    }
    const userMap = countMap(users.results)
    const ticketMap = countMap(tickets.results)
    const filiaisByEmpresa = new Map<string, DeskFilialRow[]>()
    const filialCountByTenant = new Map<string, number>()
    for (const filial of filiais.results ?? []) {
      const list = filiaisByEmpresa.get(filial.empresa_id) ?? []
      list.push(filial)
      filiaisByEmpresa.set(filial.empresa_id, list)
      filialCountByTenant.set(filial.tenant_id, (filialCountByTenant.get(filial.tenant_id) ?? 0) + 1)
    }
    const empresasByTenant = new Map<string, DeskEmpresa[]>()
    for (const emp of empresas.results ?? []) {
      const list = empresasByTenant.get(emp.tenant_id) ?? []
      list.push({ ...emp, filiais: filiaisByEmpresa.get(emp.id) ?? [] })
      empresasByTenant.set(emp.tenant_id, list)
    }

    return (tenants.results ?? []).map((t) => {
      const empresasTenant = empresasByTenant.get(t.id) ?? []
      return {
        id: t.id,
        slug: t.slug,
        nome: t.nome,
        status: t.status,
        plan_id: t.plan_id,
        plan_nome: t.plan_nome ?? 'Sem plano',
        subscription_expires_at: t.subscription_expires_at,
        created_at: t.created_at,
        has_stripe: Boolean(t.stripe_subscription_id),
        limites: {
          max_empresas: t.max_empresas ?? 0,
          max_filiais: t.max_filiais ?? 0,
          max_usuarios: t.max_usuarios ?? 0,
          max_docs_fiscais_mes: t.max_docs_fiscais_mes ?? 0,
        },
        uso: {
          empresas: empresasTenant.length,
          filiais: filialCountByTenant.get(t.id) ?? 0,
          usuarios: userMap.get(t.id) ?? 0,
          tickets_abertos: ticketMap.get(t.id) ?? 0,
        },
        empresas: empresasTenant,
      }
    })
  }

  async getClient(tenantId: string) {
    const clients = await this.listClients()
    const client = clients.find((c) => c.id === tenantId)
    if (!client) return null
    const { results: usuarios } = await this.db
      .prepare(
        `SELECT id, nome, email, role, ativo, created_at
         FROM users
         WHERE tenant_id = ?
         ORDER BY nome`,
      )
      .bind(tenantId)
      .all<DeskClientUserRow>()
    return { ...client, usuarios: usuarios ?? [] }
  }

  async setTenantStatus(tenantId: string, status: 'active' | 'suspended') {
    const row = await this.db
      .prepare('SELECT id, slug FROM tenants WHERE id = ?')
      .bind(tenantId)
      .first<{ id: string; slug: string }>()
    if (!row) return { error: 'Cliente não encontrado.', status: 404 as const }
    await this.db.prepare('UPDATE tenants SET status = ? WHERE id = ?').bind(status, tenantId).run()
    return { slug: row.slug }
  }

  async setEmpresaAtivo(tenantId: string, empresaId: string, ativo: boolean) {
    const row = await this.db
      .prepare('SELECT id FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(empresaId, tenantId)
      .first<{ id: string }>()
    if (!row) return { error: 'Empresa não encontrada.', status: 404 as const }
    const now = new Date().toISOString()
    await this.db
      .prepare('UPDATE empresas SET ativo = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(ativo ? 1 : 0, now, empresaId, tenantId)
      .run()
    return { ok: true as const }
  }

  async setFilialAtiva(tenantId: string, filialId: string, ativa: boolean) {
    const row = await this.db
      .prepare(
        `SELECT f.id, COALESCE(e.ativo, 1) as empresa_ativo
         FROM filiais f
         JOIN empresas e ON e.id = f.empresa_id AND e.tenant_id = f.tenant_id
         WHERE f.id = ? AND f.tenant_id = ?`,
      )
      .bind(filialId, tenantId)
      .first<{ id: string; empresa_ativo: number }>()
    if (!row) return { error: 'Filial não encontrada.', status: 404 as const }
    if (ativa && row.empresa_ativo !== 1) {
      return { error: 'Reative a empresa antes de ativar a filial.', status: 400 as const }
    }
    const now = new Date().toISOString()
    await this.db
      .prepare('UPDATE filiais SET ativa = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(ativa ? 1 : 0, now, filialId, tenantId)
      .run()
    return { ok: true as const }
  }
}

type DeskTenantRow = {
  id: string
  slug: string
  nome: string
  status: string
  plan_id: string | null
  subscription_expires_at: string | null
  created_at: string
  stripe_subscription_id: string | null
  plan_nome: string | null
  max_empresas: number | null
  max_filiais: number | null
  max_usuarios: number | null
  max_docs_fiscais_mes: number | null
}

export type DeskFilialRow = {
  tenant_id: string
  empresa_id: string
  id: string
  nome: string
  cnpj: string | null
  cidade: string | null
  uf: string | null
  ativa: number
}

export type DeskEmpresaRow = {
  tenant_id: string
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  cnae: string | null
  crt: string | null
  regime_tributario: string | null
  cidade: string | null
  uf: string | null
  email: string | null
  telefone: string | null
  inscricao_estadual: string | null
  ativo: number
}

type DeskEmpresa = DeskEmpresaRow & { filiais: DeskFilialRow[] }

type DeskClientUserRow = {
  id: string
  nome: string
  email: string
  role: string
  ativo: number
  created_at: string
}

export function createSupportDeskService(db: D1Database) {
  return new SupportDeskService(new SupportAgentRepository(db), new SupportTicketRepository(db), db)
}
