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
}

export class CotacaoRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async list(filters: CotacaoListFilters): Promise<unknown[]> {
    let sql = `
      SELECT co.id, co.numero, co.status, co.validade, co.valor_total, co.created_at,
             p.nome as cliente
      FROM cotacoes co
      LEFT JOIN pessoas p ON p.id = co.pessoa_id AND p.tenant_id = co.tenant_id
      WHERE co.tenant_id = ?
    `
    const params: unknown[] = [this.tenantId]
    if (filters.status) { sql += ' AND co.status = ?'; params.push(filters.status) }
    if (filters.busca) {
      sql += ' AND (p.nome LIKE ? OR co.numero LIKE ?)'
      const like = `%${filters.busca}%`
      params.push(like, like)
    }
    sql += ' ORDER BY co.created_at DESC LIMIT 100'

    const { results } = await this.db.prepare(sql).bind(...params).all()
    return results ?? []
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
        `INSERT INTO cotacoes (id, tenant_id, numero, pessoa_id, validade, observacoes, desconto, valor_total, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, this.tenantId, row.numero,
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
