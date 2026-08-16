import type { D1Database } from '@cloudflare/workers-types'

export type SupportTicketKind = 'support' | 'development'
export type SupportTicketStatus =
  | 'open'
  | 'waiting_client'
  | 'waiting_agent'
  | 'in_progress'
  | 'resolved'
  | 'closed'
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type SupportMessageAuthor = 'ai' | 'client' | 'agent' | 'system'

export type SupportTicketRow = {
  id: string
  tenant_id: string
  tenant_slug: string
  tenant_nome: string
  created_by_user_id: string | null
  created_by_nome: string | null
  created_by_email: string | null
  assigned_agent_id: string | null
  assigned_agent_nome: string | null
  kind: SupportTicketKind
  source: 'ai' | 'user' | 'agent'
  status: SupportTicketStatus
  priority: SupportTicketPriority
  subject: string
  parent_ticket_id: string | null
  ai_session_id: string | null
  created_at: string
  updated_at: string | null
}

export type SupportMessageRow = {
  id: string
  ticket_id: string | null
  session_id: string | null
  author_type: SupportMessageAuthor
  author_id: string | null
  author_nome: string | null
  body: string
  created_at: string
}

export type SupportAiSessionRow = {
  id: string
  tenant_id: string
  user_id: string
  ticket_id: string | null
  created_at: string
  updated_at: string | null
}

const TICKET_SELECT = `
  t.id, t.tenant_id, t.tenant_slug, t.tenant_nome,
  t.created_by_user_id, t.created_by_nome, t.created_by_email,
  t.assigned_agent_id, a.nome as assigned_agent_nome,
  t.kind, t.source, t.status, t.priority, t.subject,
  t.parent_ticket_id, t.ai_session_id, t.created_at, t.updated_at
`

export class SupportTicketRepository {
  constructor(private readonly db: D1Database) {}

