import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

export type EmpresaInsertRow = {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  inscricaoEstadual: string | null
  email: string | null
  telefone: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  createdAt: string
}

export class EmpresaRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async listWithFilialCount(): Promise<unknown[]> {
    const { results } = await this.db
      .prepare(
        `
      SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.created_at,
             (SELECT COUNT(*) FROM filiais f WHERE f.empresa_id = e.id) as total_filiais
      FROM empresas e
      WHERE e.tenant_id = ?
      ORDER BY e.razao_social
    `,
      )
      .bind(this.tenantId)
      .all()
    return results ?? []
  }

  async insert(row: EmpresaInsertRow): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO empresas (id, tenant_id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
        email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        row.id,
        this.tenantId,
        row.razaoSocial,
        row.nomeFantasia,
        row.cnpj,
        row.inscricaoEstadual,
        row.email,
        row.telefone,
        row.logradouro,
        row.numero,
        row.complemento,
        row.bairro,
        row.cidade,
        row.uf,
        row.cep,
        row.createdAt,
      )
      .run()
  }

  async findIdByTenant(id: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT id FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .first<{ id: string }>()
    return row?.id ?? null
  }

  async update(id: string, setSql: string, values: unknown[]): Promise<void> {
    await this.db
      .prepare(`UPDATE empresas SET ${setSql} WHERE id = ? AND tenant_id = ?`)
      .bind(...values, id, this.tenantId)
      .run()
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }
}
