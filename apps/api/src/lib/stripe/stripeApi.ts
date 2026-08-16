import type { Env } from '../../index'

export async function stripeRequest<T>(
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const url =
    method === 'GET' && params && [...params.keys()].length > 0
      ? `https://api.stripe.com/v1/${path}?${params.toString()}`
      : `https://api.stripe.com/v1/${path}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? (params?.toString() ?? '') : undefined,
  })

  const json = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${method} ${path} falhou (${res.status}).`)
  }
  return json
}

export type StripeSubscription = {
  id: string
  customer: string | { id: string } | null
  status: string
  current_period_end?: number
  cancel_at_period_end?: boolean
  pause_collection?: unknown
  items?: {
    data?: Array<{
      id: string
      current_period_end?: number
      price?: { id?: string }
    }>
  }
}

export type StripeInvoice = {
  id?: string
  customer?: string | { id?: string } | null
  subscription?: string | { id?: string } | null
  attempt_count?: number
  status?: string
  paid?: boolean
  lines?: { data?: Array<{ period?: { end?: number } }> }
}

export function stripeCustomerId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export function stripeSubscriptionId(value: unknown): string | null {
  return stripeCustomerId(value)
}

export function subscriptionPeriodEndIso(sub: StripeSubscription): string | null {
  const unix =
    sub.current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null
  if (!unix || !Number.isFinite(unix)) return null
  return new Date(unix * 1000).toISOString()
}

export function subscriptionPriceId(sub: StripeSubscription): string | null {
  const id = sub.items?.data?.[0]?.price?.id
  return id?.trim() || null
}

export function planIdFromPrice(env: Env, priceId: string | null | undefined): string | null {
  if (!priceId) return null
  if (priceId === env.STRIPE_PRICE_BASICO) return 'basico'
  if (priceId === env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === env.STRIPE_PRICE_ENTERPRISE) return 'enterprise'
  return null
}

export async function planIdFromStripePrice(
  env: Env,
  db: D1Database,
  priceId: string | null | undefined,
): Promise<string | null> {
  const fromEnv = planIdFromPrice(env, priceId)
  if (fromEnv) return fromEnv
  if (!priceId) return null
  const row = await db
    .prepare(
      `SELECT id FROM plans WHERE ativo = 1 AND (stripe_price_id_mensal = ? OR stripe_price_id_anual = ?) LIMIT 1`,
    )
    .bind(priceId, priceId)
    .first<{ id: string }>()
  return row?.id ?? null
}

export function priceIdForPlan(env: Env, plan: string): string {
  const map: Record<string, string> = {
    basico: env.STRIPE_PRICE_BASICO || '',
    pro: env.STRIPE_PRICE_PRO || '',
    enterprise: env.STRIPE_PRICE_ENTERPRISE || '',
  }
  return map[plan] || ''
}

export async function fetchSubscription(env: Env, subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(env, 'GET', `subscriptions/${subscriptionId}`)
}

export async function findActiveSubscriptionId(env: Env, customerId: string): Promise<string | null> {
  const list = await stripeRequest<{ data?: Array<{ id?: string; status?: string }> }>(
    env,
    'GET',
    'subscriptions',
    new URLSearchParams({ customer: customerId, status: 'all', limit: '10' }),
  )
  const preferred = (list.data ?? []).find((s) =>
    s.status === 'active' || s.status === 'trialing' || s.status === 'past_due',
  )
  return preferred?.id ?? list.data?.[0]?.id ?? null
}
