import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

/**
 * Repositório de `filiais` — escopado por tenant.
 *
 * Mesmas regras do `EmpresaRepository`: toda query filtra por
 * `tenant_id` e `update()` só aceita campos whitelistados.
 */

export type FilialInsertRow = {
  id: string
  empresaId: string
  nome: string
  cnpj: string | null
  uf: string | null
  cidade: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cep: string | null
  codigoMunicipio: string | null
  inscricaoEstadual: string | null
  ativa: number
  createdAt: string
  auditUserId: string | null
}

export type FilialUpdateFields = {
  nome?: string
  cnpj?: string | null
  uf?: string | null
  cidade?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cep?: string | null
  codigoMunicipio?: string | null
  inscricaoEstadual?: string | null
  ativa?: number
}

const FILIAL_COLUMN_MAP: Record<keyof FilialUpdateFields, string> = {
  nome: 'nome',
  cnpj: 'cnpj',
  uf: 'uf',
  cidade: 'cidade',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cep: 'cep',
  codigoMunicipio: 'codigo_municipio',
  inscricaoEstadual: 'inscricao_estadual',
  ativa: 'ativa',
}

export class FilialRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async listByEmpresa(empresaId: string): Promise<unknown[]> {
    const { results } = await this.prepareTenant(
      `
      SELECT id, nome, cnpj, uf, cidade, logradouro, numero, complemento, bairro, cep,
             codigo_municipio, inscricao_estadual, ativa, created_at, a1_cert_uploaded_at, a1_cert_meta
      FROM filiais
      WHERE empresa_id = ? AND tenant_id = ?
      ORDER BY nome
      `,
      [empresaId],
    ).all()
    return results ?? []
  }

  async listAllWithEmpresa(): Promise<unknown[]> {
    const { results } = await this.prepareTenant(
      `
      SELECT f.id, f.nome, f.cnpj, f.uf, f.cidade, f.logradouro, f.numero, f.complemento, f.bairro, f.cep,
             f.codigo_municipio, f.inscricao_estadual, f.ativa, f.created_at, f.a1_cert_uploaded_at, f.a1_cert_meta,
             e.id as empresa_id, e.razao_social as empresa_nome
      FROM filiais f
      LEFT JOIN empresas e ON e.id = f.empresa_id AND e.tenant_id = f.tenant_id
      WHERE f.tenant_id = ?
      ORDER BY e.razao_social, f.nome
      `,
    ).all()
    return results ?? []
  }

  async insert(row: FilialInsertRow): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO filiais (id, tenant_id, empresa_id, nome, cnpj, uf, cidade, logradouro, numero, complemento, bairro, cep, codigo_municipio, inscricao_estadual, ativa, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        row.complemento,
        row.bairro,
        row.cep,
        row.codigoMunicipio,
        row.inscricaoEstadual,
        row.ativa,
        row.createdAt,
        row.createdAt,
        row.auditUserId,
        row.auditUserId,
      )
      .run()
  }

  /**
   * Atualiza colunas permitidas pela whitelist (`FILIAL_COLUMN_MAP`).
   * Retorna `false` quando nenhum campo válido foi fornecido.
   */
  async update(
    id: string,
    patch: FilialUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    const frag = this.buildUpdateSet(patch, FILIAL_COLUMN_MAP)
    if (!frag) return false

    const now = new Date().toISOString()
    const sql = `UPDATE filiais SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
    await this.db
      .prepare(sql)
      .bind(...frag.values, now, auditUserId, id, this.tenantId)
      .run()
    return true
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM filiais WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }

  async getA1ObjectKey(filialId: string): Promise<string | null> {
    const row = await this.prepareTenant(
      'SELECT a1_r2_object_key FROM filiais WHERE id = ? AND tenant_id = ?',
      [filialId],
    ).first<{ a1_r2_object_key: string | null }>()
    return row?.a1_r2_object_key ?? null
  }

  async setA1CertStored(
    filialId: string,
    objectKey: string,
    uploadedAt: string,
    metaJson: string,
    auditUserId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare(
        'UPDATE filiais SET a1_r2_object_key = ?, a1_cert_uploaded_at = ?, a1_cert_meta = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
      )
      .bind(objectKey, uploadedAt, metaJson, now, auditUserId, filialId, this.tenantId)
      .run()
  }

  async updateA1CertMetaJson(filialId: string, metaJson: string, auditUserId: string | null): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare('UPDATE filiais SET a1_cert_meta = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
      .bind(metaJson, now, auditUserId, filialId, this.tenantId)
      .run()
  }
}
