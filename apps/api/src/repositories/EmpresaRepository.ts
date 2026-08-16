import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

/**
 * Repositório de `empresas` — escopado por tenant.
 *
 * Convenções
 * -----------------------------------------------------------------
 * - Todo método SQL filtra por `tenant_id = ?` — herança estrita do
 *   BaseTenantRepository. O caller NÃO passa tenantId por parâmetro.
 * - `update(id, patch)` recebe um objeto tipado `EmpresaUpdateFields`
 *   (não SQL). O fragmento é montado internamente com whitelist.
 */

/** Linha pronta para INSERT (após validação e mapeamento no service). */
export type EmpresaInsertRow = {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  inscricaoEstadual: string | null
  inscricaoMunicipal: string | null
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
  nfseSerie: string | null
  nfseAmbiente: number | null
  nfseProximoNumero: number | null
  nfseCodigoServicoPadrao: string | null
  createdAt: string
  /** Usuário autenticado ao criar (created_by / updated_by). */
  auditUserId: string | null
}

/**
 * Campos permitidos para atualização (whitelist). Novos campos devem
 * ser adicionados aqui e no `EMPRESA_COLUMN_MAP` abaixo — NUNCA
 * aceitar colunas arbitrárias do body.
 */
export type EmpresaUpdateFields = {
  razaoSocial?: string
  nomeFantasia?: string | null
  cnpj?: string
  inscricaoEstadual?: string | null
  inscricaoMunicipal?: string | null
  email?: string | null
  telefone?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  codigoMunicipio?: string | null
  crt?: string | null
  cnae?: string | null
  nfeSerie?: string | null
  nfeAmbiente?: number | null
  nfeProximoNumero?: number | null
  nfseSerie?: string | null
  nfseAmbiente?: number | null
  nfseProximoNumero?: number | null
  nfseCodigoServicoPadrao?: string | null
}

const EMPRESA_COLUMN_MAP: Record<keyof EmpresaUpdateFields, string> = {
  razaoSocial: 'razao_social',
  nomeFantasia: 'nome_fantasia',
  cnpj: 'cnpj',
  inscricaoEstadual: 'inscricao_estadual',
  inscricaoMunicipal: 'inscricao_municipal',
  email: 'email',
  telefone: 'telefone',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cidade: 'cidade',
  uf: 'uf',
  cep: 'cep',
  codigoMunicipio: 'codigo_municipio',
  crt: 'crt',
  cnae: 'cnae',
  nfeSerie: 'nfe_serie',
  nfeAmbiente: 'nfe_ambiente',
  nfeProximoNumero: 'nfe_proximo_numero',
  nfseSerie: 'nfse_serie',
  nfseAmbiente: 'nfse_ambiente',
  nfseProximoNumero: 'nfse_proximo_numero',
  nfseCodigoServicoPadrao: 'nfse_codigo_servico_padrao',
}

export class EmpresaRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async listWithFilialCount(includeInactive = false): Promise<unknown[]> {
    const { results } = await this.prepareTenant(
      `
      SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual, e.inscricao_municipal,
             e.email, e.telefone,
             e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep,
             e.codigo_municipio, e.crt, e.cnae, e.nfe_serie, e.nfe_ambiente, e.nfe_proximo_numero,
             e.nfse_serie, e.nfse_ambiente, e.nfse_proximo_numero, e.nfse_codigo_servico_padrao,
             e.created_at, e.a1_cert_uploaded_at, e.a1_cert_meta, COALESCE(e.ativo, 1) as ativo,
             (SELECT COUNT(*) FROM filiais f WHERE f.empresa_id = e.id AND f.tenant_id = e.tenant_id) as total_filiais
      FROM empresas e
      WHERE e.tenant_id = ?${includeInactive ? '' : ' AND COALESCE(e.ativo, 1) = 1'}
      ORDER BY e.razao_social
      `,
    ).all()
    return results ?? []
  }

  async insert(row: EmpresaInsertRow): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO empresas (id, tenant_id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal,
        email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep,
        codigo_municipio, crt, cnae, nfe_serie, nfe_ambiente, nfe_proximo_numero,
        nfse_serie, nfse_ambiente, nfse_proximo_numero, nfse_codigo_servico_padrao,
        created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        row.id,
        this.tenantId,
        row.razaoSocial,
        row.nomeFantasia,
        row.cnpj,
        row.inscricaoEstadual,
        row.inscricaoMunicipal,
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
        row.nfseSerie,
        row.nfseAmbiente,
        row.nfseProximoNumero,
        row.nfseCodigoServicoPadrao,
        row.createdAt,
        row.createdAt,
        row.auditUserId,
        row.auditUserId,
      )
      .run()
  }

  async findIdByTenant(id: string): Promise<string | null> {
    const row = await this.prepareTenant(
      'SELECT id FROM empresas WHERE id = ? AND tenant_id = ?',
      [id],
    ).first<{ id: string }>()
    return row?.id ?? null
  }

  async count(): Promise<number> {
    const row = await this.prepareTenant(
      'SELECT COUNT(*) AS n FROM empresas WHERE tenant_id = ?',
    ).first<{ n: number }>()
    return row?.n ?? 0
  }

  async getA1ObjectKey(empresaId: string): Promise<string | null> {
    const row = await this.prepareTenant(
      'SELECT a1_r2_object_key FROM empresas WHERE id = ? AND tenant_id = ?',
      [empresaId],
    ).first<{ a1_r2_object_key: string | null }>()
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

  /**
   * Atualiza colunas permitidas pela whitelist (`EMPRESA_COLUMN_MAP`).
   * Retorna `false` quando nenhum campo válido foi fornecido.
   */
  async update(
    id: string,
    patch: EmpresaUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    const frag = this.buildUpdateSet(patch, EMPRESA_COLUMN_MAP)
    if (!frag) return false

    const now = new Date().toISOString()
    const sql = `UPDATE empresas SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
    await this.db
      .prepare(sql)
      .bind(...frag.values, now, auditUserId, id, this.tenantId)
      .run()
    return true
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }
}
