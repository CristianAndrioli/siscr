import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

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

// GET /api/tenant/vendas/pedidos
app.get('/pedidos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status, tipo } = c.req.query()

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

  query += ' ORDER BY pv.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ pedidos: results })
})

// POST /api/tenant/vendas/pedidos
app.post('/pedidos', zValidator('json', pedidoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')

  const pedidoId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Calcular total
  const total = data.itens.reduce((acc, item) => {
    return acc + (item.quantidade * item.precoUnitario) - item.desconto
  }, 0)

  // Buscar próximo número de pedido para o tenant
  const ultimoNumero = await c.env.DB_SHARED
    .prepare('SELECT MAX(numero) as ultimo FROM pedidos_venda WHERE tenant_id = ? AND empresa_id = ?')
    .bind(tenant.tenantId, data.empresaId)
    .first<{ ultimo: number | null }>()

  const numero = (ultimoNumero?.ultimo ?? 0) + 1

  const statements = [
    // Inserir pedido
    c.env.DB_SHARED.prepare(`
      INSERT INTO pedidos_venda (id, tenant_id, empresa_id, filial_id, cliente_id, usuario_id, numero, tipo, status, total, observacoes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(pedidoId, tenant.tenantId, data.empresaId, data.filialId, data.clienteId,
        user.userId, numero, data.tipo, 'rascunho', total, data.observacoes ?? null, now),

    // Inserir itens
    ...data.itens.map((item) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO itens_pedido (id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, desconto, subtotal, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, pedidoId, item.produtoId,
          item.quantidade, item.precoUnitario, item.desconto,
          (item.quantidade * item.precoUnitario) - item.desconto, now)
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
app.patch('/pedidos/:id/status', async (c) => {
  const tenant = c.get('tenant')
  const { status } = await c.req.json<{ status: string }>()

  const statusValidos = ['rascunho', 'confirmado', 'faturado', 'cancelado', 'entregue']
  if (!statusValidos.includes(status)) {
    return c.json({ error: 'Status inválido.' }, 400)
  }

  await c.env.DB_SHARED
    .prepare('UPDATE pedidos_venda SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind(status, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: `Pedido atualizado para "${status}".` })
})

export default app
