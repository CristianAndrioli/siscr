import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

const contaBancariaSchema = z.object({
  nome: z.string().min(2),
  banco_codigo: z.string().optional(),
  banco_nome: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo: z.enum(['corrente', 'poupanca', 'caixa', 'investimento']).default('corrente'),
  saldo_inicial: z.number().default(0),
  empresa_id: z.string().uuid().optional(),
  ativo: z.number().int().min(0).max(1).default(1),
})

// ─── Contas Bancárias ──────────────────────────────────────────────

app.get('/contas', async (c) => {
  const tenant = c.get('tenant')

  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.*,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.tenant_id = ? AND cb.ativo = 1
    GROUP BY cb.id
    ORDER BY cb.nome
  `).bind(tenant.tenantId).all()

  return c.json({ contas: results })
})

app.get('/contas/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.*,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.id = ? AND cb.tenant_id = ?
    GROUP BY cb.id
  `).bind(c.req.param('id'), tenant.tenantId).first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/contas', zValidator('json', contaBancariaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO contas_bancarias
      (id, tenant_id, empresa_id, nome, banco_codigo, banco_nome, agencia, conta,
       tipo, saldo_inicial, ativo, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).bind(
    id, tenant.tenantId, data.empresa_id ?? null,
    data.nome, data.banco_codigo ?? null, data.banco_nome ?? null,
    data.agencia ?? null, data.conta ?? null,
    data.tipo, data.saldo_inicial,
    now, now, uid, uid,
  ).run()

  return c.json({ id, message: 'Conta bancária criada.' }, 201)
})

app.put('/contas/:id', zValidator('json', contaBancariaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    nome: 'nome', banco_codigo: 'banco_codigo', banco_nome: 'banco_nome',
    agencia: 'agencia', conta: 'conta', tipo: 'tipo',
    saldo_inicial: 'saldo_inicial', ativo: 'ativo', empresa_id: 'empresa_id',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_bancarias SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/contas/:id', async (c) => {
  const tenant = c.get('tenant')
  // Soft delete — apenas desativa
  await c.env.DB_SHARED
    .prepare(`UPDATE contas_bancarias SET ativo = 0, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Conta desativada.' })
})

// ─── Movimentos bancários ──────────────────────────────────────────

app.get('/movimentos', async (c) => {
  const tenant = c.get('tenant')
  const { contaId, dataInicio, dataFim, tipo } = c.req.query()

  let query = `
    SELECT mb.*, cb.nome as conta_nome
    FROM movimentos_bancarios mb
    JOIN contas_bancarias cb ON cb.id = mb.conta_bancaria_id
    WHERE mb.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (contaId) { query += ' AND mb.conta_bancaria_id = ?'; params.push(contaId) }
  if (tipo) { query += ' AND mb.tipo = ?'; params.push(tipo) }
  if (dataInicio) { query += ' AND mb.data >= ?'; params.push(dataInicio) }
  if (dataFim) { query += ' AND mb.data <= ?'; params.push(dataFim) }

  query += ' ORDER BY mb.data DESC, mb.created_at DESC'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ movimentos: results })
})

// Movimento manual (lançamento direto sem título)
app.post('/movimentos', zValidator('json', z.object({
  conta_bancaria_id: z.string().uuid(),
  tipo: z.enum(['credito', 'debito']),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().optional(),
})), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Valida que a conta pertence ao tenant
  const conta = await c.env.DB_SHARED
    .prepare('SELECT id FROM contas_bancarias WHERE id = ? AND tenant_id = ? AND ativo = 1')
    .bind(data.conta_bancaria_id, tenant.tenantId).first()
  if (!conta) return c.json({ error: 'Conta bancária não encontrada.' }, 404)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO movimentos_bancarios
      (id, tenant_id, conta_bancaria_id, tipo, valor, data, descricao, origem_tipo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).bind(id, tenant.tenantId, data.conta_bancaria_id, data.tipo, data.valor, data.data, data.descricao ?? null, now, uid).run()

  return c.json({ id, message: 'Movimento lançado.' }, 201)
})

// ─── Saldos consolidados (para dashboard) ─────────────────────────

app.get('/saldos', async (c) => {
  const tenant = c.get('tenant')

  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.id, cb.nome, cb.tipo, cb.banco_nome, cb.agencia, cb.conta,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.tenant_id = ? AND cb.ativo = 1
    GROUP BY cb.id
    ORDER BY cb.tipo, cb.nome
  `).bind(tenant.tenantId).all()

  const totalDisponivel = (results as Array<{ saldo_atual: number }>)
    .filter(r => r.saldo_atual != null)
    .reduce((sum, r) => sum + (r.saldo_atual ?? 0), 0)

  return c.json({ contas: results, total_disponivel: totalDisponivel })
})

export default app
