import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /api/tenant/estoque — posição de estoque
app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, produtoId } = c.req.query()

  let query = `
    SELECT e.id, e.produto_id, p.descricao as produto_descricao, p.codigo as produto_codigo,
           e.filial_id, f.nome as filial_nome, e.location, e.quantidade, e.updated_at
    FROM estoque e
    JOIN produtos p ON p.id = e.produto_id
    JOIN filiais f ON f.id = e.filial_id
    WHERE e.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND e.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND e.filial_id = ?'; params.push(filialId) }
  if (produtoId) { query += ' AND e.produto_id = ?'; params.push(produtoId) }

  query += ' ORDER BY p.descricao'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ estoque: results })
})

// POST /api/tenant/estoque/movimentacao — entrada ou saída
const movimentacaoSchema = z.object({
  produtoId: z.string().uuid(),
  empresaId: z.string().uuid(),
  filialId: z.string().uuid(),
  tipo: z.enum(['entrada', 'saida', 'transferencia', 'ajuste']),
  quantidade: z.number().positive(),
  motivo: z.string().optional(),
  referenciaId: z.string().optional(),
  location: z.string().optional(),
})

app.post('/movimentacao', zValidator('json', movimentacaoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const qtdDelta = data.tipo === 'saida' ? -data.quantidade : data.quantidade

  await c.env.DB_SHARED.batch([
    // Registrar movimentação
    c.env.DB_SHARED.prepare(`
      INSERT INTO movimentacoes_estoque (id, tenant_id, empresa_id, filial_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, tenant.tenantId, data.empresaId, data.filialId, data.produtoId,
        data.tipo, data.quantidade, data.motivo ?? null, data.referenciaId ?? null, user.userId, now),

    // Atualizar saldo em estoque (INSERT OR REPLACE)
    c.env.DB_SHARED.prepare(`
      INSERT INTO estoque (id, tenant_id, empresa_id, filial_id, produto_id, location, quantidade, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, filial_id, produto_id) DO UPDATE SET
        quantidade = quantidade + ?,
        updated_at = ?
    `).bind(crypto.randomUUID(), tenant.tenantId, data.empresaId, data.filialId,
        data.produtoId, data.location ?? 'GERAL', data.quantidade, now, qtdDelta, now),
  ])

  return c.json({ id, message: 'Movimentação registrada.' }, 201)
})

// GET /api/tenant/estoque/movimentacoes
app.get('/movimentacoes', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, produtoId, tipo } = c.req.query()

  let query = `
    SELECT m.id, m.tipo, m.quantidade, m.motivo, m.created_at,
           p.descricao as produto, f.nome as filial
    FROM movimentacoes_estoque m
    JOIN produtos p ON p.id = m.produto_id
    JOIN filiais f ON f.id = m.filial_id
    WHERE m.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND m.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND m.filial_id = ?'; params.push(filialId) }
  if (produtoId) { query += ' AND m.produto_id = ?'; params.push(produtoId) }
  if (tipo) { query += ' AND m.tipo = ?'; params.push(tipo) }

  query += ' ORDER BY m.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ movimentacoes: results })
})

export default app
