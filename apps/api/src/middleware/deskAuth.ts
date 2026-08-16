import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import { ensureSupportSeed } from '../lib/supportSeed'
import { readAccessToken } from '../lib/accessToken'

export type DeskAgent = {
  agentId: string
  email: string
  nome: string
  role: 'master' | 'agent'
  mustChangePassword: boolean
}

declare module 'hono' {
  interface ContextVariableMap {
    deskAgent: DeskAgent
  }
}

export const DESK_SESSION_PREFIX = 'desk-session:'
export const DESK_SESSION_TTL = 60 * 60 * 24 * 7

export const deskAuthMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  await ensureSupportSeed(c.env.DB_SHARED)

  const token = readAccessToken(c.req.header('Authorization'), c.req.query('token'))
  if (!token) {
    return c.json({ error: 'Token de autenticação não fornecido.' }, 401)
  }
  const session = (await c.env.KV_SESSIONS.get(`${DESK_SESSION_PREFIX}${token}`, 'json')) as DeskAgent | null
  if (!session) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  c.set('deskAgent', session)
  return next()
})

export const requireDeskMaster = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const agent = c.get('deskAgent')
  if (!agent || agent.role !== 'master') {
    return c.json({ error: 'Apenas administradores master podem fazer isso.' }, 403)
  }
  return next()
})
