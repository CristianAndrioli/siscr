import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

/**
 * Repositório de `pessoas` — escopado por tenant.
 *
 * O modelo "pessoa" é genérico no SISCR: representa cliente,
 * fornecedor, funcionário ou transportadora via `tipo_cadastro`;
 * e PF vs PJ via `tipo`.
 *
 * Todas as queries filtram por `tenant_id` através do
 * `BaseTenantRepository`. `update()` aceita apenas campos
 * whitelistados em `PESSOA_COLUMN_MAP`.
 */

export type PessoaTipo = 'PF' | 'PJ'
export type PessoaCadastro = 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora'

export type PessoaInsertRow = {
  id: string
  empresaId: string | null
  filialId: string | null
  tipo: PessoaTipo
  tipoCadastro: PessoaCadastro
  nome: string
  cpfCnpj: string | null
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  inscricaoEstadual: string | null
  indIeDest: string
  codigoMunicipio: string | null
  codigoPais: string
  createdAt: string
  auditUserId: string | null
}

export type PessoaUpdateFields = {
  tipo?: PessoaTipo
  tipoCadastro?: PessoaCadastro
  nome?: string
  cpfCnpj?: string | null
  email?: string | null
  telefone?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  inscricaoEstadual?: string | null
  indIeDest?: string
  codigoMunicipio?: string | null
  codigoPais?: string
  empresaId?: string | null
  filialId?: string | null
}

const PESSOA_COLUMN_MAP: Record<keyof PessoaUpdateFields, string> = {
  tipo: 'tipo',
  tipoCadastro: 'tipo_cadastro',
  nome: 'nome',
  cpfCnpj: 'cpf_cnpj',
  email: 'email',
  telefone: 'telefone',
  cep: 'cep',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cidade: 'cidade',
  uf: 'uf',
  inscricaoEstadual: 'inscricao_estadual',
  indIeDest: 'ind_ie_dest',
  codigoMunicipio: 'codigo_municipio',
  codigoPais: 'codigo_pais',
  empresaId: 'empresa_id',
  filialId: 'filial_id',
}

export type PessoaListFilters = {
  empresaId?: string
  filialId?: string
  tipo?: string
  tipoCadastro?: string
  busca?: string
}

export class PessoaRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  /**
   * Lista paginada com filtros opcionais.
   *
   * Todos os filtros são montados com `?` parametrizados — nunca
   * interpolar valores direto na string SQL.
   */
  async list(
    filters: PessoaListFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: unknown[]; total: number }> {
    let where = ' WHERE tenant_id = ?'
    const params: unknown[] = [this.tenantId]

    if (filters.empresaId) { where += ' AND empresa_id = ?'; params.push(filters.empresaId) }
    if (filters.filialId) { where += ' AND filial_id = ?'; params.push(filters.filialId) }
    if (filters.tipo) { where += ' AND tipo = ?'; params.push(filters.tipo) }
    if (filters.tipoCadastro) { where += ' AND tipo_cadastro = ?'; params.push(filters.tipoCadastro) }
    if (filters.busca) {
      where += ' AND (nome LIKE ? OR cpf_cnpj LIKE ?)'
      params.push(`%${filters.busca}%`, `%${filters.busca}%`)
    }

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as c FROM pessoas${where}`)
      .bind(...params)
      .first<{ c: number }>()
    const total = Number(countRow?.c ?? 0)

    const { results } = await this.db
      .prepare(
        `SELECT id, codigo, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone, ativo, created_at
         FROM pessoas${where}
         ORDER BY CAST(codigo AS INTEGER) ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all()

    return { rows: results ?? [], total }
  }

  async findById(id: string): Promise<unknown | null> {
    const row = await this.prepareTenant(
      'SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?',
      [id],
    ).first()
    return row ?? null
  }

  async insert(row: PessoaInsertRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO pessoas (id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone,
           cep, logradouro, numero, complemento, bairro, cidade, uf,
           inscricao_estadual, ind_ie_dest, codigo_municipio, codigo_pais,
           ativo, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, this.tenantId,
        row.empresaId, row.filialId,
        row.tipo, row.tipoCadastro,
        row.nome, row.cpfCnpj,
        row.email, row.telefone,
        row.cep, row.logradouro, row.numero,
        row.complemento, row.bairro, row.cidade, row.uf,
        row.inscricaoEstadual,
        row.indIeDest,
        row.codigoMunicipio,
        row.codigoPais,
        row.createdAt, row.createdAt, row.auditUserId, row.auditUserId,
      )
      .run()
  }

  /**
   * Atualiza colunas whitelistadas. Retorna `false` se nenhum campo
   * válido foi informado — caller pode responder HTTP 400.
   */
  async update(
    id: string,
    patch: PessoaUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    const frag = this.buildUpdateSet(patch, PESSOA_COLUMN_MAP)
    if (!frag) return false

    const now = new Date().toISOString()
    const sql = `UPDATE pessoas SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
    await this.db
      .prepare(sql)
      .bind(...frag.values, now, auditUserId, id, this.tenantId)
      .run()
    return true
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM pessoas WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }
}
