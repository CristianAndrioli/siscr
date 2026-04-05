import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

export type FilialInsertRow = {
  id: string
  empresaId: string
  nome: string
  cnpj: string | null
  uf: string | null
  cidade: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cep: string | null
  ativa: number
  createdAt: string
}

export class FilialRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async listByEmpresa(empresaId: string): Promise<unknown[]> {
    const { results } = await this.db
      .prepare(
        `
      SELECT id, nome, cnpj, uf, cidade, ativa, created_at, a1_cert_uploaded_at
      FROM filiais
      WHERE empresa_id = ? AND tenant_id = ?
      ORDER BY nome
    `,
      )
      .bind(empresaId, this.tenantId)
      .all()
    return results ?? []
  }

  async listAllWithEmpresa(): Promise<unknown[]> {
    const { results } = await this.db
      .prepare(
        `
      SELECT f.id, f.nome, f.cnpj, f.uf, f.cidade, f.logradouro, f.numero, f.bairro, f.cep, f.ativa, f.created_at, f.a1_cert_uploaded_at,
             e.id as empresa_id, e.razao_social as empresa_nome
      FROM filiais f
      LEFT JOIN empresas e ON e.id = f.empresa_id
      WHERE f.tenant_id = ?
      ORDER BY e.razao_social, f.nome
    `,
      )
      .bind(this.tenantId)
      .all()
    return results ?? []
  }

  async insert(row: FilialInsertRow): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO filiais (id, tenant_id, empresa_id, nome, cnpj, uf, cidade, logradouro, numero, bairro, cep, ativa, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        row.id,
        this.tenantId,
        row.empresaId,
        row.nome,
        row.cnpj,
        row.uf,
        row.cidade,
        row.logradouro,
        row.numero,
        row.bairro,
        row.cep,
        row.ativa,
        row.createdAt,
      )
      .run()
  }

  async update(id: string, setSql: string, values: unknown[]): Promise<void> {
    await this.db
      .prepare(`UPDATE filiais SET ${setSql} WHERE id = ? AND tenant_id = ?`)
      .bind(...values, id, this.tenantId)
      .run()
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM filiais WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }

  async getA1ObjectKey(filialId: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT a1_r2_object_key FROM filiais WHERE id = ? AND tenant_id = ?')
      .bind(filialId, this.tenantId)
      .first<{ a1_r2_object_key: string | null }>()
    return row?.a1_r2_object_key ?? null
  }

  async setA1CertObjectKey(filialId: string, objectKey: string | null, uploadedAt: string | null): Promise<void> {
    await this.db
      .prepare('UPDATE filiais SET a1_r2_object_key = ?, a1_cert_uploaded_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(objectKey, uploadedAt, filialId, this.tenantId)
      .run()
  }
}
