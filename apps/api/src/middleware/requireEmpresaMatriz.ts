import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import { EmpresaRepository } from '../repositories/EmpresaRepository'

/**
 * Rotas permitidas com zero empresas cadastradas (onboarding da matriz).
 * Demais /api/tenant/* exigem pelo menos uma empresa.
 */
export function allowsTenantAccessWithoutEmpresa(pathname: string, method: string): boolean {
  const p = pathname.replace(/\/+$/, '') || pathname
  const m = method.toUpperCase()

  if (p === '/api/tenant/info/onboarding' && m === 'GET') return true

  if ((p === '/api/tenant/info' || p === '/api/tenant/info/') && m === 'GET') return true

  if (p === '/api/tenant/info/empresas') {
    return m === 'GET' || m === 'POST'
  }

  if (m === 'POST' && /^\/api\/tenant\/info\/empresas\/[^/]+\/filiais$/.test(p)) return true

  if (m === 'POST' && /^\/api\/tenant\/info\/empresas\/[^/]+\/certificado-a1$/.test(p)) return true

  if (m === 'POST' && /^\/api\/tenant\/info\/filiais\/[^/]+\/certificado-a1$/.test(p)) return true

  // Assinatura Stripe (portal/checkout) — não exige empresa cadastrada
  if (p.startsWith('/api/tenant/info/subscription')) return true

  return false
}

export const requireEmpresaMatrizMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (allowsTenantAccessWithoutEmpresa(path, c.req.method)) {
    return next()
  }

  const tenant = c.get('tenant')
  const repo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  if ((await repo.count()) > 0) {
    return next()
  }

  return c.json(
    {
      error: 'Cadastre a empresa matriz antes de usar este recurso.',
      code: 'ONBOARDING_EMPRESA_REQUIRED',
    },
    403,
  )
})
