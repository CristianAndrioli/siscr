import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository, type D1PreparedStatement } from './BaseTenantRepository'

/**
 * Repositório de `cotacoes` + `cotacao_itens` — escopado por tenant.
 *
 * Consistência atômica
 * -----------------------------------------------------------------
 * Uma cotação tem uma coleção de itens. Para manter os dois lados
 * consistentes (especialmente no UPDATE, que pode reescrever os
 * itens), expomos `saveWithItems()` que usa `db.batch(...)` — o
 * batch é uma transação do D1, ou tudo executa, ou nada.
 */

export type CotacaoStatus = 'rascunho' | 'enviada' | 'aprovada' | 'recusada' | 'expirada'
export type CotacaoTipo = 'venda' | 'compra'

export type CotacaoItemRow = {
  produtoId: string | null
  servicoId: string | null
  descricao: string
  quantidade: number
  valorUnitario: number
  desconto: number
  unidade: string
}

export type CotacaoInsertRow = {
  id: string
  numero: string
  tipo: CotacaoTipo
  pessoaId: string | null
  validade: string | null
  observacoes: string | null
  desconto: number
  valorTotal: number
  status: CotacaoStatus
  createdAt: string
  auditUserId: string | null
}

export type CotacaoUpdatePatch = {
  pessoaId?: string | null
  validade?: string | null
  observacoes?: string | null
  desconto?: number
  valorTotal?: number
  status?: CotacaoStatus
}

const COTACAO_COLUMN_MAP: Record<keyof CotacaoUpdatePatch, string> = {
  pessoaId: 'pessoa_id',
  validade: 'validade',
  observacoes: 'observacoes',
  desconto: 'desconto',
  valorTotal: 'valor_total',
  status: 'status',
}

export type CotacaoListFilters = {
  status?: string
  busca?: string
  tipo?: CotacaoTipo
  limit?: number
  offset?: number
}

export type CotacaoListResult = {
  cotacoes: unknown[]
  total: number
  /** Contagens por status (do mesmo tipo, sem filtro de status/busca). */
  resumo: { status: string; quantidade: number; valor_total: number }[]
}

export class CotacaoRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async list(filters: CotacaoListFilters): Promise<CotacaoListResult> {
    const where: string[] = ['co.tenant_id = ?']
    const params: unknown[] = [this.tenantId]
    if (filters.status) { where.push('co.status = ?'); params.push(filters.status) }
    if (filters.tipo) { where.push('co.tipo = ?'); params.push(filters.tipo) }
    if (filters.busca) {
      where.push('(p.nome LIKE ? OR co.numero LIKE ?)')
      const like = `%${filters.busca}%`
      params.push(like, like)
    }
    const whereSql = where.join(' AND ')
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
    const offset = Math.max(filters.offset ?? 0, 0)

    const countRow = await this.db
      .prepare(
        `SELECT COUNT(*) as c
         FROM cotacoes co
         LEFT JOIN pessoas p ON p.id = co.pessoa_id AND p.tenant_id = co.tenant_id
         WHERE ${whereSql}`,
      )
      .bind(...params)
      .first<{ c: number }>()

