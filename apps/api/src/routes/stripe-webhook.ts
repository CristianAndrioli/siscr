import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword } from '../lib/password'

const app = new Hono<{ Bindings: Env }>()

// ─── Helpers ──────────────────────────────────────────────────

type DbEnv = Pick<Env, 'DB_SHARED' | 'KV_TENANT_CACHE'>

async function suspendTenant(env: DbEnv, customerId: string, reason: string): Promise<void> {
  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customerId)
    .run()

  if (tenantRow?.slug) {
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
    console.log(`[Webhook] Tenant suspenso (${reason}) e cache invalidado: ${tenantRow.slug}`)
  } else {
    console.log(`[Webhook] Tenant suspenso (${reason}): customer=${customerId}`)
  }
}

async function reactivateTenant(env: DbEnv, customerId: string, reason: string): Promise<void> {
  const tenantRow = await env.DB_SHARED
    .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<{ slug: string }>()

  await env.DB_SHARED
    .prepare("UPDATE tenants SET status = 'active', updated_at = ? WHERE stripe_customer_id = ?")
    .bind(new Date().toISOString(), customerId)
    .run()

  if (tenantRow?.slug) {
    await env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
    console.log(`[Webhook] Tenant reativado (${reason}) e cache invalidado: ${tenantRow.slug}`)
  } else {
    console.log(`[Webhook] Tenant reativado (${reason}): customer=${customerId}`)
  }
}

// ─── Webhook handler ──────────────────────────────────────────

// POST /api/webhooks/stripe
app.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Assinatura ausente.' }, 400)

  const rawBody = await c.req.text()

  const isValid = await verifyStripeSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) return c.json({ error: 'Assinatura inválida.' }, 401)

  const event = JSON.parse(rawBody)

  switch (event.type) {

    // ─── Checkout concluído: criar ou atualizar tenant ─────────
    case 'checkout.session.completed': {
      try {
        const session = event.data.object
        const tenantSlug = session.metadata?.tenantSlug
        const plan = session.metadata?.plan

        console.log(`[Webhook] checkout.session.completed: tenantSlug=${tenantSlug} plan=${plan}`)

        if (!tenantSlug) {
          console.warn('[Webhook] tenantSlug ausente nos metadata')
          break
        }

        const existing = await c.env.DB_SHARED
          .prepare('SELECT id FROM tenants WHERE slug = ?')
          .bind(tenantSlug)
          .first()

        if (!existing) {
          const pendingKey = `pending_signup:${tenantSlug}`
          const pendingRaw = await c.env.KV_TENANT_CACHE.get(pendingKey)

          console.log(`[Webhook] KV pendingRaw presente: ${!!pendingRaw}`)

          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw) as {
              nome: string; email: string; password: string;
              tenantNome: string; tenantSlug: string; plan: string
            }

            const now = new Date().toISOString()
            const tenantId = crypto.randomUUID()
            const passwordHash = await hashPassword(pending.password)

            console.log(`[Webhook] Criando tenant ${tenantSlug} para ${pending.email}`)

            await c.env.DB_SHARED
              .prepare(`INSERT INTO tenants (id, nome, slug, plan_id, stripe_customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
              .bind(tenantId, pending.tenantNome, tenantSlug, plan || pending.plan, session.customer ?? null, now, now)
              .run()

            const userId = crypto.randomUUID()

            await c.env.DB_SHARED
              .prepare(`INSERT INTO users (id, tenant_id, nome, email, password_hash, role, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)`)
              .bind(userId, tenantId, pending.nome, pending.email, passwordHash, now, now)
              .run()

            await c.env.KV_TENANT_CACHE.delete(pendingKey)

            await c.env.KV_SESSIONS.put(
              `auto_login:${tenantSlug}`,
              JSON.stringify({ email: pending.email, userId, tenantId, tenantSlug }),
              { expirationTtl: 600 }
            )

            console.log(`[Webhook] ✅ Tenant criado com sucesso: ${tenantSlug}`)
          } else {
            console.warn(`[Webhook] ⚠️ Dados pendentes expirados/ausentes para: ${tenantSlug}`)
          }
        } else {
          const planId = plan || session.metadata?.plan
          await c.env.DB_SHARED
            .prepare("UPDATE tenants SET stripe_customer_id = ?, plan_id = COALESCE(?, plan_id), status = 'active', updated_at = ? WHERE slug = ?")
            .bind(session.customer, planId ?? null, new Date().toISOString(), tenantSlug)
            .run()
          await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantSlug}`)
          console.log(`[Webhook] Tenant existente atualizado (upgrade/recompra): ${tenantSlug}`)
        }
      } catch (err) {
        console.error('[Webhook] ERRO em checkout.session.completed:', err)
        throw err
      }
      break
    }

    // ─── Assinatura pausada (status=paused via trial sem payment method) ───
    case 'customer.subscription.paused':
      await suspendTenant(c.env, event.data.object.customer, 'paused')
      break

    // ─── Assinatura retomada após pausa real ───────────────────
    case 'customer.subscription.resumed':
      await reactivateTenant(c.env, event.data.object.customer, 'resumed')
      break

    // ─── Assinatura cancelada definitivamente ─────────────────
    case 'customer.subscription.deleted':
      await suspendTenant(c.env, event.data.object.customer, 'deleted')
      break

    // ─── Assinatura atualizada ─────────────────────────────────
    // Referência: https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses
    //
    // status=active + pause_collection definido  → cobrança pausada via Dashboard → suspender
    // status=unpaid                              → todas retentativas falharam    → suspender
    // status=paused                              → trial sem payment method       → suspender
    // status=past_due                            → Stripe ainda retentando        → ignorar (aguardar unpaid/deleted)
    // status=active + cancel_at_period_end=true  → cancelamento agendado          → ignorar (bloqueio vem no deleted)
    // status=active + sem pendências             → pagamento normalizado           → reativar
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const billingPaused = !!sub.pause_collection
      const pendingCancel = sub.cancel_at_period_end === true
      const SUSPEND_STATUSES = ['paused', 'unpaid']

      if (billingPaused || SUSPEND_STATUSES.includes(sub.status)) {
        const reason = billingPaused ? 'pause_collection' : sub.status
        await suspendTenant(c.env, sub.customer, reason)
      } else if (sub.status === 'active' && !pendingCancel) {
        await reactivateTenant(c.env, sub.customer, 'active')
      } else if (pendingCancel) {
        console.log(`[Webhook] Cancelamento agendado p/ fim do período, acesso mantido: customer=${sub.customer}`)
      } else {
        // past_due: Stripe retentando via Smart Retries — não bloquear
        console.log(`[Webhook] subscription.updated ignorado (${sub.status}): customer=${sub.customer}`)
      }
      break
    }

    // ─── Falha de pagamento: Stripe retenta automaticamente ───
    // Não bloquear aqui; aguardar status=unpaid ou subscription.deleted
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      console.warn(`[Webhook] Pagamento falhou (tentativa ${invoice.attempt_count ?? '?'}): customer=${invoice.customer} invoice=${invoice.id}`)
      break
    }
  }

  return c.json({ received: true })
})

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const parts = header.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!timestamp || !sig) return false

    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
    const expected = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')

    return expected === sig
  } catch {
    return false
  }
}

export default app
