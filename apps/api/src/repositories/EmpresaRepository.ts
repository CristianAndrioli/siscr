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
  codigoMunicipio: string | null
  crt: string | null
  cnae: string | null
  nfeSerie: string | null
  nfeAmbiente: number | null
  nfeProximoNumero: number | null
  createdAt: string
  /** Usuário autenticado ao criar (created_by / updated_by). */
  auditUserId: string | null
}

export class EmpresaRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async listWithFilialCount(): Promise<unknown[]> {
    const { results } = await this.db
      .prepare(
        `
      SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual, e.email, e.telefone,
             e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep,
             e.codigo_municipio, e.crt, e.cnae, e.nfe_serie, e.nfe_ambiente, e.nfe_proximo_numero,
             e.created_at, e.a1_cert_uploaded_at, e.a1_cert_meta,
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
        email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep,
        codigo_municipio, crt, cnae, nfe_serie, nfe_ambiente, nfe_proximo_numero,
        created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        row.codigoMunicipio,
        row.crt,
        row.cnae,
        row.nfeSerie,
        row.nfeAmbiente,
        row.nfeProximoNumero,
        row.createdAt,
        row.createdAt,
        row.auditUserId,
        row.auditUserId,
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

  /** Grava blob A1 + data de envio + metadados públicos do certificado (JSON). */
  async setA1CertStored(
    empresaId: string,
    objectKey: string,
    uploadedAt: string,
    metaJson: string,
    auditUserId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare(
        'UPDATE empresas SET a1_r2_object_key = ?, a1_cert_uploaded_at = ?, a1_cert_meta = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
      )
      .bind(objectKey, uploadedAt, metaJson, now, auditUserId, empresaId, this.tenantId)
      .run()
  }

  async updateA1CertMetaJson(empresaId: string, metaJson: string, auditUserId: string | null): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare('UPDATE empresas SET a1_cert_meta = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
      .bind(metaJson, now, auditUserId, empresaId, this.tenantId)
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
