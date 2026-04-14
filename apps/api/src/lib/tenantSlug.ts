/**
 * Slug de tenant (subdomínio): regras compartilhadas entre signup, checkout Stripe e checagem pública.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

/** Reservados para infra, rotas e nomes comuns — não podem ser usados como slug de cliente. */
export const RESERVED_TENANT_SLUGS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'mail',
  'ftp',
  'cdn',
  'static',
  'assets',
  'status',
  'blog',
  'docs',
  'help',
  'suporte',
  'support',
  'login',
  'signup',
  'sign-up',
  'register',
  'checkout',
  'stripe',
  'webhooks',
  'webhook',
  'health',
  'null',
  'undefined',
  'test',
  'demo',
])

export type SlugFormatResult = { ok: true; slug: string } | { ok: false; error: string }

export function validateTenantSlugFormat(normalized: string): SlugFormatResult {
  const slug = normalized.trim()
  if (slug.length < 3) {
    return { ok: false, error: 'O subdomínio deve ter pelo menos 3 caracteres.' }
  }
  if (slug.length > 30) {
    return { ok: false, error: 'O subdomínio pode ter no máximo 30 caracteres.' }
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      error: 'Use apenas letras minúsculas, números e hífen. Não use hífen no início ou fim.',
    }
  }
  if (RESERVED_TENANT_SLUGS.has(slug)) {
    return { ok: false, error: 'Esse subdomínio é reservado. Escolha outro.' }
  }
  return { ok: true, slug }
}

function randomSlugSuffix(): string {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return hex
}

/**
 * Garante um slug único no banco.
 * - Se `requested` for null/undefined/vazio: gera a partir de `tenantNome` (ou aleatório se necessário).
 * - Se preenchido: normaliza, valida formato + reservados + disponibilidade.
 */
export async function resolveTenantSlug(
  db: D1Database,
  tenantNome: string,
  requested: string | null | undefined,
): Promise<{ slug: string } | { error: string }> {
  const trimmed = requested?.trim()

  if (trimmed) {
    const normalized = slugify(trimmed)
    const fmt = validateTenantSlugFormat(normalized)
    if (!fmt.ok) return { error: fmt.error }

    const existing = await db.prepare('SELECT id FROM tenants WHERE slug = ?').bind(fmt.slug).first()
    if (existing) {
      return { error: `O subdomínio "${fmt.slug}" já está em uso. Escolha outro.` }
    }
    return { slug: fmt.slug }
  }

  let base = slugify(tenantNome)
  if (base.length < 3) {
    base = `org-${randomSlugSuffix()}`
  }
  if (base.length > 24) {
    base = base.slice(0, 24).replace(/-$/, '')
  }
  const baseFmt = validateTenantSlugFormat(base)
  if (!baseFmt.ok || RESERVED_TENANT_SLUGS.has(base)) {
    base = `org-${randomSlugSuffix()}`
  } else {
    base = baseFmt.slug
  }

  let candidate = base
  let n = 0
  for (;;) {
    if (candidate.length > 30) {
      candidate = `org-${randomSlugSuffix()}`.slice(0, 30)
    }
    const fmt = validateTenantSlugFormat(candidate)
    const safe = fmt.ok ? fmt.slug : `org-${randomSlugSuffix()}`.slice(0, 30)

    const taken = await db.prepare('SELECT id FROM tenants WHERE slug = ?').bind(safe).first()
    if (!taken) {
      return { slug: safe }
    }
    n += 1
    candidate = `${base}-${n}`
    if (candidate.length > 30) {
      candidate = `${base.slice(0, Math.max(1, 20 - String(n).length))}-${n}`.replace(/^-|-$/g, '') || `org-${randomSlugSuffix()}`
    }
    if (n > 500) {
      return { slug: `org-${randomSlugSuffix()}`.slice(0, 30) }
    }
  }
}

export type AvailabilityResult =
  | { empty: true; message: string }
  | { available: false; normalized: string; message: string }
  | { available: true; normalized: string }

/** Checagem pública para o formulário de cadastro (disponibilidade na tabela `tenants`). */
export async function checkTenantSlugAvailability(db: D1Database, raw: string): Promise<AvailabilityResult> {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return {
      empty: true,
      message: 'Se continuar sem preencher, geraremos um subdomínio único a partir do nome da empresa.',
    }
  }

  const normalized = slugify(trimmed)
  const fmt = validateTenantSlugFormat(normalized)
  if (!fmt.ok) {
    return { available: false, normalized, message: fmt.error }
  }

  const existing = await db.prepare('SELECT id FROM tenants WHERE slug = ?').bind(fmt.slug).first()
  if (existing) {
    return {
      available: false,
      normalized: fmt.slug,
      message: `O subdomínio "${fmt.slug}" já está em uso.`,
    }
  }

  return { available: true, normalized: fmt.slug }
}
