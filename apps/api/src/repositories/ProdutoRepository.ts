import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

/**
 * Repositório de `produtos` — escopado por tenant.
 *
 * Regras específicas
 * -----------------------------------------------------------------
 * - O `codigo` é sequencial por tenant e GERADO PELO SISTEMA — o caller
 *   (service) usa `nextCodigo()`; o update NÃO permite alterar `codigo`.
 * - O `sku` é opcional mas tem índice único por tenant no schema; o caller
 *   precisa distinguir erros de UNIQUE via `try/catch` no `.run()`.
 * - `ativo` é armazenado como INTEGER (0/1); o service converte o boolean
 *   antes de chamar o repo.
 */

export type ProdutoInsertRow = {
  id: string
  empresaId: string | null
  codigo: string
  sku: string | null
  descricao: string
  unidade: string
  precoVenda: number
  precoCusto: number
  ncm: string | null
  origem: number
  cest: string | null
  icmsCst: string | null
  icmsCsosn: string | null
  pisCst: string
  cofinsCst: string
  ativo: number
  createdAt: string
  auditUserId: string | null
}

export type ProdutoUpdateFields = {
  // codigo NÃO entra no update — é gerenciado pelo sistema.
  sku?: string | null
  descricao?: string
  unidade?: string
  precoVenda?: number
  precoCusto?: number
  ncm?: string | null
  origem?: number
  cest?: string | null
  icmsCst?: string | null
  icmsCsosn?: string | null
  pisCst?: string
  cofinsCst?: string
  ativo?: number
  empresaId?: string | null
}

const PRODUTO_COLUMN_MAP: Record<keyof ProdutoUpdateFields, string> = {
  sku: 'sku',
  descricao: 'descricao',
  unidade: 'unidade',
  precoVenda: 'preco_venda',
  precoCusto: 'preco_custo',
  ncm: 'ncm',
  origem: 'origem',
  cest: 'cest',
  icmsCst: 'icms_cst',
  icmsCsosn: 'icms_csosn',
  pisCst: 'pis_cst',
  cofinsCst: 'cofins_cst',
  ativo: 'ativo',
  empresaId: 'empresa_id',
}

export type ProdutoListFilters = {
  empresaId?: string
  busca?: string
}

export class ProdutoRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async list(
    filters: ProdutoListFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: unknown[]; total: number }> {
    let where = ' WHERE tenant_id = ?'
    const params: unknown[] = [this.tenantId]

    if (filters.empresaId) {
      where += ' AND (empresa_id IS NULL OR empresa_id = ?)'
      params.push(filters.empresaId)
    }
    if (filters.busca) {
      where += ' AND (descricao LIKE ? OR codigo LIKE ? OR sku LIKE ?)'
      const like = `%${filters.busca}%`
      params.push(like, like, like)
    }

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as c FROM produtos${where}`)
      .bind(...params)
      .first<{ c: number }>()
    const total = Number(countRow?.c ?? 0)

    const { results } = await this.db
      .prepare(
        `SELECT id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
                origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo
         FROM produtos${where}
         ORDER BY CAST(codigo AS INTEGER)
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all()

    return { rows: results ?? [], total }
  }

  async findById(id: string): Promise<unknown | null> {
    const row = await this.prepareTenant(
      'SELECT * FROM produtos WHERE id = ? AND tenant_id = ?',
      [id],
    ).first()
    return row ?? null
  }

  async insert(row: ProdutoInsertRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO produtos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
           origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, this.tenantId,
        row.empresaId, row.codigo, row.sku,
        row.descricao, row.unidade,
        row.precoVenda, row.precoCusto,
        row.ncm, row.origem,
        row.cest, row.icmsCst, row.icmsCsosn,
        row.pisCst, row.cofinsCst,
        row.ativo,
        row.createdAt, row.createdAt, row.auditUserId, row.auditUserId,
      )
      .run()
  }

  async update(
    id: string,
    patch: ProdutoUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    const frag = this.buildUpdateSet(patch, PRODUTO_COLUMN_MAP)
    if (!frag) return false

    const now = new Date().toISOString()
    const sql = `UPDATE produtos SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
    await this.db
      .prepare(sql)
      .bind(...frag.values, now, auditUserId, id, this.tenantId)
      .run()
    return true
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM produtos WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }

  /**
   * Próximo código sequencial — delegado da util `nextCodigo`,
   * centralizado aqui para que a rota não precise importar outra
   * lib para cadastrar.
   */
  async nextCodigo(): Promise<string> {
    const row = await this.prepareTenant(
      `SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1 AS next
       FROM produtos WHERE tenant_id = ?`,
    ).first<{ next: number }>()
    return String(row?.next ?? 1)
  }
}
