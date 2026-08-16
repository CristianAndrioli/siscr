import type { D1Database } from '@cloudflare/workers-types'

export type SupportAgentRow = {
  id: string
  nome: string
  email: string
  password_hash: string
  role: 'master' | 'agent'
  ativo: number
  must_change_password: number
  created_at: string
  created_by: string | null
  updated_at: string | null
}

export type SupportAgentPublic = Omit<SupportAgentRow, 'password_hash'>

export class SupportAgentRepository {
  constructor(private readonly db: D1Database) {}

  async findByEmail(email: string): Promise<SupportAgentRow | null> {
    return this.db
      .prepare(
        `SELECT id, nome, email, password_hash, role, ativo, must_change_password, created_at, created_by, updated_at
         FROM support_agents WHERE LOWER(TRIM(email)) = ?`,
      )
      .bind(email.trim().toLowerCase())
      .first<SupportAgentRow>()
  }

  async findById(id: string): Promise<SupportAgentRow | null> {
    return this.db
      .prepare(
        `SELECT id, nome, email, password_hash, role, ativo, must_change_password, created_at, created_by, updated_at
         FROM support_agents WHERE id = ?`,
      )
      .bind(id)
      .first<SupportAgentRow>()
  }

  async list(): Promise<SupportAgentPublic[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, nome, email, role, ativo, must_change_password, created_at, created_by, updated_at
         FROM support_agents ORDER BY nome`,
      )
      .all<SupportAgentPublic>()
    return (results ?? []) as SupportAgentPublic[]
  }

  async listActiveEmails(): Promise<{ email: string; nome: string }[]> {
    const { results } = await this.db
      .prepare(`SELECT email, nome FROM support_agents WHERE ativo = 1`)
      .all<{ email: string; nome: string }>()
    return (results ?? []) as { email: string; nome: string }[]
  }

  async insert(row: {
    id: string
    nome: string
    email: string
    passwordHash: string
    role: 'master' | 'agent'
    createdBy: string | null
    createdAt: string
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO support_agents
          (id, nome, email, password_hash, role, ativo, must_change_password, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      )
      .bind(row.id, row.nome, row.email.trim().toLowerCase(), row.passwordHash, row.role, row.createdAt, row.createdBy)
      .run()
  }

  async updatePassword(id: string, passwordHash: string, clearMustChange: boolean): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare(
        `UPDATE support_agents
         SET password_hash = ?, must_change_password = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(passwordHash, clearMustChange ? 0 : 1, now, id)
      .run()
  }

  async update(
    id: string,
    patch: { nome?: string; role?: 'master' | 'agent'; ativo?: number },
  ): Promise<boolean> {
    const parts: string[] = []
    const values: unknown[] = []
    if (patch.nome !== undefined) {
      parts.push('nome = ?')
      values.push(patch.nome)
    }
    if (patch.role !== undefined) {
      parts.push('role = ?')
      values.push(patch.role)
    }
    if (patch.ativo !== undefined) {
      parts.push('ativo = ?')
      values.push(patch.ativo)
    }
    if (parts.length === 0) return false
    parts.push('updated_at = ?')
    values.push(new Date().toISOString(), id)
    await this.db
      .prepare(`UPDATE support_agents SET ${parts.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
    return true
  }
}
