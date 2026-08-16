import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'
import { readAccessToken } from '../lib/accessToken'

type TenantContext = {
  tenantId: string
  tenantSlug: string
}

declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantContext
  }
}

type CachedTenant = TenantContext & { status: string }

export const tenantMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const CACHE_TTL = 300 // 5 minutos

  // 1. Header explícito tem prioridade
  let slug = c.req.header('X-Tenant-Slug')?.trim() || null

  // 2. Fallback: extrair slug do Bearer token (sessão no KV) — header ou ?token= (WebSocket)
  if (!slug) {
    const token = readAccessToken(c.req.header('Authorization'), c.req.query('token'))
    if (token) {
      const session = await c.env.KV_SESSIONS.get(`session:${token}`, 'json') as { tenantSlug?: string; tenantId?: string } | null
      if (session?.tenantSlug) {
        slug = session.tenantSlug
      }
    }
  }

  // 3. Subdomínio quando TENANT_HOST_BASE está definido (ex.: acme.app.empresa.com)
  if (!slug) {
    const base = c.env.TENANT_HOST_BASE?.trim().toLowerCase()
    if (base) {
      const host = (c.req.header('host') ?? '').split(':')[0].toLowerCase()
      if (host && host !== base && host.endsWith(`.${base}`)) {
        const sub = host.slice(0, -(base.length + 1))
        if (sub && !sub.includes('.')) {
          slug = sub
        }
      }
    }
  }

  if (!slug) {
    return c.json({ error: 'Tenant não identificado. Informe o header X-Tenant-Slug ou faça login.' }, 400)
  }

  const cacheKey = `tenant:${slug}`
  const raw = await c.env.KV_TENANT_CACHE.get(cacheKey, 'json') as CachedTenant | TenantContext | null
  const cached: CachedTenant | null =
    raw && 'status' in raw && raw.status ? raw : null

  if (cached && cached.status !== 'active') {
    return c.json(
      {
        error: `Tenant "${slug}" não encontrado ou inativo.`,
        code: 'TENANT_INACTIVE',
      },
      402,
    )
  }

  if (cached && cached.status === 'active') {
    c.set('tenant', { tenantId: cached.tenantId, tenantSlug: cached.tenantSlug })
    return next()
  }

  const result = await c.env.DB_SHARED
    .prepare('SELECT id, slug, status FROM tenants WHERE slug = ?')
    .bind(slug)
    .first<{ id: string; slug: string; status: string }>()

  if (!result) {
    return c.json({ error: `Tenant "${slug}" não encontrado ou inativo.` }, 404)
  }

  const tenant: CachedTenant = {
    tenantId: result.id,
    tenantSlug: result.slug,
    status: result.status,
  }

  await c.env.KV_TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL })

  if (result.status !== 'active') {
    return c.json(
      {
        error: `Tenant "${slug}" não encontrado ou inativo.`,
        code: 'TENANT_INACTIVE',
      },
      402,
    )
  }

  c.set('tenant', { tenantId: tenant.tenantId, tenantSlug: tenant.tenantSlug })
  return next()
})
