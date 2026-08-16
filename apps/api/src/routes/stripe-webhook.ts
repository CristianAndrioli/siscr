import { Hono } from 'hono'
import type { Env } from '../index'
import { StripeWebhookVerifier } from '../lib/stripe/StripeWebhookVerifier'
import { StripeEventIdempotency } from '../lib/stripe/StripeEventIdempotency'
import { pendingSignupSchema } from './subscriptions'
import { hasEmailBinding, sendWelcomeEmail } from '../lib/email'
import {
  applyStripeSubscription,
  applyStripeSubscriptionId,
  reactivateTenantByCustomer,
  suspendTenantByCustomer,
} from '../lib/stripe/tenantBilling'
import {
  stripeCustomerId,
  stripeSubscriptionId,
  type StripeInvoice,
  type StripeSubscription,
} from '../lib/stripe/stripeApi'

/**
 * Webhook Stripe.
 *
 *   checkout.session.completed     → cria ou atualiza tenant
 *   customer.subscription.*        → aplica status Stripe no tenant
 *   invoice.paid                   → reativa (pagamento recuperado)
 *   invoice.payment_failed         → suspende (past_due / falha)
 */
const app = new Hono<{ Bindings: Env }>()

app.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  const rawBody = await c.req.text()

  const verifier = new StripeWebhookVerifier(c.env.STRIPE_WEBHOOK_SECRET)
  const isValid = await verifier.verify(rawBody, signature)
  if (!isValid) return c.json({ error: 'Assinatura inválida.' }, 401)

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Payload inválido.' }, 400)
  }

  const eventId = String(event.id ?? '')
  const eventType = String(event.type ?? '')
  if (!eventId || !eventType) {
    return c.json({ error: 'Evento Stripe sem id/type.' }, 400)
  }

  const idempotency = new StripeEventIdempotency(c.env.DB_SHARED)
  const firstTime = await idempotency.claim(eventId, eventType)
  if (!firstTime) {
    return c.json({ received: true, duplicate: true })
  }

  try {
    await dispatch(c.env, eventType, event.data?.object ?? {})
  } catch (err) {
    console.error(`[stripe-webhook] Falha em ${eventType}:`, err)
    await c.env.DB_SHARED
      .prepare('DELETE FROM stripe_events WHERE event_id = ?')
      .bind(eventId)
      .run()
    throw err
  }

  return c.json({ received: true })
})

async function dispatch(
  env: Env,
  type: string,
  object: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(env, object)
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      return applyStripeSubscription(env, object as StripeSubscription)
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return handleInvoicePaid(env, object as StripeInvoice)
    case 'invoice.payment_failed':
      return handlePaymentFailed(env, object as StripeInvoice)
    default:
      return
  }
}

async function syncSessionSubscription(
  env: Env,
  session: Record<string, unknown>,
  planHint: string | null,
): Promise<void> {
  const subId = stripeSubscriptionId(session.subscription)
  const customerId = stripeCustomerId(session.customer)
  if (subId) {
    await applyStripeSubscriptionId(env, subId, { planHint, customerHint: customerId })
    return
  }
  if (customerId && planHint) {
    await env.DB_SHARED
      .prepare(
        "UPDATE tenants SET plan_id = COALESCE(?, plan_id), status = 'active', stripe_customer_id = ?, updated_at = ? WHERE stripe_customer_id = ?",
      )
      .bind(planHint, customerId, new Date().toISOString(), customerId)
      .run()
  }
}

async function handleCheckoutCompleted(
  env: Env,
  session: Record<string, unknown>,
): Promise<void> {
  const metadata = (session.metadata ?? {}) as Record<string, string | undefined>
  const tenantSlug = metadata.tenantSlug?.trim()
  const plan = metadata.plan?.trim() || null
  const customerId = stripeCustomerId(session.customer)
  const subscriptionId = stripeSubscriptionId(session.subscription)

  if (!tenantSlug) {
    console.warn('[stripe-webhook] checkout.session.completed sem tenantSlug')
    return
  }

  const existing = await env.DB_SHARED
    .prepare('SELECT id FROM tenants WHERE slug = ?')
    .bind(tenantSlug)
    .first<{ id: string }>()

  if (existing) {
    await env.DB_SHARED
      .prepare(
        `UPDATE tenants SET
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = COALESCE(?, stripe_subscription_id),
          plan_id = COALESCE(?, plan_id),
          status = 'active',
          updated_at = ?
         WHERE slug = ?`,
      )
      .bind(customerId, subscriptionId, plan, new Date().toISOString(), tenantSlug)
      .run()
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantSlug}`)
    await syncSessionSubscription(env, session, plan)
    return
  }

  const pendingKey = `pending_signup:${tenantSlug}`
  const pendingRaw = await env.KV_TENANT_CACHE.get(pendingKey)
  if (!pendingRaw) {
    console.warn(`[stripe-webhook] pending_signup expirado para ${tenantSlug}`)
    return
  }

  const parsed = pendingSignupSchema.safeParse(JSON.parse(pendingRaw))
  if (!parsed.success) {
    console.error('[stripe-webhook] pending_signup inválido:', parsed.error.flatten())
    throw new Error(`pending_signup fora do contrato para ${tenantSlug}`)
  }
  const pending = parsed.data

  const now = new Date().toISOString()
  const tenantId = crypto.randomUUID()
  const userId = crypto.randomUUID()

  await env.DB_SHARED.batch([
    env.DB_SHARED
      .prepare(
        `INSERT INTO tenants (id, nome, slug, plan_id, stripe_customer_id, stripe_subscription_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        tenantId,
        pending.tenantNome,
        tenantSlug,
        plan ?? pending.plan,
        customerId,
        subscriptionId,
        now,
        now,
      ),
    env.DB_SHARED
      .prepare(
        `INSERT INTO users (id, tenant_id, nome, email, password_hash, role, ativo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)`,
      )
      .bind(userId, tenantId, pending.nome, pending.email, pending.passwordHash, now, now),
  ])

  await env.KV_TENANT_CACHE.delete(pendingKey)

  await env.KV_SESSIONS.put(
    `auto_login:${tenantSlug}`,
    JSON.stringify({ email: pending.email, userId, tenantId, tenantSlug }),
    { expirationTtl: 600 },
  )

  if (hasEmailBinding(env)) {
    try {
      await sendWelcomeEmail(env, pending.email, pending.nome, tenantSlug, plan ?? pending.plan, tenantId)
    } catch (emailErr) {
      console.error('[stripe-webhook] Falha ao enviar e-mail de boas-vindas:', emailErr)
    }
  }

  await syncSessionSubscription(env, session, plan ?? pending.plan)
}

async function handleInvoicePaid(env: Env, invoice: StripeInvoice): Promise<void> {
  const customerId = stripeCustomerId(invoice.customer)
  const subId = stripeSubscriptionId(invoice.subscription)
  if (subId) {
    await applyStripeSubscriptionId(env, subId, { customerHint: customerId })
    return
  }
  if (customerId) await reactivateTenantByCustomer(env, customerId, 'invoice.paid')
}

async function handlePaymentFailed(env: Env, invoice: StripeInvoice): Promise<void> {
  const customerId = stripeCustomerId(invoice.customer)
  console.warn(
    `[stripe-webhook] invoice.payment_failed (tentativa ${invoice.attempt_count ?? '?'}): invoice=${invoice.id}`,
  )
  if (customerId) await suspendTenantByCustomer(env, customerId, 'invoice.payment_failed')
}

export default app
