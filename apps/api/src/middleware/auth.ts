import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import { buildSessionUserPayload } from '../lib/modulePermissions'
import type { ModuleMatrix } from '../lib/modulePermissions'
import { readAccessToken } from '../lib/accessToken'

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
 *
 * SEGURANÇA — Cross-tenant guard
 * -----------------------------------------------------------------
 * Além de validar o token, este middleware REJEITA requisições em que
 * o tenant resolvido pelo `tenantMiddleware` (header `X-Tenant-Slug`,
 * subdomínio ou sessão) não bate com o `tenantId` gravado na sessão.
 *
 * Sem esse guard, um usuário logado no tenant A poderia enviar
 * `X-Tenant-Slug: tenantB` e ler/escrever dados do tenant B, porque
 * as rotas filtram as queries por `c.get('tenant').tenantId` enquanto
 * a sessão sequer é inspecionada depois do login.
 *
 * Ordem esperada no pipeline (ver `src/index.ts`):
 *   1) tenantMiddleware     → define c.get('tenant')
 *   2) authMiddleware       → define c.get('user') e valida cross-tenant
 *   3) requireEmpresaMatriz → valida onboarding
 *   4) requireTenantModule  → valida permissão de módulo
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = readAccessToken(c.req.header('Authorization'), c.req.query('token'))

  if (!token) {
    return c.json({ error: 'Token de autenticação não fornecido.' }, 401)
  }

  let sessionData = (await c.env.KV_SESSIONS.get(`session:${token}`, 'json')) as SessionUser | null

  if (!sessionData) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  // ─── Cross-tenant guard ──────────────────────────────────────────
  // Se o `tenantMiddleware` rodou antes (rotas /api/tenant/*), garanta
  // que a sessão pertence ao mesmo tenant. Rotas públicas que pulam o
  // tenantMiddleware não setam `tenant` no contexto — nesse caso não
  // há comparação a fazer.
  const resolvedTenant = c.get('tenant')
  if (resolvedTenant && resolvedTenant.tenantId !== sessionData.tenantId) {
    return c.json(
      { error: 'Sessão não pertence ao tenant solicitado.', code: 'TENANT_MISMATCH' },
      403,
    )
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