  async createSession(row: SupportAiSessionRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO support_ai_sessions (id, tenant_id, user_id, ticket_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(row.id, row.tenant_id, row.user_id, row.ticket_id, row.created_at, row.updated_at)
      .run()
  }

  async findSession(id: string): Promise<SupportAiSessionRow | null> {
    return this.db
      .prepare(
        `SELECT id, tenant_id, user_id, ticket_id, created_at, updated_at
         FROM support_ai_sessions WHERE id = ?`,
      )
      .bind(id)
      .first<SupportAiSessionRow>()
  }

  async findOpenSessionForUser(tenantId: string, userId: string): Promise<SupportAiSessionRow | null> {
    return this.db
      .prepare(
        `SELECT id, tenant_id, user_id, ticket_id, created_at, updated_at
         FROM support_ai_sessions
         WHERE tenant_id = ? AND user_id = ? AND ticket_id IS NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(tenantId, userId)
      .first<SupportAiSessionRow>()
  }

  async attachSessionToTicket(sessionId: string, ticketId: string): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare(`UPDATE support_ai_sessions SET ticket_id = ?, updated_at = ? WHERE id = ?`)
      .bind(ticketId, now, sessionId)
      .run()
  }

  async createTicket(row: Omit<SupportTicketRow, 'assigned_agent_nome'>): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO support_tickets (
           id, tenant_id, tenant_slug, tenant_nome,
           created_by_user_id, created_by_nome, created_by_email,
           assigned_agent_id, kind, source, status, priority, subject,
           parent_ticket_id, ai_session_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.tenant_id,
        row.tenant_slug,
        row.tenant_nome,
        row.created_by_user_id,
        row.created_by_nome,
        row.created_by_email,
        row.assigned_agent_id,
        row.kind,
        row.source,
        row.status,
        row.priority,
        row.subject,
        row.parent_ticket_id,
        row.ai_session_id,
        row.created_at,
        row.updated_at,
      )
      .run()
  }

  async findTicket(id: string): Promise<SupportTicketRow | null> {
    return this.db
      .prepare(
        `SELECT ${TICKET_SELECT}
         FROM support_tickets t
         LEFT JOIN support_agents a ON a.id = t.assigned_agent_id
         WHERE t.id = ?`,
      )
      .bind(id)
      .first<SupportTicketRow>()
  }

  async listTickets(filters: {
    kind?: SupportTicketKind
    status?: SupportTicketStatus
    tenantId?: string
    q?: string
    limit?: number
  }): Promise<SupportTicketRow[]> {
    const where: string[] = ['1 = 1']
    const values: unknown[] = []
    if (filters.kind) {
      where.push('t.kind = ?')
      values.push(filters.kind)
    }
    if (filters.status) {
      where.push('t.status = ?')
      values.push(filters.status)
    }
    if (filters.tenantId) {
      where.push('t.tenant_id = ?')
      values.push(filters.tenantId)
    }
    if (filters.q?.trim()) {
      where.push('(t.tenant_slug LIKE ? OR t.tenant_nome LIKE ? OR t.subject LIKE ? OR t.created_by_email LIKE ?)')
      const like = `%${filters.q.trim()}%`
      values.push(like, like, like, like)
    }
    const limit = Math.min(filters.limit ?? 100, 200)
    values.push(limit)
    const { results } = await this.db
      .prepare(
        `SELECT ${TICKET_SELECT}
         FROM support_tickets t
         LEFT JOIN support_agents a ON a.id = t.assigned_agent_id
         WHERE ${where.join(' AND ')}
         ORDER BY t.created_at DESC
         LIMIT ?`,
      )
      .bind(...values)
      .all<SupportTicketRow>()
    return (results ?? []) as SupportTicketRow[]
  }

  async listTicketsForUser(tenantId: string, userId: string): Promise<SupportTicketRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT ${TICKET_SELECT}
         FROM support_tickets t
         LEFT JOIN support_agents a ON a.id = t.assigned_agent_id
         WHERE t.tenant_id = ? AND t.created_by_user_id = ? AND t.kind = 'support'
         ORDER BY t.created_at DESC
         LIMIT 50`,
      )
      .bind(tenantId, userId)
      .all<SupportTicketRow>()
    return (results ?? []) as SupportTicketRow[]
  }

  async updateTicket(
    id: string,
    patch: {
      status?: SupportTicketStatus
      assigned_agent_id?: string | null
      priority?: SupportTicketPriority
    },
  ): Promise<void> {
    const parts: string[] = []
    const values: unknown[] = []
    if (patch.status !== undefined) {
      parts.push('status = ?')
      values.push(patch.status)
    }
    if (patch.assigned_agent_id !== undefined) {
      parts.push('assigned_agent_id = ?')
      values.push(patch.assigned_agent_id)
    }
    if (patch.priority !== undefined) {
      parts.push('priority = ?')
      values.push(patch.priority)
    }
    if (parts.length === 0) return
    parts.push('updated_at = ?')
    values.push(new Date().toISOString(), id)
    await this.db
      .prepare(`UPDATE support_tickets SET ${parts.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
  }

  async insertMessage(row: SupportMessageRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO support_messages
          (id, ticket_id, session_id, author_type, author_id, author_nome, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.ticket_id,
        row.session_id,
        row.author_type,
        row.author_id,
        row.author_nome,
        row.body,
        row.created_at,
      )
      .run()
  }

  async listMessagesBySession(sessionId: string): Promise<SupportMessageRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, ticket_id, session_id, author_type, author_id, author_nome, body, created_at
         FROM support_messages WHERE session_id = ? ORDER BY created_at ASC`,
      )
      .bind(sessionId)
      .all<SupportMessageRow>()
    return (results ?? []) as SupportMessageRow[]
  }

  async listMessagesByTicket(ticketId: string): Promise<SupportMessageRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, ticket_id, session_id, author_type, author_id, author_nome, body, created_at
         FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      )
      .bind(ticketId)
      .all<SupportMessageRow>()
    return (results ?? []) as SupportMessageRow[]
  }

  async attachSessionMessagesToTicket(sessionId: string, ticketId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE support_messages SET ticket_id = ? WHERE session_id = ? AND ticket_id IS NULL`)
      .bind(ticketId, sessionId)
      .run()
  }
}
