/** Núcleo operacional: baixa/estorno de estoque por pedido e regras de local padrão. */

const TIPO_SAIDA_PEDIDO = 'pedido_saida'
const TIPO_ESTORNO_PEDIDO = 'pedido_estorno'

export const LOCATION_PEDIDO_DEFAULT = 'GERAL'

export async function pedidoTemBaixaEstoque(
  db: D1Database,
  tenantId: string,
  pedidoId: string,
): Promise<boolean> {
  const r = await db
    .prepare(
      `SELECT 1 AS x FROM movimentacoes_estoque
       WHERE tenant_id = ? AND referencia_id = ? AND tipo = ? LIMIT 1`,
    )
    .bind(tenantId, pedidoId, TIPO_SAIDA_PEDIDO)
    .first<{ x: number }>()
  return !!r
}

/** Local usado na baixa (todas as linhas do mesmo pedido usam o mesmo local). */
export async function locationDaBaixaPedido(
  db: D1Database,
  tenantId: string,
  pedidoId: string,
): Promise<string | null> {
  const r = await db
    .prepare(
      `SELECT location FROM movimentacoes_estoque
       WHERE tenant_id = ? AND referencia_id = ? AND tipo = ? LIMIT 1`,
    )
    .bind(tenantId, pedidoId, TIPO_SAIDA_PEDIDO)
    .first<{ location: string }>()
  return r?.location ?? null
}

export async function contaReceberJaExisteParaPedido(
  db: D1Database,
  tenantId: string,
  pedidoId: string,
): Promise<boolean> {
  const r = await db
    .prepare(`SELECT 1 AS x FROM contas_receber WHERE tenant_id = ? AND pedido_id = ? LIMIT 1`)
    .bind(tenantId, pedidoId)
    .first<{ x: number }>()
  return !!r
}

export type ItemQuantidade = { produtoId: string; quantidade: number }

export async function assertSaldoParaItens(
  db: D1Database,
  tenantId: string,
  items: ItemQuantidade[],
  location: string,
): Promise<
  | { ok: true }
  | { ok: false; produtoId: string; disponivel: number; necessario: number }
> {
  for (const it of items) {
    const row = await db
      .prepare(
        `SELECT quantidade FROM estoque WHERE tenant_id = ? AND produto_id = ? AND location = ?`,
      )
      .bind(tenantId, it.produtoId, location)
      .first<{ quantidade: number }>()
    const disp = row?.quantidade ?? 0
    if (disp < it.quantidade) {
      return { ok: false, produtoId: it.produtoId, disponivel: disp, necessario: it.quantidade }
    }
  }
  return { ok: true }
}

export async function baixarEstoquePedido(
  db: D1Database,
  params: {
    tenantId: string
    pedidoId: string
    items: ItemQuantidade[]
    location: string
    usuarioId: string | null
    auditUserId: string | null
    now: string
  },
): Promise<void> {
  const { tenantId, pedidoId, items, location, usuarioId, auditUserId, now } = params
  const stmts: D1PreparedStatement[] = []
  for (const it of items) {
    const movId = crypto.randomUUID()
    stmts.push(
      db
        .prepare(
          `INSERT INTO movimentacoes_estoque
            (id, tenant_id, produto_id, tipo, quantidade, location, motivo, referencia_id, usuario_id, created_at, created_by, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          movId,
          tenantId,
          it.produtoId,
          TIPO_SAIDA_PEDIDO,
          it.quantidade,
          location,
          'Baixa por confirmação de pedido',
          pedidoId,
          usuarioId,
          now,
          auditUserId,
          auditUserId,
          now,
        ),
    )
    const qtdDelta = -it.quantidade
    stmts.push(
      db
        .prepare(
          `INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
             quantidade = quantidade + ?,
             updated_at = ?,
             updated_by = ?`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          it.produtoId,
          location,
          it.quantidade,
          now,
          now,
          auditUserId,
          auditUserId,
          qtdDelta,
          now,
          auditUserId,
        ),
    )
  }
  await db.batch(stmts)
}

export async function estornarEstoquePedido(
  db: D1Database,
  params: {
    tenantId: string
    pedidoId: string
    items: ItemQuantidade[]
    location: string
    usuarioId: string | null
    auditUserId: string | null
    now: string
  },
): Promise<void> {
  const { tenantId, pedidoId, items, location, usuarioId, auditUserId, now } = params
  const stmts: D1PreparedStatement[] = []
  for (const it of items) {
    const movId = crypto.randomUUID()
    stmts.push(
      db
        .prepare(
          `INSERT INTO movimentacoes_estoque
            (id, tenant_id, produto_id, tipo, quantidade, location, motivo, referencia_id, usuario_id, created_at, created_by, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          movId,
          tenantId,
          it.produtoId,
          TIPO_ESTORNO_PEDIDO,
          it.quantidade,
          location,
          'Estorno por cancelamento de pedido',
          pedidoId,
          usuarioId,
          now,
          auditUserId,
          auditUserId,
          now,
        ),
    )
    stmts.push(
      db
        .prepare(
          `INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
             quantidade = quantidade + ?,
             updated_at = ?,
             updated_by = ?`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          it.produtoId,
          location,
          it.quantidade,
          now,
          now,
          auditUserId,
          auditUserId,
          it.quantidade,
          now,
          auditUserId,
        ),
    )
  }
  await db.batch(stmts)
}

export function defaultVencimentoTitulo(dias = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
