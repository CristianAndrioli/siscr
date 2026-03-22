import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

const contaSchema = z.object({
  empresaId: z.string().uuid(),
  filialId: z.string().uuid(),
  pessoaId: z.string().uuid(),
  descricao: z.string().min(2),
  valor: z.number().positive(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.string().optional(),
  observacoes: z.string().optional(),
})

// ─── Contas a Receber ─────────────────────────────────────────────

app.get('/receber', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status, vencidoAte } = c.req.query()

  let query = `
    SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, cr.created_at,
           p.nome as cliente
    FROM contas_receber cr
    JOIN pessoas p ON p.id = cr.pessoa_id
    WHERE cr.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND cr.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND cr.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND cr.status = ?'; params.push(status) }
  if (vencidoAte) { query += ' AND cr.vencimento <= ? AND cr.status != ?'; params.push(vencidoAte, 'pago') }

  query += ' ORDER BY cr.vencimento'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ contas: results })
})

app.post('/receber', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_receber (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status, categoria, observacoes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(id, tenant.tenantId, data.empresaId, data.filialId, data.pessoaId,
      data.descricao, data.valor, data.vencimento, 'pendente',
      data.categoria ?? null, data.observacoes ?? null, new Date().toISOString())
    .run()

  return c.json({ id, message: 'Conta a receber criada.' }, 201)
})

// PATCH /api/tenant/financeiro/receber/:id/pagar
app.patch('/receber/:id/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { dataPagamento, valorPago } = await c.req.json<{ dataPagamento: string; valorPago: number }>()

  await c.env.DB_SHARED
    .prepare(`
      UPDATE contas_receber
      SET status = 'pago', data_pagamento = ?, valor_pago = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(dataPagamento, valorPago, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Pagamento registrado.' })
})

// ─── Contas a Pagar ───────────────────────────────────────────────

app.get('/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status } = c.req.query()

  let query = `
    SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, cp.status, cp.created_at,
           p.nome as fornecedor
    FROM contas_pagar cp
    JOIN pessoas p ON p.id = cp.pessoa_id
    WHERE cp.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND cp.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND cp.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND cp.status = ?'; params.push(status) }

  query += ' ORDER BY cp.vencimento'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ contas: results })
})

app.post('/pagar', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_pagar (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status, categoria, observacoes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(id, tenant.tenantId, data.empresaId, data.filialId, data.pessoaId,
      data.descricao, data.valor, data.vencimento, 'pendente',
      data.categoria ?? null, data.observacoes ?? null, new Date().toISOString())
    .run()

  return c.json({ id, message: 'Conta a pagar criada.' }, 201)
})

// GET /api/tenant/financeiro/dashboard — resumo financeiro
app.get('/dashboard', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId } = c.req.query()

  const params: unknown[] = [tenant.tenantId, tenant.tenantId]
  const empresaFilter = empresaId ? 'AND empresa_id = ?' : ''
  if (empresaId) { params.push(empresaId, empresaId) }

  const [receber, pagar] = await Promise.all([
    c.env.DB_SHARED.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as recebido,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido
      FROM contas_receber WHERE tenant_id = ? ${empresaFilter}
    `).bind(...params.slice(0, empresaId ? 2 : 1)).first(),

    c.env.DB_SHARED.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as pago,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido
      FROM contas_pagar WHERE tenant_id = ? ${empresaFilter}
    `).bind(...params.slice(0, empresaId ? 2 : 1)).first(),
  ])

  return c.json({ receber, pagar })
})

export default app
