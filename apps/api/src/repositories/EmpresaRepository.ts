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
      SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.created_at, e.a1_cert_uploaded_at,
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

  async count(): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM empresas WHERE tenant_id = ?')
      .bind(this.tenantId)
      .first<{ n: number }>()
    return row?.n ?? 0
  }

  async getA1ObjectKey(empresaId: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT a1_r2_object_key FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(empresaId, this.tenantId)
      .first<{ a1_r2_object_key: string | null }>()
    return row?.a1_r2_object_key ?? null
  }

  async setA1CertObjectKey(empresaId: string, objectKey: string | null, uploadedAt: string | null): Promise<void> {
    await this.db
      .prepare('UPDATE empresas SET a1_r2_object_key = ?, a1_cert_uploaded_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(objectKey, uploadedAt, empresaId, this.tenantId)
      .run()
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