    const { results } = await this.db
      .prepare(
        `SELECT co.id, co.numero, co.tipo, co.status, co.validade, co.valor_total, co.created_at,
                co.pessoa_id, p.nome as cliente
         FROM cotacoes co
         LEFT JOIN pessoas p ON p.id = co.pessoa_id AND p.tenant_id = co.tenant_id
         WHERE ${whereSql}
         ORDER BY co.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all()

    // Resumo do tipo (sem status/busca) — alimenta os cards da lista.
    const resumoParams: unknown[] = [this.tenantId]
    let resumoWhere = 'tenant_id = ?'
    if (filters.tipo) {
      resumoWhere += ' AND tipo = ?'
      resumoParams.push(filters.tipo)
    }
    const { results: resumoRows } = await this.db
      .prepare(
        `SELECT status, COUNT(*) as quantidade, COALESCE(SUM(valor_total), 0) as valor_total
         FROM cotacoes WHERE ${resumoWhere}
         GROUP BY status`,
      )
      .bind(...resumoParams)
      .all<{ status: string; quantidade: number; valor_total: number }>()

    return {
      cotacoes: results ?? [],
      total: Number(countRow?.c ?? 0),
      resumo: (resumoRows ?? []).map((r) => ({
        status: r.status,
        quantidade: Number(r.quantidade) || 0,
        valor_total: Number(r.valor_total) || 0,
      })),
    }
  }

  /**
   * Atualiza o status de várias cotações de uma vez.
   * Retorna quantas linhas foram realmente atualizadas (só do tenant).
   */
  async updateStatusBatch(
    ids: string[],
    status: CotacaoStatus,
    auditUserId: string | null,
  ): Promise<number> {
    if (ids.length === 0) return 0
    const now = new Date().toISOString()
    // D1 limita binds; lotes de 50 bastam para o painel de controle.
    let atualizadas = 0
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const placeholders = chunk.map(() => '?').join(', ')
      const result = await this.db
        .prepare(
          `UPDATE cotacoes SET status = ?, updated_at = ?, updated_by = ?
           WHERE tenant_id = ? AND id IN (${placeholders})`,
        )
        .bind(status, now, auditUserId, this.tenantId, ...chunk)
        .run()
      atualizadas += Number(result.meta?.changes ?? 0)
    }
    return atualizadas
  }

  async findWithItems(id: string): Promise<{ header: unknown; itens: unknown[] } | null> {
    const header = await this.prepareTenant(
      `SELECT co.*, p.nome as cliente, p.cpf_cnpj, p.email, p.telefone
       FROM cotacoes co
       LEFT JOIN pessoas p ON p.id = co.pessoa_id AND p.tenant_id = co.tenant_id
       WHERE co.id = ? AND co.tenant_id = ?`,
      [id],
    ).first()

    if (!header) return null

    const { results: itens } = await this.prepareTenant(
      `SELECT ci.*, pr.descricao as produto_nome, pr.codigo as produto_codigo,
              sv.descricao as servico_nome
       FROM cotacao_itens ci
       LEFT JOIN produtos pr ON pr.id = ci.produto_id AND pr.tenant_id = ci.tenant_id
       LEFT JOIN servicos sv ON sv.id = ci.servico_id AND sv.tenant_id = ci.tenant_id
       WHERE ci.cotacao_id = ? AND ci.tenant_id = ?`,
      [id],
    ).all()

    return { header, itens: itens ?? [] }
  }

  /**
   * Descobre o próximo número no formato `COT-NNNN` baseado no último
   * número salvo para o tenant. O formato é sequencial simples — se o
   * volume crescer, migrar para uma tabela de sequences server-side.
   */
  async nextNumero(): Promise<string> {
    const last = await this.prepareTenant(
      'SELECT numero FROM cotacoes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
    ).first<{ numero: string }>()
    const seq = last?.numero ? parseInt(last.numero.replace(/\D/g, '') || '0') + 1 : 1
    return `COT-${String(seq).padStart(4, '0')}`
  }

  /**
   * Cria cotação + itens em uma única batch atômica.
   */
  async createWithItens(
    header: CotacaoInsertRow,
    itens: CotacaoItemRow[],
  ): Promise<void> {
    const stmts = [this.insertHeaderStmt(header), ...this.insertItensStmts(header.id, itens, header.createdAt, header.auditUserId)]
    await this.db.batch(stmts)
  }

  /**
   * Atualiza header + itens (opcional). Quando `itens` é passado,
   * substitui integralmente o conjunto (DELETE + reinsert).
   */
  async updateWithItens(
    id: string,
    patch: CotacaoUpdatePatch,
    itens: CotacaoItemRow[] | null,
    auditUserId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()
    const stmts: D1PreparedStatement[] = []

    if (itens !== null) {
      stmts.push(
        this.db.prepare('DELETE FROM cotacao_itens WHERE cotacao_id = ? AND tenant_id = ?')
          .bind(id, this.tenantId),
      )
      stmts.push(...this.insertItensStmts(id, itens, now, auditUserId))
    }

    const frag = this.buildUpdateSet(patch, COTACAO_COLUMN_MAP)
    if (frag) {
      const sql = `UPDATE cotacoes SET ${frag.sql}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`
      stmts.push(
        this.db.prepare(sql).bind(...frag.values, now, auditUserId, id, this.tenantId),
      )
    } else {
      // Sem campos no header, mas ainda assim bump de updated_at.
      stmts.push(
        this.db
          .prepare('UPDATE cotacoes SET updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
          .bind(now, auditUserId, id, this.tenantId),
      )
    }

    await this.db.batch(stmts)
  }

  async delete(id: string): Promise<void> {
    // cotacao_itens tem ON DELETE CASCADE no schema — basta apagar o header.
    await this.db
      .prepare('DELETE FROM cotacoes WHERE id = ? AND tenant_id = ?')
      .bind(id, this.tenantId)
      .run()
  }

  // ─── Privados ────────────────────────────────────────────────────

  private insertHeaderStmt(row: CotacaoInsertRow): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO cotacoes (id, tenant_id, numero, tipo, pessoa_id, validade, observacoes, desconto, valor_total, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, this.tenantId, row.numero, row.tipo,
        row.pessoaId, row.validade, row.observacoes,
        row.desconto, row.valorTotal, row.status,
        row.createdAt, row.createdAt, row.auditUserId, row.auditUserId,
      )
  }

  private insertItensStmts(
    cotacaoId: string,
    itens: CotacaoItemRow[],
    now: string,
    auditUserId: string | null,
  ): D1PreparedStatement[] {
    return itens.map((item) => {
      const itemTotal = item.quantidade * item.valorUnitario - (item.desconto ?? 0)
      return this.db
        .prepare(
          `INSERT INTO cotacao_itens (id, cotacao_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, unidade, created_at, updated_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(), cotacaoId, this.tenantId,
          item.produtoId, item.servicoId,
          item.descricao, item.quantidade, item.valorUnitario, item.desconto ?? 0, itemTotal,
          item.unidade,
          now, now, auditUserId, auditUserId,
        )
    })
  }
}
