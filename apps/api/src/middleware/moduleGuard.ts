import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import type { ModuleKey } from '../lib/modulePermissions'

type UserWithModules = {
  role: string
  modules?: Record<string, { view: boolean; edit: boolean }>
}

/**
 * Exige permissão de módulo na sessão (após authMiddleware).
 * Admin ignora. GET/HEAD: can_view. POST/PUT/PATCH/DELETE: can_edit.
 */
export function requireTenantModule(module: ModuleKey) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const user = c.get('user') as UserWithModules
    if (!user) {
      return c.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, 401)
    }
    if (user.role === 'admin') {
      return next()
    }
    const m = user.modules?.[module]
    if (!m?.view) {
      return c.json(
        {
          error: 'Você não tem permissão para acessar este módulo.',
          code: 'FORBIDDEN_MODULE',
          module,
        },
        403
      )
    }
    const method = c.req.method
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !m.edit) {
      return c.json(
        {
          error: 'Você não tem permissão para alterar dados neste módulo.',
          code: 'FORBIDDEN_EDIT',
          module,
        },
        403
      )
    }
    return next()
  })
}
