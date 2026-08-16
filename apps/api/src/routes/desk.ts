import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { ensureSupportSeed } from '../lib/supportSeed'
import {
  DESK_SESSION_PREFIX,
  DESK_SESSION_TTL,
  deskAuthMiddleware,
  requireDeskMaster,
} from '../middleware/deskAuth'
import { createSupportDeskService } from '../services/support/SupportDeskService'
import { SupportTicketRepository } from '../repositories/SupportTicketRepository'

const app = new Hono<{ Bindings: Env }>()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

app.post('/auth/login', zValidator('json', loginSchema), async (c) => {
  await ensureSupportSeed(c.env.DB_SHARED)
  const { email, password } = c.req.valid('json')
  const service = createSupportDeskService(c.env.DB_SHARED)
  const result = await service.login(email, password)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status as 401)
  }

  const token = crypto.randomUUID()
  await c.env.KV_SESSIONS.put(`${DESK_SESSION_PREFIX}${token}`, JSON.stringify(result), {
    expirationTtl: DESK_SESSION_TTL,
  })

  return c.json({
    token,
    agent: result,
  })
})

app.post('/auth/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    await c.env.KV_SESSIONS.delete(`${DESK_SESSION_PREFIX}${authHeader.slice(7)}`)
  }
  return c.json({ message: 'Logout realizado.' })
})

app.use('*', async (c, next) => {
  const path = c.req.path
  if (path.endsWith('/auth/login') || path.endsWith('/auth/logout')) {
    return next()
  }
  return deskAuthMiddleware(c, next)
})

app.get('/me', (c) => {
  return c.json(c.get('deskAgent'))
})

app.post(
  '/auth/change-password',
  zValidator(
    'json',
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }),
  ),
  async (c) => {
    const agent = c.get('deskAgent')
    const { currentPassword, newPassword } = c.req.valid('json')
    const service = createSupportDeskService(c.env.DB_SHARED)
    const result = await service.changePassword(agent.agentId, currentPassword, newPassword)
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }

    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const next = { ...agent, mustChangePassword: false }
    if (token) {
      await c.env.KV_SESSIONS.put(`${DESK_SESSION_PREFIX}${token}`, JSON.stringify(next), {
        expirationTtl: DESK_SESSION_TTL,
      })
    }
    return c.json({ message: 'Senha atualizada.', agent: next })
  },
)

app.get('/agents', requireDeskMaster, async (c) => {
  const service = createSupportDeskService(c.env.DB_SHARED)
  const agents = await service.listAgents()
  return c.json({ agents })
})

app.post(
  '/agents',
  requireDeskMaster,
  zValidator(
    'json',
    z.object({
      nome: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(['master', 'agent']).default('agent'),
    }),
  ),
  async (c) => {
    const actor = c.get('deskAgent')
    const body = c.req.valid('json')
    const service = createSupportDeskService(c.env.DB_SHARED)
    const result = await service.createAgent({ ...body, createdBy: actor.agentId })
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }
    return c.json(result, 201)
  },
)

app.patch(
  '/agents/:id',
  requireDeskMaster,
  zValidator(
    'json',
    z.object({
      nome: z.string().min(2).optional(),
      role: z.enum(['master', 'agent']).optional(),
      ativo: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const service = createSupportDeskService(c.env.DB_SHARED)
    const result = await service.updateAgent(c.req.param('id'), c.req.valid('json'))
    if ('error' in result) {
      return c.json({ error: result.error }, result.status)
    }
    return c.json(result)
  },
)

app.get('/tickets', async (c) => {
  const kind = c.req.query('kind') as 'support' | 'development' | undefined
  const status = c.req.query('status') as
    | 'open'
    | 'waiting_client'
    | 'waiting_agent'
    | 'in_progress'
    | 'resolved'
    | 'closed'
    | undefined
  const q = c.req.query('q') ?? undefined
  const service = createSupportDeskService(c.env.DB_SHARED)
  const tickets = await service.listTickets({
    kind: kind === 'support' || kind === 'development' ? kind : undefined,
    status,
    q,
  })
  return c.json({ tickets })
})

app.get('/tickets/:id', async (c) => {
  const service = createSupportDeskService(c.env.DB_SHARED)
  const data = await service.getTicket(c.req.param('id'))
  if (!data) return c.json({ error: 'Ticket não encontrado.' }, 404)
  const snapshot = await service.tenantSnapshot(data.ticket.tenant_id)
  return c.json({ ...data, tenant: snapshot })
})

app.post('/tickets/:id/claim', async (c) => {
  const agent = c.get('deskAgent')
  const service = createSupportDeskService(c.env.DB_SHARED)
  const result = await service.claimTicket(c.req.param('id'), agent.agentId)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  return c.json(result)
})

app.patch(
  '/tickets/:id',
  zValidator(
    'json',
    z.object({
      status: z.enum(['open', 'waiting_client', 'waiting_agent', 'in_progress', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    if (!body.status && !body.priority) {
      return c.json({ error: 'Nada para atualizar.' }, 400)
    }
    const service = createSupportDeskService(c.env.DB_SHARED)
    const result = await service.updateTicketStatus(c.req.param('id'), body.status, body.priority)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result)
  },
)

app.post(
  '/tickets/:id/messages',
  zValidator('json', z.object({ body: z.string().min(1).max(8000) })),
  async (c) => {
    const agent = c.get('deskAgent')
    const service = createSupportDeskService(c.env.DB_SHARED)
    const result = await service.addAgentMessage(c.req.param('id'), agent, c.req.valid('json').body)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result, 201)
  },
)

app.post(
  '/tickets/:id/development',
  zValidator(
    'json',
    z.object({
      subject: z.string().min(3).max(160),
      body: z.string().max(8000).optional(),
    }),
  ),
  async (c) => {
    const agent = c.get('deskAgent')
    const service = createSupportDeskService(c.env.DB_SHARED)
    const { subject, body } = c.req.valid('json')
    const result = await service.createDevelopmentTicket(c.req.param('id'), agent, subject, body)
    if ('error' in result) return c.json({ error: result.error }, result.status)
    return c.json(result, 201)
  },
)

app.get('/tickets/:id/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Esperado upgrade WebSocket.' }, 426)
  }
  const agent = c.get('deskAgent')
  const ticketId = c.req.param('id')
  const repo = new SupportTicketRepository(c.env.DB_SHARED)
  const ticket = await repo.findTicket(ticketId)
  if (!ticket) return c.json({ error: 'Ticket não encontrado.' }, 404)

  const id = c.env.SUPPORT_TICKET_ROOMS.idFromName(ticketId)
  const stub = c.env.SUPPORT_TICKET_ROOMS.get(id)
  const url = new URL(c.req.url)
  url.searchParams.set('ticketId', ticketId)
  url.searchParams.set('role', 'agent')
  url.searchParams.set('authorId', agent.agentId)
  url.searchParams.set('authorNome', agent.nome)
  return stub.fetch(new Request(url.toString(), c.req.raw))
})

export default app
