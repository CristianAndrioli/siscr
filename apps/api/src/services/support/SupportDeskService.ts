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
}

export function createSupportDeskService(db: D1Database) {
  return new SupportDeskService(new SupportAgentRepository(db), new SupportTicketRepository(db), db)
}
