import { Hono } from 'hono'
import type { Env } from '../index'
import { StripeWebhookVerifier } from '../lib/stripe/StripeWebhookVerifier'
import { StripeEventIdempotency } from '../lib/stripe/StripeEventIdempotency'
import { pendingSignupSchema } from './subscriptions'

/**
 * Webhook Stripe.
 *
 * Pipeline por requisição
 * -----------------------------------------------------------------
 *   1) Verificar assinatura (timing-safe + replay window 5 min).
 *   2) Claim do event.id em `stripe_events` (idempotência).
 *   3) Dispatch por `event.type` — handlers puros, sem I/O redundante.
 *
 * Logs
 * -----------------------------------------------------------------
 * Mensagens de debug removidas/reduzidas para não escrever PII
 * (e-mail, slug) em logs de produção. Use nível de log apropriado
 * ao plugar um agregador (ex.: Logpush / Sentry).
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

  // Idempotência: só processa se esta chamada foi a primeira a gravar.
  const idempotency = new StripeEventIdempotency(c.env.DB_SHARED)
  const firstTime = await idempotency.claim(eventId, eventType)
  if (!firstTime) {
    return c.json({ received: true, duplicate: true })
  }

  try {
    await dispatch(c.env, eventType, event.data?.object ?? {})
  } catch (err) {
    console.error(`[stripe-webhook] Falha em ${eventType}:`, err)
    // Re-lança para o Cloudflare devolver 500 e Stripe reentregar.
    // OBS: como já claim-amos, a reentrega desse evento específico
    // será marcada como duplicata. Para permitir retry real numa
    // falha transitória, desfazemos o claim.
    await c.env.DB_SHARED
      .prepare('DELETE FROM stripe_events WHERE event_id = ?')
      .bind(eventId)
      .run()
    throw err
  }

  return c.json({ received: true })
})

/**
 * Roteador de eventos. Cada handler assume que já foi claim-ado e que
 * a assinatura está válida — não deve refazer checks básicos.
 */
async function dispatch(
  env: Env,
  type: string,
  object: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(env, object)
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(env, object)
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(env, object)
    case 'invoice.payment_failed':
      return handlePaymentFailed(object)
    default:
      // Ignorar eventos não tratados — Stripe envia muitos tipos.
      return
  }
}

// ─── Handlers ──────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  env: Env,
  session: Record<string, unknown>,
): Promise<void> {
  const metadata = (session.metadata ?? {}) as Record<string, string | undefined>
  const tenantSlug = metadata.tenantSlug?.trim()
  const plan = metadata.plan?.trim()

  if (!tenantSlug) {
    console.warn('[stripe-webhook] checkout.session.completed sem tenantSlug')
    return
  }

  // Tenant já existe? Interpreta como upgrade/segunda compra.
  const existing = await env.DB_SHARED
    .prepare('SELECT id FROM tenants WHERE slug = ?')
    .bind(tenantSlug)
    .first<{ id: string }>()

  if (existing) {
    const planId = plan ?? null
    const customer = session.customer as string | null | undefined
    await env.DB_SHARED
      .prepare(
        "UPDATE tenants SET stripe_customer_id = ?, plan_id = COALESCE(?, plan_id), status = 'active', updated_at = ? WHERE slug = ?",
      )
      .bind(customer ?? null, planId, new Date().toISOString(), tenantSlug)
      .run()
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantSlug}`)
    return
  }

  // Tenant novo — ler dados pendentes do KV, criar tenant + admin.
  const pendingKey = `pending_signup:${tenantSlug}`
  const pendingRaw = await env.KV_TENANT_CACHE.get(pendingKey)
  if (!pendingRaw) {
    console.warn(`[stripe-webhook] pending_signup expirado para ${tenantSlug}`)
    return
  }

  const parsed = pendingSignupSchema.safeParse(JSON.parse(pendingRaw))
  if (!parsed.success) {
    console.error('[stripe-webhook] pending_signup inválido:', parsed.error.flatten())
    return
  }
  const pending = parsed.data

  const now = new Date().toISOString()
  const tenantId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const customerId = (session.customer as string | null | undefined) ?? null

  await env.DB_SHARED.batch([
    env.DB_SHARED
      .prepare(
        `INSERT INTO tenants (id, nome, slug, plan_id, stripe_customer_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        tenantId,
        pending.tenantNome,
        tenantSlug,
        plan ?? pending.plan,
        customerId,
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

  // Token de auto-login (one-time, TTL 10min) consumido por /api/auth/session-status.
  await env.KV_SESSIONS.put(
    `auto_login:${tenantSlug}`,
    JSON.stringify({ email: pending.email, userId, tenantId, tenantSlug }),
    { expirationTtl: 600 },
  )
}

async function handleSubscriptionDeleted(
  env: Env,
  subscription: Record<string, unknown>,
): Promise<void> {
  const customer = subscription.customer as string | null | undefined
  if (!customer) return

  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customer)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customer)
    .run()

  if (tenantRow?.slug) {
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
  }
}

async function handleSubscriptionUpdated(
  env: Env,
  subscription: Record<string, unknown>,
): Promise<void> {
  const customer = subscription.customer as string | null | undefined
  const status = subscription.status as string | undefined
  if (!customer || status !== 'active') return

  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customer)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'active', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customer)
    .run()

  if (tenantRow?.slug) {
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
  }
}

async function handlePaymentFailed(object: Record<string, unknown>): Promise<void> {
  // Hook de notificação — hoje só registra. Integração com Resend virá
  // pela queue de tasks (ver `routes/queue.ts`).
  console.warn('[stripe-webhook] invoice.payment_failed:', object.customer)
}

export default app
