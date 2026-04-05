import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import {
  assertSaldoParaItens,
  baixarEstoquePedido,
  contaReceberJaExisteParaPedido,
  defaultVencimentoTitulo,
  estornarEstoquePedido,
  LOCATION_PEDIDO_DEFAULT,
  locationDaBaixaPedido,
  pedidoTemBaixaEstoque,
} from '../lib/pedidoEstoqueFinanceiro'

const app = new Hono<{ Bindings: Env }>()

const itemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().positive(),
  precoUnitario: z.number().positive(),
  desconto: z.number().nonnegative().default(0),
})

const pedidoSchema = z.object({
  empresaId: z.string().uuid(),
  filialId: z.string().uuid(),
  clienteId: z.string().uuid(),
  tipo: z.enum(['pedido', 'orcamento']).default('pedido'),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).min(1),
})

const patchStatusSchema = z.object({
  status: z.enum(['rascunho', 'confirmado', 'faturado', 'cancelado', 'entregue']),
  /** Ao faturar: data de vencimento do título (AAAA-MM-DD). Default: +30 dias. */
  vencimentoTitulo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Local de estoque para baixa (pedidos tipo `pedido`). Default: GERAL */
  locationEstoque: z.string().min(1).max(80).optional(),
})

type PedidoRow = {
  id: string
  tenant_id: string
  empresa_id: string
  filial_id: string
  cliente_id: string
  numero: number
  tipo: string
  status: string
  total: number
}

function transicaoPermitida(de: string, para: string): boolean {
  const map: Record<string, string[]> = {
    rascunho: ['confirmado', 'cancelado'],
    confirmado: ['faturado', 'cancelado', 'entregue'],
    entregue: ['faturado', 'cancelado'],
    faturado: ['entregue'],
    cancelado: [],
  }
  return map[de]?.includes(para) ?? false
}

