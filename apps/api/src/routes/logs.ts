import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

const logSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  friendlyMessage: z.string().max(500),
  technical: z.string().max(4000).optional(),
  stackTrace: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  context: z.string().max(200).optional(),
})

/** Registra um erro enviado pelo frontend */
app.post('/errors', zValidator('json', logSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO error_logs (id, tenant_id, timestamp, friendly_message, technical, stack_trace, url, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      data.id,
      tenant.tenantId,
      data.timestamp,
      data.friendlyMessage,
      data.technical ?? null,
      data.stackTrace ?? null,
      data.url ?? null,
      data.context ?? null,
      now,
    )
    .run()

  return c.json({ ok: true }, 201)
})

/** Lista os últimos 200 erros do tenant (sem stack_trace) */
app.get('/errors', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare(`
      SELECT id, timestamp, friendly_message, technical, url, context, created_at
      FROM error_logs
      WHERE tenant_id = ?
      ORDER BY timestamp DESC
      LIMIT 200
    `)
    .bind(tenant.tenantId)
    .all()

  return c.json({ errors: results })
})

/** Detalhe de um erro (sem stack_trace) */
app.get('/errors/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare(`
      SELECT id, timestamp, friendly_message, technical, url, context, created_at
      FROM error_logs
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Registro não encontrado.' }, 404)
  return c.json(result)
})

/** Limpa todos os erros do tenant */
app.delete('/errors', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM error_logs WHERE tenant_id = ?')
    .bind(tenant.tenantId)
    .run()

  return c.json({ ok: true })
})

export default app
