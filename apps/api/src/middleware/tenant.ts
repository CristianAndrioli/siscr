import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'

type TenantContext = {
  tenantId: string
  tenantSlug: string
}

declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantContext
  }
}

export const tenantMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const CACHE_TTL = 300 // 5 minutos

  // 1. Header explícito tem prioridade
  const rawSlugHeader = c.req.header('X-Tenant-Slug')
  let slug = rawSlugHeader?.trim() || null
  console.log(`[tenant] path=${c.req.path} X-Tenant-Slug="${rawSlugHeader ?? '(none)'}"`)

  // 2. Fallback: extrair slug do Bearer token (sessão no KV)
  if (!slug) {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const session = await c.env.KV_SESSIONS.get(`session:${token}`, 'json') as { tenantSlug?: string; tenantId?: string } | null
      if (session?.tenantSlug) {
        slug = session.tenantSlug
      }
    }
  }

  // 3. Último recurso: subdomínio (para custom domains tipo tenant.app.com)
  if (!slug) {
    const host = c.req.header('host') ?? ''
    const parts = host.split('.')
    // Só usa subdomain se parecer um slug de tenant (não contém "workers" ou "pages")
    if (parts.length >= 3 && !host.includes('workers.dev') && !host.includes('pages.dev')) {
      slug = parts[0]
    }
  }

  if (!slug) {
    return c.json({ error: 'Tenant não identificado. Informe o header X-Tenant-Slug ou faça login.' }, 400)
  }

  // 4. Verificar cache KV
  const cacheKey = `tenant:${slug}`
  const cached = await c.env.KV_TENANT_CACHE.get(cacheKey, 'json') as TenantContext | null

  if (cached) {
    c.set('tenant', cached)
    return next()
  }

  // 5. Buscar no banco
  const result = await c.env.DB_SHARED
    .prepare('SELECT id, slug FROM tenants WHERE slug = ? AND status = ?')
    .bind(slug, 'active')
    .first<{ id: string; slug: string }>()

  if (!result) {
    return c.json({ error: `Tenant "${slug}" não encontrado ou inativo.` }, 404)
  }

  const tenant: TenantContext = {
    tenantId: result.id,
    tenantSlug: result.slug,
  }

  // 6. Salvar no cache KV
  await c.env.KV_TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL })

  c.set('tenant', tenant)
  return next()
})
