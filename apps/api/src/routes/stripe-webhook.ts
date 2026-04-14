import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword } from '../lib/password'

const app = new Hono<{ Bindings: Env }>()

// POST /api/webhooks/stripe
app.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Assinatura ausente.' }, 400)

  const rawBody = await c.req.text()

  const isValid = await verifyStripeSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) return c.json({ error: 'Assinatura inválida.' }, 401)

  const event = JSON.parse(rawBody)

  switch (event.type) {

    // ─── Pagamento confirmado: criar tenant + usuário ──────────
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

        // Verificar se tenant já existe (proteção contra duplicatas)
        const existing = await c.env.DB_SHARED
          .prepare('SELECT id FROM tenants WHERE slug = ?')
          .bind(tenantSlug)
          .first()

        if (!existing) {
          // Recuperar dados pendentes do KV
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

            console.log(`[Webhook] Tenant inserido, criando usuário...`)

            const userId = crypto.randomUUID()

            await c.env.DB_SHARED
              .prepare(`INSERT INTO users (id, tenant_id, nome, email, password_hash, role, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)`)
              .bind(userId, tenantId, pending.nome, pending.email, passwordHash, now, now)
              .run()

            await c.env.KV_TENANT_CACHE.delete(pendingKey)

            // Gravar token de auto-login para o frontend consumir (TTL: 10 minutos)
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
          // Tenant já existe (upgrade / segunda compra) — customer, plano e status
          const planId = plan || session.metadata?.plan
          await c.env.DB_SHARED
            .prepare(
              "UPDATE tenants SET stripe_customer_id = ?, plan_id = COALESCE(?, plan_id), status = 'active', updated_at = ? WHERE slug = ?",
            )
            .bind(session.customer, planId ?? null, new Date().toISOString(), tenantSlug)
            .run()
          await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantSlug}`)
          console.log(`[Webhook] Tenant existente atualizado (Stripe + plano): ${tenantSlug}`)
        }
      } catch (err) {
        console.error('[Webhook] ERRO em checkout.session.completed:', err)
        throw err
      }
      break
    }

    // ─── Assinatura pausada: suspender tenant ─────────────────
    case 'customer.subscription.paused': {
      const subscription = event.data.object
      const tenantRow = await c.env.DB_SHARED
        .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
        .bind(subscription.customer)
        .first<{ slug: string }>()

      await c.env.DB_SHARED
        .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
        .bind(new Date().toISOString(), subscription.customer)
        .run()

      if (tenantRow?.slug) {
        await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
        console.log(`[Webhook] Tenant suspenso (paused) e cache invalidado: ${tenantRow.slug}`)
      } else {
        console.log(`[Webhook] Tenant suspenso (paused): customer=${subscription.customer}`)
      }
      break
    }

    // ─── Assinatura retomada: reativar tenant ──────────────────
    case 'customer.subscription.resumed': {
      const subscription = event.data.object
      const tenantRow = await c.env.DB_SHARED
        .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
        .bind(subscription.customer)
        .first<{ slug: string }>()

      await c.env.DB_SHARED
        .prepare("UPDATE tenants SET status = 'active', updated_at = ? WHERE stripe_customer_id = ?")
        .bind(new Date().toISOString(), subscription.customer)
        .run()

      if (tenantRow?.slug) {
        await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
        console.log(`[Webhook] Tenant reativado (resumed) e cache invalidado: ${tenantRow.slug}`)
      } else {
        console.log(`[Webhook] Tenant reativado (resumed): customer=${subscription.customer}`)
      }
      break
    }

    // ─── Assinatura cancelada: suspender tenant ────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const tenantRow = await c.env.DB_SHARED
        .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
        .bind(subscription.customer)
        .first<{ slug: string }>()

      await c.env.DB_SHARED
        .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
        .bind(new Date().toISOString(), subscription.customer)
        .run()

      // Invalidar cache KV para forçar o middleware a reler do banco
      if (tenantRow?.slug) {
        await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
        console.log(`[Webhook] Tenant suspenso e cache invalidado: ${tenantRow.slug}`)
      } else {
        console.log(`[Webhook] Tenant suspenso: customer=${subscription.customer}`)
      }
      break
    }

    // ─── Assinatura atualizada (reativação, pausa via collection, inadimplência) ─
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const tenantRow = await c.env.DB_SHARED
        .prepare('SELECT slug FROM tenants WHERE stripe_customer_id = ?')
        .bind(subscription.customer)
        .first<{ slug: string }>()

      const SUSPEND_STATUSES = ['paused', 'past_due', 'unpaid', 'canceled']
      // pause_collection: Dashboard usa esse mecanismo para pausar cobrança
      // mantendo status=active. Quando definido, billing está congelado.
      const billingPaused = !!subscription.pause_collection

      if (billingPaused || SUSPEND_STATUSES.includes(subscription.status)) {
        await c.env.DB_SHARED
          .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
          .bind(new Date().toISOString(), subscription.customer)
          .run()

        if (tenantRow?.slug) {
          await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
          const reason = billingPaused ? 'pause_collection' : subscription.status
          console.log(`[Webhook] Tenant suspenso (${reason}) e cache invalidado: ${tenantRow.slug}`)
        } else {
          console.log(`[Webhook] Tenant suspenso (${subscription.status}): customer=${subscription.customer}`)
        }
      } else if (subscription.status === 'active') {
        await c.env.DB_SHARED
          .prepare("UPDATE tenants SET status = 'active', updated_at = ? WHERE stripe_customer_id = ?")
          .bind(new Date().toISOString(), subscription.customer)
          .run()

        if (tenantRow?.slug) {
          await c.env.KV_TENANT_CACHE.delete(`tenant:${tenantRow.slug}`)
          console.log(`[Webhook] Tenant reativado e cache invalidado: ${tenantRow.slug}`)
        }
      }
      break
    }

    // ─── Pagamento falhou: notificar ──────────────────────────
    case 'invoice.payment_failed': {
      console.warn('[Webhook] Pagamento falhou para customer:', event.data.object.customer)
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
