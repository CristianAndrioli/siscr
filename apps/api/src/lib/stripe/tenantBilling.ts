import type { Env } from '../../index'
import {
  fetchSubscription,
  planIdFromStripePrice,
  stripeCustomerId,
  subscriptionPeriodEndIso,
  subscriptionPriceId,
  type StripeSubscription,
} from './stripeApi'

type TenantDbEnv = Pick<Env, 'DB_SHARED' | 'KV_TENANT_CACHE'>

const ACCESS_OK = new Set(['active', 'trialing'])
const ACCESS_BLOCK = new Set([
  'past_due',
  'unpaid',
  'paused',
  'canceled',
  'cancelled',
  'incomplete_expired',
])

function tenantStatusFromStripe(sub: StripeSubscription): 'active' | 'suspended' {
  if (sub.pause_collection) return 'suspended'
  if (ACCESS_OK.has(sub.status)) return 'active'
  if (ACCESS_BLOCK.has(sub.status)) return 'suspended'
  return 'suspended'
}

async function invalidateTenantCache(env: TenantDbEnv, slug: string | null | undefined): Promise<void> {
  if (slug) await env.KV_TENANT_CACHE.delete(`tenant:${slug}`)
}

export async function applyStripeSubscription(
  env: Env,
  sub: StripeSubscription,
  extras?: { planHint?: string | null; customerHint?: string | null },
): Promise<void> {
  const customerId = extras?.customerHint || stripeCustomerId(sub.customer)
  if (!customerId) return

  const tenantStatus = tenantStatusFromStripe(sub)
  const expiresAt = subscriptionPeriodEndIso(sub)
  const priceId = subscriptionPriceId(sub)
  const planFromPrice = await planIdFromStripePrice(env, env.DB_SHARED, priceId)
  const planId = extras?.planHint || planFromPrice

  const tenant = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<{ slug: string }>()

  const now = new Date().toISOString()
  await env.DB_SHARED
    .prepare(
      `UPDATE tenants SET
        status = ?,
        stripe_subscription_id = ?,
        subscription_expires_at = COALESCE(?, subscription_expires_at),
        plan_id = COALESCE(?, plan_id),
        updated_at = ?
       WHERE stripe_customer_id = ?`,
    )
    .bind(tenantStatus, sub.id, expiresAt, planId, now, customerId)
    .run()

  await invalidateTenantCache(env, tenant?.slug)
  console.log(
    `[stripe] Tenant ${tenantStatus} customer=${customerId} sub=${sub.id} stripeStatus=${sub.status}`,
  )
}

export async function applyStripeSubscriptionId(
  env: Env,
  subscriptionId: string,
  extras?: { planHint?: string | null; customerHint?: string | null },
): Promise<void> {
  const sub = await fetchSubscription(env, subscriptionId)
  await applyStripeSubscription(env, sub, extras)
}

export async function suspendTenantByCustomer(
  env: TenantDbEnv,
  customerId: string,
  reason: string,
): Promise<void> {
  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customerId)
    .run()

  await invalidateTenantCache(env, tenantRow?.slug)
  console.log(`[stripe] Tenant suspenso (${reason}): ${tenantRow?.slug ?? customerId}`)
}

export async function reactivateTenantByCustomer(
  env: TenantDbEnv,
  customerId: string,
  reason: string,
): Promise<void> {
  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'active', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customerId)
    .run()

  await invalidateTenantCache(env, tenantRow?.slug)
  console.log(`[stripe] Tenant reativado (${reason}): ${tenantRow?.slug ?? customerId}`)
}
