/**
 * routes/compras.ts
 *
 * Pedidos de compra + Recebimento — prefixo /tenant/compras
 * (gate 'faturamento', mesmo precedente de vendas.ts — não existe
 * módulo de permissão dedicado a compras/vendas no sistema).
 *
 * Espelha o fluxo de pedidos_venda: cabeçalho + itens gravados em
 * batch() atômico. Recebimento é parcial ou total — cada chamada a
 * POST /pedidos/:id/recebimentos soma quantidade_recebida por item,
 * gera uma entrada em movimentacoes_estoque/estoque (mesmo upsert de
 * routes/estoque.ts) e recalcula o status do pedido.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { csvAttachment, rowsToCsv } from '../lib/csv'

const app = new Hono<{ Bindings: Env }>()

const itemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
})

/** Sem filial o pedido é da matriz — string vazia vira `undefined`. */
const filialOpcional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().uuid().nullish(),
)

const pedidoSchema = z.object({
  empresaId: z.string().uuid(),
  filialId: filialOpcional,
  fornecedorId: z.string().uuid(),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).min(1),
})

const pedidoUpdateSchema = z
  .object({
    empresaId: z.string().uuid().optional(),
    filialId: filialOpcional,
    fornecedorId: z.string().uuid().optional(),
    observacoes: z.string().nullable().optional(),
    itens: z.array(itemSchema).min(1).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Informe ao menos um campo para atualizar.' })

type PedidoCompraRow = {
  id: string
  tenant_id: string
  empresa_id: string
  filial_id: string | null
  fornecedor_id: string
  numero: number
  status: string
  total: number
  observacoes: string | null
}

function transicaoPermitida(de: string, para: string): boolean {
  const map: Record<string, string[]> = {
    rascunho: ['confirmado', 'cancelado'],
    confirmado: ['cancelado'],
    recebido_parcial: [],
    recebido: [],
    cancelado: [],
  }
  return map[de]?.includes(para) ?? false
}

// GET /api/tenant/compras/pedidos
app.get('/pedidos', async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query()
  const { empresaId, filialId, status } = q
  const exportFmt = q.export

  let query = `
    SELECT pc.id, pc.numero, pc.status, pc.total, pc.created_at,
           p.nome as fornecedor
    FROM pedidos_compra pc
    JOIN pessoas p ON p.id = pc.fornecedor_id
    WHERE pc.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND pc.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND pc.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND pc.status = ?'; params.push(status) }

  query += ' ORDER BY pc.created_at DESC LIMIT 500'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()

  if (exportFmt === 'csv') {
    const header = ['id', 'numero', 'status', 'total', 'created_at', 'fornecedor']
    const body = rowsToCsv((results ?? []).map((r) => r as Record<string, unknown>), header)
    return csvAttachment(body, 'pedidos-compra.csv')
  }

  return c.json({ pedidos: results })
})

// POST /api/tenant/compras/pedidos
app.post('/pedidos', zValidator('json', pedidoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')

  const pedidoId = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const total = data.itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0)

  const ultimoNumero = await c.env.DB_SHARED
    .prepare('SELECT MAX(numero) as ultimo FROM pedidos_compra WHERE tenant_id = ? AND empresa_id = ?')
    .bind(tenant.tenantId, data.empresaId)
    .first<{ ultimo: number | null }>()

  const numero = (ultimoNumero?.ultimo ?? 0) + 1

  const statements = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO pedidos_compra (id, tenant_id, empresa_id, filial_id, fornecedor_id, usuario_id, numero, status, total, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?)
    `).bind(pedidoId, tenant.tenantId, data.empresaId, data.filialId ?? null, data.fornecedorId,
        user.userId, numero, total, data.observacoes ?? null, now, now, uid, uid),

    ...data.itens.map((item) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO itens_pedido_compra (id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, pedidoId, item.produtoId,
          item.quantidade, item.precoUnitario, item.quantidade * item.precoUnitario, now, now, uid, uid)
    ),
  ]

  await c.env.DB_SHARED.batch(statements)

  return c.json({ id: pedidoId, numero, total, message: 'Pedido de compra criado com sucesso.' }, 201)
})

