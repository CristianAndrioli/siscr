import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import { buildSessionUserPayload } from '../lib/modulePermissions'
import type { ModuleMatrix } from '../lib/modulePermissions'

export type SessionUser = {
  userId: string
  email: string
  nome: string
  role: string
  tenantId: string
  tenantSlug: string
  empresaId: string | null
  filialId: string | null
  modules?: ModuleMatrix
}

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

/**
 * Verifica o Bearer token e carrega a sessão (KV). Completa `modules` se sessões antigas não tiverem.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de autenticação não fornecido.' }, 401)
  }

  const token = authHeader.slice(7)

  let sessionData = (await c.env.KV_SESSIONS.get(`session:${token}`, 'json')) as SessionUser | null

  if (!sessionData) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  if (!sessionData.modules) {
    const row = await c.env.DB_SHARED
      .prepare('SELECT custom_role_id, role FROM users WHERE id = ? AND tenant_id = ?')
      .bind(sessionData.userId, sessionData.tenantId)
      .first<{ custom_role_id: string | null; role: string }>()

    if (row) {
      const full = await buildSessionUserPayload(c.env.DB_SHARED, {
        userId: sessionData.userId,
        email: sessionData.email,
        nome: sessionData.nome,
        role: row.role,
        tenantId: sessionData.tenantId,
        tenantSlug: sessionData.tenantSlug,
        customRoleId: row.custom_role_id,
      })
      sessionData = full
      await c.env.KV_SESSIONS.put(`session:${token}`, JSON.stringify(sessionData), {
        expirationTtl: 60 * 60 * 24 * 7,
      })
    }
  }

  c.set('user', sessionData)
  return next()
})

export const requireRole = (...roles: string[]) =>
  createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Acesso não autorizado.' }, 403)
    }
    return next()
  })
