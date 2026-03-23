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

  // 1. Extrair slug do tenant (header ou subdomínio)
  let slug = c.req.header('X-Tenant-Slug')

  if (!slug) {
    const host = c.req.header('host') ?? ''
    const parts = host.split('.')
    if (parts.length >= 3) {
      slug = parts[0]
    }
  }

  if (!slug) {
    return c.json({ error: 'Tenant não identificado. Informe o header X-Tenant-Slug.' }, 400)
  }

  // 2. Verificar cache KV
  const cacheKey = `tenant:${slug}`
  const cached = await c.env.KV_TENANT_CACHE.get(cacheKey, 'json') as TenantContext | null

  if (cached) {
    c.set('tenant', cached)
    return next()
  }

  // 3. Buscar no banco — sem db_id (usamos row-level isolation com tenant_id)
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

  // 4. Salvar no cache KV
  await c.env.KV_TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL })

  c.set('tenant', tenant)
  return next()
})