// GET /api/tenant/compras/pedidos/:id
app.get('/pedidos/:id', async (c) => {
  const tenant = c.get('tenant')

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_compra WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)

  const { results: itens } = await c.env.DB_SHARED
    .prepare(`
      SELECT ip.*, p.descricao as produto_descricao, p.codigo as produto_codigo
      FROM itens_pedido_compra ip
      JOIN produtos p ON p.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `)
    .bind(c.req.param('id'))
    .all()

  return c.json({ pedido, itens })
})

// PATCH /api/tenant/compras/pedidos/:id — edição em rascunho
app.patch('/pedidos/:id', zValidator('json', pedidoUpdateSchema), async (c) => {
  const tenant = c.get('tenant')
  const pedidoId = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_compra WHERE id = ? AND tenant_id = ?')
    .bind(pedidoId, tenant.tenantId)
    .first<PedidoCompraRow>()

  if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)
  if (pedido.status !== 'rascunho') {
    return c.json({ error: 'Só é possível editar pedidos em rascunho.' }, 400)
  }

  const empresaId = data.empresaId ?? pedido.empresa_id
  const filialId = data.filialId === undefined ? pedido.filial_id : (data.filialId ?? null)
  const fornecedorId = data.fornecedorId ?? pedido.fornecedor_id
  const observacoes = data.observacoes === undefined ? pedido.observacoes : data.observacoes

  let total = pedido.total
  const stmts: D1PreparedStatement[] = []

  if (data.itens !== undefined) {
    total = data.itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0)
    stmts.push(
      c.env.DB_SHARED.prepare('DELETE FROM itens_pedido_compra WHERE pedido_id = ? AND tenant_id = ?').bind(pedidoId, tenant.tenantId),
    )
    for (const item of data.itens) {
      stmts.push(
        c.env.DB_SHARED.prepare(`
          INSERT INTO itens_pedido_compra (id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), tenant.tenantId, pedidoId, item.produtoId,
            item.quantidade, item.precoUnitario, item.quantidade * item.precoUnitario, now, now, uid, uid),
      )
    }
  }

  stmts.push(
    c.env.DB_SHARED.prepare(`
      UPDATE pedidos_compra SET empresa_id = ?, filial_id = ?, fornecedor_id = ?, total = ?, observacoes = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(empresaId, filialId, fornecedorId, total, observacoes, now, uid, pedidoId, tenant.tenantId),
  )

  await c.env.DB_SHARED.batch(stmts)

  return c.json({ id: pedidoId, total, message: 'Pedido de compra atualizado.' })
})

const patchStatusSchema = z.object({
  status: z.enum(['confirmado', 'cancelado']),
})

// PATCH /api/tenant/compras/pedidos/:id/status
app.patch('/pedidos/:id/status', zValidator('json', patchStatusSchema), async (c) => {
  const tenant = c.get('tenant')
  const pedidoId = c.req.param('id')
  const { status: novoStatus } = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_compra WHERE id = ? AND tenant_id = ?')
    .bind(pedidoId, tenant.tenantId)
    .first<PedidoCompraRow>()

  if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)

  if (!transicaoPermitida(pedido.status, novoStatus)) {
    return c.json({ error: `Transição de status não permitida: "${pedido.status}" → "${novoStatus}".` }, 400)
  }

  await c.env.DB_SHARED
    .prepare('UPDATE pedidos_compra SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
    .bind(novoStatus, now, uid, pedidoId, tenant.tenantId)
    .run()

  return c.json({ message: `Pedido atualizado para "${novoStatus}".` })
})

// GET /api/tenant/compras/pedidos/:id/recebimentos
app.get('/pedidos/:id/recebimentos', async (c) => {
  const tenant = c.get('tenant')
  const pedidoId = c.req.param('id')

  const { results } = await c.env.DB_SHARED
    .prepare('SELECT * FROM recebimentos_compra WHERE pedido_id = ? AND tenant_id = ? ORDER BY created_at DESC')
    .bind(pedidoId, tenant.tenantId)
    .all()

  const recebimentos = results ?? []
  for (const r of recebimentos as Record<string, unknown>[]) {
    const { results: itens } = await c.env.DB_SHARED
      .prepare(`
        SELECT ri.*, p.descricao as produto_descricao, p.codigo as produto_codigo
        FROM recebimento_itens ri
        JOIN itens_pedido_compra ip ON ip.id = ri.item_pedido_id
        JOIN produtos p ON p.id = ip.produto_id
        WHERE ri.recebimento_id = ?
      `)
      .bind(r.id as string)
      .all()
    r.itens = itens ?? []
  }

  return c.json({ recebimentos })
})

const recebimentoSchema = z.object({
  location: z.string().min(1).default('GERAL'),
  observacoes: z.string().optional(),
  itens: z.array(z.object({
    itemPedidoId: z.string().uuid(),
    quantidade: z.number().positive(),
  })).min(1),
})

// POST /api/tenant/compras/pedidos/:id/recebimentos
app.post('/pedidos/:id/recebimentos', zValidator('json', recebimentoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const pedidoId = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_compra WHERE id = ? AND tenant_id = ?')
    .bind(pedidoId, tenant.tenantId)
    .first<PedidoCompraRow>()

  if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)
  if (!['confirmado', 'recebido_parcial'].includes(pedido.status)) {
    return c.json({ error: 'Só é possível registrar recebimento em pedidos confirmados.' }, 400)
  }

  const { results: itensPedido } = await c.env.DB_SHARED
    .prepare('SELECT * FROM itens_pedido_compra WHERE pedido_id = ? AND tenant_id = ?')
    .bind(pedidoId, tenant.tenantId)
    .all<{ id: string; produto_id: string; quantidade: number; quantidade_recebida: number }>()

  const itensMap = new Map((itensPedido ?? []).map((it) => [it.id, it]))

  for (const linha of data.itens) {
    const item = itensMap.get(linha.itemPedidoId)
    if (!item) return c.json({ error: 'Item do pedido não encontrado.' }, 400)
    const restante = item.quantidade - item.quantidade_recebida
    if (linha.quantidade > restante) {
      return c.json(
        { error: `Quantidade a receber maior que a pendente para o item.`, itemPedidoId: item.id, pendente: restante },
        400,
      )
    }
  }

  const recebimentoId = crypto.randomUUID()
  const stmts: D1PreparedStatement[] = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO recebimentos_compra (id, tenant_id, pedido_id, location, observacoes, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(recebimentoId, tenant.tenantId, pedidoId, data.location, data.observacoes ?? null, now, uid),
  ]

  for (const linha of data.itens) {
    const item = itensMap.get(linha.itemPedidoId)!

    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO recebimento_itens (id, tenant_id, recebimento_id, item_pedido_id, quantidade, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, recebimentoId, item.id, linha.quantidade, now),

      c.env.DB_SHARED.prepare(`
        UPDATE itens_pedido_compra SET quantidade_recebida = quantidade_recebida + ?, updated_at = ?, updated_by = ?
        WHERE id = ? AND tenant_id = ?
      `).bind(linha.quantidade, now, uid, item.id, tenant.tenantId),

      c.env.DB_SHARED.prepare(`
        INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, tipo, quantidade, location, motivo, usuario_id, created_at, created_by, updated_by, updated_at)
        VALUES (?, ?, ?, 'entrada', ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, item.produto_id, linha.quantidade, data.location,
          `Recebimento de pedido de compra nº ${pedido.numero}`, user?.userId ?? null, now, uid, uid, now),

      c.env.DB_SHARED.prepare(`
        INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
          quantidade = quantidade + ?,
          updated_at = ?,
          updated_by = ?
      `).bind(crypto.randomUUID(), tenant.tenantId, item.produto_id, data.location, linha.quantidade,
          now, now, uid, uid, linha.quantidade, now, uid),
    )
  }

  // Recalcula status do pedido a partir do total recebido por item (considerando as quantidades já somadas nesta chamada).
  const recebidoPorItem = new Map<string, number>()
  for (const it of itensPedido ?? []) recebidoPorItem.set(it.id, it.quantidade_recebida)
  for (const linha of data.itens) {
    recebidoPorItem.set(linha.itemPedidoId, (recebidoPorItem.get(linha.itemPedidoId) ?? 0) + linha.quantidade)
  }
  const totalmenteRecebido = (itensPedido ?? []).every((it) => (recebidoPorItem.get(it.id) ?? 0) >= it.quantidade)
  const novoStatus = totalmenteRecebido ? 'recebido' : 'recebido_parcial'

  stmts.push(
    c.env.DB_SHARED.prepare('UPDATE pedidos_compra SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
      .bind(novoStatus, now, uid, pedidoId, tenant.tenantId),
  )

  await c.env.DB_SHARED.batch(stmts)

  return c.json({ id: recebimentoId, status: novoStatus, message: 'Recebimento registrado.' }, 201)
})

export default app
