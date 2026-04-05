import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { csvAttachment, rowsToCsv } from '../lib/csv'

const app = new Hono<{ Bindings: Env }>()

const contaSchema = z.object({
  pessoaId: z.string().uuid(),
  descricao: z.string().min(2),
  valor: z.number().positive(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.string().optional(),
  observacoes: z.string().optional(),
  empresaId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
})

// ─── Contas a Receber ─────────────────────────────────────────────

app.get('/receber', async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query()
  const { empresaId, filialId, status, vencidoAte, pedidoId } = q
  const exportFmt = q.export

  let query = `
    SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status,
           cr.categoria, cr.observacoes, cr.data_pagamento, cr.valor_pago,
           cr.created_at, cr.pessoa_id, cr.pedido_id,
           p.nome as cliente
    FROM contas_receber cr
    LEFT JOIN pessoas p ON p.id = cr.pessoa_id
    WHERE cr.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND cr.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND cr.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND cr.status = ?'; params.push(status) }
  if (pedidoId) { query += ' AND cr.pedido_id = ?'; params.push(pedidoId) }
  if (vencidoAte) { query += ' AND cr.vencimento <= ? AND cr.status != ?'; params.push(vencidoAte, 'pago') }

  query += ' ORDER BY cr.vencimento'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()

  if (exportFmt === 'csv') {
    const cols = [
      'id',
      'descricao',
      'valor',
      'vencimento',
      'status',
      'categoria',
      'pessoa_id',
      'pedido_id',
      'cliente',
      'data_pagamento',
      'valor_pago',
    ]
    const rows = (results ?? []).map((r) => r as Record<string, unknown>)
    return csvAttachment(rowsToCsv(rows, cols), 'contas_receber.csv')
  }

  return c.json({ contas: results })
})

app.get('/receber/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare(`
      SELECT cr.*, p.nome as cliente
      FROM contas_receber cr
      LEFT JOIN pessoas p ON p.id = cr.pessoa_id
      WHERE cr.id = ? AND cr.tenant_id = ?
    `)
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/receber', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_receber
        (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status, categoria, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.pessoaId, data.descricao, data.valor, data.vencimento,
      data.categoria ?? null, data.observacoes ?? null,
      now, now, uid, uid,
    )
    .run()

  return c.json({ id, message: 'Conta a receber criada.' }, 201)
})

app.put('/receber/:id', zValidator('json', contaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    pessoaId: 'pessoa_id', descricao: 'descricao', valor: 'valor',
    vencimento: 'vencimento', categoria: 'categoria', observacoes: 'observacoes',
    empresaId: 'empresa_id', filialId: 'filial_id',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_receber SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/receber/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM contas_receber WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

app.patch('/receber/:id/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { dataPagamento, valorPago } = await c.req.json<{ dataPagamento: string; valorPago: number }>()

  await c.env.DB_SHARED
    .prepare(`
      UPDATE contas_receber
      SET status = 'pago', data_pagamento = ?, valor_pago = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(dataPagamento, valorPago, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Pagamento registrado.' })
})

// ─── Contas a Pagar ───────────────────────────────────────────────

app.get('/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status } = c.req.query()

  let query = `
    SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, cp.status,
           cp.categoria, cp.observacoes, cp.data_pagamento, cp.valor_pago,
           cp.created_at, cp.pessoa_id,
           p.nome as fornecedor
    FROM contas_pagar cp
    LEFT JOIN pessoas p ON p.id = cp.pessoa_id
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

app.get('/pagar/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare(`
      SELECT cp.*, p.nome as fornecedor
      FROM contas_pagar cp
      LEFT JOIN pessoas p ON p.id = cp.pessoa_id
      WHERE cp.id = ? AND cp.tenant_id = ?
    `)
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/pagar', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_pagar
        (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status, categoria, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.pessoaId, data.descricao, data.valor, data.vencimento,
      data.categoria ?? null, data.observacoes ?? null,
      now, now, uid, uid,
    )
    .run()

  return c.json({ id, message: 'Conta a pagar criada.' }, 201)
})

app.put('/pagar/:id', zValidator('json', contaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    pessoaId: 'pessoa_id', descricao: 'descricao', valor: 'valor',
    vencimento: 'vencimento', categoria: 'categoria', observacoes: 'observacoes',
    empresaId: 'empresa_id', filialId: 'filial_id',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_pagar SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/pagar/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM contas_pagar WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

app.patch('/pagar/:id/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { dataPagamento, valorPago } = await c.req.json<{ dataPagamento: string; valorPago: number }>()

  await c.env.DB_SHARED
    .prepare(`
      UPDATE contas_pagar
      SET status = 'pago', data_pagamento = ?, valor_pago = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(dataPagamento, valorPago, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Pagamento registrado.' })
})

// ─── Dashboard ────────────────────────────────────────────────────

app.get('/dashboard', async (c) => {
  const tenant = c.get('tenant')

  const [receber, pagar, vencerEm7, vencerPagar7] = await Promise.all([
    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as recebido,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido,
        COUNT(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN 1 END) as qtd_vencido
      FROM contas_receber WHERE tenant_id = ?
    `).bind(tenant.tenantId).first(),

    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as pago,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido,
        COUNT(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN 1 END) as qtd_vencido
      FROM contas_pagar WHERE tenant_id = ?
    `).bind(tenant.tenantId).first(),

    // Próximos vencimentos CR (7 dias)
    c.env.DB_SHARED.prepare(`
      SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, p.nome as cliente
      FROM contas_receber cr
      LEFT JOIN pessoas p ON p.id = cr.pessoa_id
      WHERE cr.tenant_id = ? AND cr.status = 'pendente'
        AND cr.vencimento BETWEEN date('now') AND date('now', '+7 days')
      ORDER BY cr.vencimento LIMIT 5
    `).bind(tenant.tenantId).all(),

    c.env.DB_SHARED.prepare(`
      SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, p.nome as fornecedor
      FROM contas_pagar cp
      LEFT JOIN pessoas p ON p.id = cp.pessoa_id
      WHERE cp.tenant_id = ? AND cp.status = 'pendente'
        AND cp.vencimento BETWEEN date('now') AND date('now', '+7 days')
      ORDER BY cp.vencimento LIMIT 5
    `).bind(tenant.tenantId).all(),
  ])

  return c.json({
    receber,
    pagar,
    proximosVencimentosCR: vencerEm7.results,
    proximosVencimentosCP: vencerPagar7.results,
  })
})

export default app