function csvCell(v: unknown): string {
  const t = v === null || v === undefined ? '' : String(v)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

// GET /api/tenant/vendas/pedidos
app.get('/pedidos', async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query()
  const { empresaId, filialId, status, tipo } = q
  const exportFmt = q.export

  let query = `
    SELECT pv.id, pv.numero, pv.tipo, pv.status, pv.total, pv.created_at,
           p.nome as cliente
    FROM pedidos_venda pv
    JOIN pessoas p ON p.id = pv.cliente_id
    WHERE pv.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND pv.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND pv.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND pv.status = ?'; params.push(status) }
  if (tipo) { query += ' AND pv.tipo = ?'; params.push(tipo) }

  query += ' ORDER BY pv.created_at DESC LIMIT 500'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()

  if (exportFmt === 'csv') {
    const rows = results ?? []
    const header = ['id', 'numero', 'tipo', 'status', 'total', 'created_at', 'cliente']
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        header.map((h) => csvCell((r as Record<string, unknown>)[h])).join(','),
      ),
    ]
    const body = lines.join('\r\n')
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="pedidos.csv"',
      },
    })
  }

  return c.json({ pedidos: results })
})

// POST /api/tenant/vendas/pedidos
app.post('/pedidos', zValidator('json', pedidoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')

  const pedidoId = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const total = data.itens.reduce((acc, item) => {
    return acc + (item.quantidade * item.precoUnitario) - item.desconto
  }, 0)

  const ultimoNumero = await c.env.DB_SHARED
    .prepare('SELECT MAX(numero) as ultimo FROM pedidos_venda WHERE tenant_id = ? AND empresa_id = ?')
    .bind(tenant.tenantId, data.empresaId)
    .first<{ ultimo: number | null }>()

  const numero = (ultimoNumero?.ultimo ?? 0) + 1

  const statements = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO pedidos_venda (id, tenant_id, empresa_id, filial_id, cliente_id, usuario_id, numero, tipo, status, total, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(pedidoId, tenant.tenantId, data.empresaId, data.filialId, data.clienteId,
        user.userId, numero, data.tipo, 'rascunho', total, data.observacoes ?? null, now, now, uid, uid),

    ...data.itens.map((item) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO itens_pedido (id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, pedidoId, item.produtoId,
          item.quantidade, item.precoUnitario, item.desconto,
          (item.quantidade * item.precoUnitario) - item.desconto, now, now, uid, uid)
    ),
  ]

  await c.env.DB_SHARED.batch(statements)

  return c.json({ id: pedidoId, numero, total, message: 'Pedido criado com sucesso.' }, 201)
})

// GET /api/tenant/vendas/pedidos/:id
app.get('/pedidos/:id', async (c) => {
  const tenant = c.get('tenant')

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_venda WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!pedido) return c.json({ error: 'Pedido não encontrado.' }, 404)

  const { results: itens } = await c.env.DB_SHARED
    .prepare(`
      SELECT ip.*, p.descricao as produto_descricao, p.codigo as produto_codigo
      FROM itens_pedido ip
      JOIN produtos p ON p.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `)
    .bind(c.req.param('id'))
    .all()

  return c.json({ pedido, itens })
})

// PATCH /api/tenant/vendas/pedidos/:id/status
app.patch('/pedidos/:id/status', zValidator('json', patchStatusSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const pedidoId = c.req.param('id')
  const body = c.req.valid('json')
  const { status: novoStatus, vencimentoTitulo, locationEstoque } = body
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const loc = locationEstoque ?? LOCATION_PEDIDO_DEFAULT

  const pedido = await c.env.DB_SHARED
    .prepare('SELECT * FROM pedidos_venda WHERE id = ? AND tenant_id = ?')
    .bind(pedidoId, tenant.tenantId)
    .first<PedidoRow>()

  if (!pedido) return c.json({ error: 'Pedido não encontrado.' }, 404)

  const atual = pedido.status
  if (atual === novoStatus) {
    return c.json({ error: `O pedido já está com status "${atual}".` }, 400)
  }

  if (!transicaoPermitida(atual, novoStatus)) {
    return c.json(
      { error: `Transição de status não permitida: "${atual}" → "${novoStatus}".` },
      400,
    )
  }

  const { results: itemList } = await c.env.DB_SHARED
    .prepare(
      'SELECT produto_id as produtoId, quantidade FROM itens_pedido WHERE pedido_id = ? AND tenant_id = ?',
    )
    .bind(pedidoId, tenant.tenantId)
    .all<{ produtoId: string; quantidade: number }>()

  const itens = itemList ?? []

  // ─── confirmado: baixa estoque (somente tipo pedido) ─────────────
  if (novoStatus === 'confirmado') {
    if (await pedidoTemBaixaEstoque(c.env.DB_SHARED, tenant.tenantId, pedidoId)) {
      return c.json({ error: 'Este pedido já teve baixa de estoque registrada.' }, 400)
    }

    if (pedido.tipo === 'pedido') {
      const chk = await assertSaldoParaItens(c.env.DB_SHARED, tenant.tenantId, itens, loc)
      if (!chk.ok) {
        return c.json(
          {
            error: 'Saldo insuficiente para confirmar o pedido.',
            produtoId: chk.produtoId,
            disponivel: chk.disponivel,
            necessario: chk.necessario,
            location: loc,
          },
          400,
        )
      }

      await baixarEstoquePedido(c.env.DB_SHARED, {
        tenantId: tenant.tenantId,
        pedidoId,
        items: itens,
        location: loc,
        usuarioId: user.userId ?? null,
        auditUserId: uid,
        now,
      })
    }
  }

  // ─── cancelado: estorno se houve baixa (mesmo local da baixa) ───
  if (novoStatus === 'cancelado') {
    if (await pedidoTemBaixaEstoque(c.env.DB_SHARED, tenant.tenantId, pedidoId)) {
      const locEstorno =
        (await locationDaBaixaPedido(c.env.DB_SHARED, tenant.tenantId, pedidoId)) ??
        loc
      await estornarEstoquePedido(c.env.DB_SHARED, {
        tenantId: tenant.tenantId,
        pedidoId,
        items: itens,
        location: locEstorno,
        usuarioId: user.userId ?? null,
        auditUserId: uid,
        now,
      })
    }
  }

  // ─── faturado: título a receber (idempotente por pedido) ────────
  if (novoStatus === 'faturado') {
    if (await contaReceberJaExisteParaPedido(c.env.DB_SHARED, tenant.tenantId, pedidoId)) {
      await c.env.DB_SHARED
        .prepare('UPDATE pedidos_venda SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
        .bind(novoStatus, now, uid, pedidoId, tenant.tenantId)
        .run()
      return c.json({
        message: `Pedido atualizado para "${novoStatus}". Título a receber já existia para este pedido.`,
      })
    }

    const venc = vencimentoTitulo ?? defaultVencimentoTitulo(30)
    const contaId = crypto.randomUUID()
    const descricao = `Pedido nº ${pedido.numero}`

    await c.env.DB_SHARED.batch([
      c.env.DB_SHARED.prepare(`
        INSERT INTO contas_receber
          (id, tenant_id, empresa_id, filial_id, pessoa_id, pedido_id, descricao, valor, vencimento, status, categoria, observacoes, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)
      `).bind(
        contaId,
        tenant.tenantId,
        pedido.empresa_id,
        pedido.filial_id,
        pedido.cliente_id,
        pedidoId,
        descricao,
        pedido.total,
        venc,
        'Vendas',
        null,
        now,
        now,
        uid,
        uid,
      ),
      c.env.DB_SHARED.prepare(
        'UPDATE pedidos_venda SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?',
      ).bind(novoStatus, now, uid, pedidoId, tenant.tenantId),
    ])

    return c.json({
      message: `Pedido faturado. Título a receber criado (vencimento ${venc}).`,
      contaReceberId: contaId,
    })
  }

  await c.env.DB_SHARED
    .prepare('UPDATE pedidos_venda SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
    .bind(novoStatus, now, uid, pedidoId, tenant.tenantId)
    .run()

  return c.json({ message: `Pedido atualizado para "${novoStatus}".` })
})

export default app
