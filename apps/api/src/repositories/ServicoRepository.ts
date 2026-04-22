import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

/**
 * Repositório de `servicos` — escopado por tenant.
 *
 * Analogia com `ProdutoRepository`: mesmo modelo mental (codigo
 * sequencial gerenciado pelo sistema, sku opcional com UNIQUE,
 * ativo como INTEGER 0/1).
 */

export type ServicoInsertRow = {
  id: string
  empresaId: string | null
  codigo: string
  sku: string | null
  descricao: string
  unidade: string
  preco: number
  ativo: number
  createdAt: string
  auditUserId: string | null
}

export type ServicoUpdateFields = {
  sku?: string | null
  descricao?: string
  unidade?: string
  preco?: number
  ativo?: number
  empresaId?: string | null
}

const SERVICO_COLUMN_MAP: Record<keyof ServicoUpdateFields, string> = {
  sku: 'sku',
  descricao: 'descricao',
  unidade: 'unidade',
  preco: 'preco',
  ativo: 'ativo',
  empresaId: 'empresa_id',
}

export type ServicoListFilters = {
  empresaId?: string
  busca?: string
}

export class ServicoRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async list(
    filters: ServicoListFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: unknown[]; total: number }> {
    let where = ' WHERE tenant_id = ?'
    const params: unknown[] = [this.tenantId]

    if (filters.empresaId) { where += ' AND empresa_id = ?'; params.push(filters.empresaId) }
    if (filters.busca) {
      where += ' AND (descricao LIKE ? OR codigo LIKE ? OR sku LIKE ?)'
      const like = `%${filters.busca}%`
      params.push(like, like, like)
    }

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) as c FROM servicos${where}`)
      .bind(...params)
      .first<{ c: number }>()
    const total = Number(countRow?.c ?? 0)

    const { results } = await this.db
      .prepare(
        `SELECT id, codigo, sku, descricao, unidade, preco, ativo
         FROM servicos${where}
         ORDER BY CAST(codigo AS INTEGER)
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all()

    return { rows: results ?? [], total }
  }

  async findById(id: string): Promise<unknown | null> {
    const row = await this.prepareTenant(
      'SELECT * FROM servicos WHERE id = ? AND tenant_id = ?',
      [id],
    ).first()
    return row ?? null
  }

  async insert(row: ServicoInsertRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO servicos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco, ativo, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, this.tenantId,
        row.empresaId, row.codigo, row.sku,
        row.descricao, row.unidade,
        row.preco, row.ativo,
        row.createdAt, row.createdAt, row.auditUserId, row.auditUserId,
      )
      .run()
  }

  async update(
    id: string,
    patch: ServicoUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    const frag = this.buildUpdateSet(patch, SERVICO_COLUMN_MAP)
    if (!frag) return false

    const now = new Date().toISOString()
    const sql = `UPDATE servicos SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
    await this.db
      .prepare(sql)
      .bind(...frag.values, now, auditUserId, id, this.tenantId)
      .run()
    return true
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM servicos WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }

  async nextCodigo(): Promise<string> {
    const row = await this.prepareTenant(
      `SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1 AS next
       FROM servicos WHERE tenant_id = ?`,
    ).first<{ next: number }>()
    return String(row?.next ?? 1)
  }
}
