import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { parseListPagination } from '../lib/listPagination'

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

/** Lista erros do tenant paginados (sem stack_trace). Filtro opcional por trecho da URL da tela. */
app.get('/errors', async (c) => {
  const tenant = c.get('tenant')
  const { limit, offset, page } = parseListPagination(c)
  const urlContains = (c.req.query('urlContains') || '').trim().slice(0, 200)

  const where = urlContains
    ? 'WHERE tenant_id = ? AND url LIKE ?'
    : 'WHERE tenant_id = ?'
  const like = urlContains ? `%${urlContains}%` : null
  const countBind = like ? [tenant.tenantId, like] : [tenant.tenantId]
  const listBind = like
    ? [tenant.tenantId, like, limit, offset]
    : [tenant.tenantId, limit, offset]

  const countRow = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c FROM error_logs ${where}`)
    .bind(...countBind)
    .first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)

  const { results } = await c.env.DB_SHARED
    .prepare(
      `
      SELECT id, timestamp, friendly_message, technical, url, context, created_at
      FROM error_logs
      ${where}
      ORDER BY created_at DESC, timestamp DESC
      LIMIT ? OFFSET ?
    `,
    )
    .bind(...listBind)
    .all()

  return c.json({ errors: results, total, page, limit })
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
