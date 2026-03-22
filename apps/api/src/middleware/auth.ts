import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'

type SessionUser = {
  userId: string
  email: string
  role: string
  empresaId: string | null
  filialId: string | null
}

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

/**
 * Verifica o token JWT (Bearer) e carrega o usuário autenticado.
 * Deve ser aplicado após o tenantMiddleware.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de autenticação não fornecido.' }, 401)
  }

  const token = authHeader.slice(7)

  // Verificar sessão no KV (Better Auth armazena sessões no KV)
  const sessionData = await c.env.KV_SESSIONS.get(`session:${token}`, 'json') as SessionUser | null

  if (!sessionData) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  c.set('user', sessionData)
  return next()
})

/**
 * Verifica se o usuário tem a role necessária.
 * Uso: app.use('/rota', requireRole('admin'))
 */
export const requireRole = (...roles: string[]) =>
  createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Acesso não autorizado.' }, 403)
    }
    return next()
  })
