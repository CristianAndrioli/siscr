import { Hono } from 'hono'
import type { Env } from '../index'

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
      const session = event.data.object
      const tenantSlug = session.metadata?.tenantSlug
      const plan = session.metadata?.plan

      if (!tenantSlug) break

      // Verificar se tenant já existe (proteção contra duplicatas)
      const existing = await c.env.DB_SHARED
        .prepare('SELECT id FROM tenants WHERE slug = ?')
        .bind(tenantSlug)
        .first()

      if (!existing) {
        // Recuperar dados pendentes do KV
        const pendingKey = `pending_signup:${tenantSlug}`
        const pendingRaw = await c.env.KV_TENANT_CACHE.get(pendingKey)

        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as {
            nome: string; email: string; password: string;
            tenantNome: string; tenantSlug: string; plan: string
          }

          // Buscar plan_id pelo slug do plano
          const planRow = await c.env.DB_SHARED
            .prepare('SELECT id FROM plans WHERE nome LIKE ? LIMIT 1')
            .bind(`%${plan || pending.plan}%`)
            .first<{ id: number }>()

          const now = new Date().toISOString()
          const tenantId = crypto.randomUUID()

          // Hash da senha via Web Crypto
          const passwordHash = await hashPassword(pending.password)

          // Criar tenant + usuário em transação
          await c.env.DB_SHARED.batch([
            c.env.DB_SHARED.prepare(`
              INSERT INTO tenants (id, nome, slug, plan_id, stripe_customer_id, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
            `).bind(tenantId, pending.tenantNome, tenantSlug, planRow?.id ?? pending.plan, session.customer ?? null, now, now),

            c.env.DB_SHARED.prepare(`
              INSERT INTO users (id, tenant_id, nome, email, password_hash, role, ativo, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)
            `).bind(crypto.randomUUID(), tenantId, pending.nome, pending.email, passwordHash, now, now),
          ])

          // Remover dados pendentes do KV
          await c.env.KV_TENANT_CACHE.delete(pendingKey)

          console.log(`[Webhook] Tenant criado: ${tenantSlug} (${pending.email})`)
        } else {
          // Dados pendentes não encontrados — apenas atualizar se já existia
          console.warn(`[Webhook] Dados pendentes não encontrados para: ${tenantSlug}`)
        }
      } else {
        // Tenant já existe — apenas atualizar status e customer_id
        await c.env.DB_SHARED
          .prepare("UPDATE tenants SET stripe_customer_id = ?, status = 'active', updated_at = ? WHERE slug = ?")
          .bind(session.customer, new Date().toISOString(), tenantSlug)
          .run()
      }
      break
    }

    // ─── Assinatura cancelada: suspender tenant ────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      await c.env.DB_SHARED
        .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
        .bind(new Date().toISOString(), subscription.customer)
        .run()
      console.log(`[Webhook] Tenant suspenso: customer=${subscription.customer}`)
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

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
