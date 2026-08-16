/**
 * Catálogo comercial: limites no D1, valores no Stripe.
 *
 * O Price no Stripe não muda de valor — para “atualizar o preço”
 * cria-se um Price novo e o lookup_key (`siscr_basico_month` etc.)
 * aponta para o ativo. Esta camada lê por lookup_key (com cache KV)
 * para a UI e o checkout acompanharem o catálogo sem redeploy.
 */

import type { Env } from '../../index'
import { priceIdForPlan, stripeRequest } from './stripeApi'

export const PLAN_LOOKUP_KEYS = {
  basico: { month: 'siscr_basico_month', year: 'siscr_basico_year' },
  pro: { month: 'siscr_pro_month', year: 'siscr_pro_year' },
  enterprise: { month: 'siscr_enterprise_month', year: 'siscr_enterprise_year' },
} as const

export type PaidPlanId = keyof typeof PLAN_LOOKUP_KEYS

export type StripeCatalogPrice = {
  id: string
  amount: number
  currency: string
  interval: 'month' | 'year'
}

type CatalogCache = {
  byLookup: Record<string, StripeCatalogPrice>
}

const CACHE_KEY = 'stripe:plan_catalog:v1'
const CACHE_TTL_SEC = 300

function isPaidPlanId(id: string): id is PaidPlanId {
  return id in PLAN_LOOKUP_KEYS
}

function amountFromCents(unitAmount: number | null | undefined): number | null {
  if (typeof unitAmount !== 'number' || !Number.isFinite(unitAmount) || unitAmount < 0) return null
  return unitAmount / 100
}

async function listPricesByLookupKeys(
  env: Env,
  keys: string[],
): Promise<Record<string, StripeCatalogPrice>> {
  if (!env.STRIPE_SECRET_KEY?.trim() || keys.length === 0) return {}

  const params = new URLSearchParams({ active: 'true', limit: '20' })
  keys.forEach((key, i) => params.set(`lookup_keys[${i}]`, key))

  const list = await stripeRequest<{
    data?: Array<{
      id?: string
      lookup_key?: string | null
      unit_amount?: number | null
      currency?: string
      recurring?: { interval?: string }
    }>
  }>(env, 'GET', 'prices', params)

  const out: Record<string, StripeCatalogPrice> = {}
  for (const p of list.data ?? []) {
    const lookup = p.lookup_key?.trim()
    const amount = amountFromCents(p.unit_amount ?? null)
    const id = p.id?.trim()
    const interval = p.recurring?.interval === 'year' ? 'year' : 'month'
    if (!lookup || !id || amount == null) continue
    out[lookup] = { id, amount, currency: (p.currency || 'brl').toLowerCase(), interval }
  }
  return out
}

async function loadCatalog(env: Env): Promise<CatalogCache> {
  const cached = await env.KV_TENANT_CACHE.get(CACHE_KEY, 'json') as CatalogCache | null
  if (cached?.byLookup && Object.keys(cached.byLookup).length > 0) return cached

  const keys = Object.values(PLAN_LOOKUP_KEYS).flatMap((k) => [k.month, k.year])
  let byLookup: Record<string, StripeCatalogPrice> = {}
  try {
    byLookup = await listPricesByLookupKeys(env, keys)
  } catch (err) {
    console.error('[planCatalog] Falha ao listar Prices Stripe:', err)
  }

  const payload: CatalogCache = { byLookup }
  if (Object.keys(byLookup).length > 0) {
    await env.KV_TENANT_CACHE.put(CACHE_KEY, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SEC })
  }
  return payload
}

export async function overlayStripePlanPrices<
  T extends { id: string; preco_mensal: number; preco_anual: number },
>(env: Env, plans: T[]): Promise<Array<T & { preco_fonte: 'stripe' | 'd1' }>> {
  const catalog = await loadCatalog(env)
  return plans.map((plan) => {
    if (!isPaidPlanId(plan.id)) {
      return { ...plan, preco_fonte: 'd1' as const }
    }
    const keys = PLAN_LOOKUP_KEYS[plan.id]
    const month = catalog.byLookup[keys.month]
    const year = catalog.byLookup[keys.year]
    const mensal = month?.amount
    const anual = year?.amount
    const fromStripe = mensal != null || anual != null
    return {
      ...plan,
      preco_mensal: mensal ?? plan.preco_mensal,
      preco_anual: anual ?? plan.preco_anual,
      preco_fonte: fromStripe ? ('stripe' as const) : ('d1' as const),
    }
  })
}

export async function resolvePriceIdForPlan(
  env: Env,
  db: D1Database,
  plan: string,
): Promise<string> {
  if (isPaidPlanId(plan)) {
    const catalog = await loadCatalog(env)
    const live = catalog.byLookup[PLAN_LOOKUP_KEYS[plan].month]?.id
    if (live) return live
  }

  const fromEnv = priceIdForPlan(env, plan)
  if (fromEnv) return fromEnv

  const row = await db
    .prepare('SELECT stripe_price_id_mensal FROM plans WHERE id = ? AND ativo = 1')
    .bind(plan)
    .first<{ stripe_price_id_mensal: string | null }>()
  return row?.stripe_price_id_mensal?.trim() || ''
}
