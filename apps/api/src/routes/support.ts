import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { ensureSupportSeed } from '../lib/supportSeed'
import { createSupportAiService } from '../services/support/SupportAiService'

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  await ensureSupportSeed(c.env.DB_SHARED)
  return next()
})

app.post('/session', async (c) => {
  const user = c.get('user')
  const service = createSupportAiService(c.env.DB_SHARED)
  const data = await service.getOrCreateSession(user)
  return c.json(data)
})

app.get('/session/:id', async (c) => {
  const user = c.get('user')
  const service = createSupportAiService(c.env.DB_SHARED)
  const data = await service.getSession(user, c.req.param('id'))
  if (!data) return c.json({ error: 'Sessão não encontrada.' }, 404)
  return c.json(data)
})

app.post(
  '/chat',
  zValidator(
    'json',
    z.object({
      sessionId: z.string().min(1),
      message: z.string().min(1).max(4000),
    }),
  ),
  async (c) => {
    const user = c.get('user')
    const { sessionId, message } = c.req.valid('json')
    const service = createSupportAiService(c.env.DB_SHARED)
    const result = await service.chat(user, sessionId, message, c.env)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  },
)

app.post(
  '/escalate',
  zValidator(
    'json',
    z.object({
      sessionId: z.string().min(1),
      subject: z.string().min(3).max(160).optional(),
    }),
  ),
  async (c) => {
    const user = c.get('user')
    const { sessionId, subject } = c.req.valid('json')
    const service = createSupportAiService(c.env.DB_SHARED)
    const result = await service.escalate(user, sessionId, subject ?? 'Ajuda no SISCR', c.env)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  },
)

app.get('/tickets', async (c) => {
  const user = c.get('user')
  const service = createSupportAiService(c.env.DB_SHARED)
  const tickets = await service.listUserTickets(user)
  return c.json({ tickets })
})

app.get('/tickets/:id', async (c) => {
  const user = c.get('user')
  const service = createSupportAiService(c.env.DB_SHARED)
  const data = await service.getUserTicket(user, c.req.param('id'))
  if (!data) return c.json({ error: 'Ticket não encontrado.' }, 404)
  return c.json(data)
})

app.post(
  '/tickets/:id/messages',
  zValidator('json', z.object({ body: z.string().min(1).max(8000) })),
  async (c) => {
    const user = c.get('user')
    const service = createSupportAiService(c.env.DB_SHARED)
    const result = await service.addClientTicketMessage(user, c.req.param('id'), c.req.valid('json').body)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result, 201)
  },
)

app.get('/tickets/:id/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Esperado upgrade WebSocket.' }, 426)
  }
  const user = c.get('user')
  const ticketId = c.req.param('id')
  const service = createSupportAiService(c.env.DB_SHARED)
  const data = await service.getUserTicket(user, ticketId)
  if (!data) return c.json({ error: 'Ticket não encontrado.' }, 404)

  const id = c.env.SUPPORT_TICKET_ROOMS.idFromName(ticketId)
  const stub = c.env.SUPPORT_TICKET_ROOMS.get(id)
  const url = new URL(c.req.url)
  url.searchParams.set('ticketId', ticketId)
  url.searchParams.set('role', 'client')
  url.searchParams.set('authorId', user.userId)
  url.searchParams.set('authorNome', user.nome)
  return stub.fetch(new Request(url.toString(), c.req.raw))
})

export default app
