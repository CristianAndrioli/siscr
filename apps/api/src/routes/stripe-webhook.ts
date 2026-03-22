import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// POST /api/webhooks/stripe
app.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Assinatura ausente.' }, 400)

  const rawBody = await c.req.text()

  // Verificar assinatura do webhook Stripe
  const isValid = await verifyStripeSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) return c.json({ error: 'Assinatura inválida.' }, 401)

  const event = JSON.parse(rawBody)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const tenantSlug = session.metadata?.tenant_slug

      if (tenantSlug) {
        await c.env.DB_SHARED
          .prepare("UPDATE tenants SET plan_id = ?, stripe_customer_id = ?, status = 'active', updated_at = ? WHERE slug = ?")
          .bind(session.metadata.plan_id, session.customer, new Date().toISOString(), tenantSlug)
          .run()
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      await c.env.DB_SHARED
        .prepare("UPDATE tenants SET status = 'suspended', updated_at = ? WHERE stripe_customer_id = ?")
        .bind(new Date().toISOString(), subscription.customer)
        .run()
      break
    }

    case 'invoice.payment_failed': {
      console.warn('Pagamento falhou para customer:', event.data.object.customer)
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
