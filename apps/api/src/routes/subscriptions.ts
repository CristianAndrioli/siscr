import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// ─── Planos públicos ───────────────────────────────────────────
app.get('/plans', async (c) => {
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios, features FROM plans WHERE ativo = 1 ORDER BY preco_mensal')
    .all()

  return c.json({ plans: results })
})

// ─── Criar sessão de checkout Stripe ──────────────────────────
// POST /api/subscriptions/checkout
// Body: { nome, email, password, tenantNome, tenantSlug, plan }
app.post('/checkout', async (c) => {
  const body = await c.req.json<{
    nome: string
    email: string
    password: string
    tenantNome: string
    tenantSlug: string
    plan: string
  }>()

  const { nome, email, password, tenantNome, tenantSlug, plan } = body

  if (!nome || !email || !password || !tenantNome || !tenantSlug || !plan) {
    return c.json({ error: 'Todos os campos são obrigatórios.' }, 400)
  }

  // Validar slug
  if (!/^[a-z0-9-]{3,30}$/.test(tenantSlug)) {
    return c.json({ error: 'Identificador inválido. Use letras minúsculas, números e hífens.' }, 400)
  }

  // Verificar se slug já existe
  const existing = await c.env.DB_SHARED
    .prepare('SELECT id FROM tenants WHERE slug = ?')
    .bind(tenantSlug)
    .first()

  if (existing) {
    return c.json({ error: 'Esse identificador já está em uso. Escolha outro.' }, 409)
  }

  // Verificar se email já existe
  const existingEmail = await c.env.DB_SHARED
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first()

  if (existingEmail) {
    return c.json({ error: 'Esse e-mail já está cadastrado.' }, 409)
  }

  // Mapear plano para Price ID do Stripe
  const STRIPE_PRICE_IDS: Record<string, string> = {
    starter:  c.env.STRIPE_PRICE_STARTER || '',
    business: c.env.STRIPE_PRICE_BUSINESS || '',
  }

  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    return c.json({ error: 'Plano inválido para checkout.' }, 400)
  }

  // Guardar dados pendentes no KV (expira em 1 hora)
  const pendingKey = `pending_signup:${tenantSlug}`
  await c.env.KV_TENANT_CACHE.put(pendingKey, JSON.stringify({
    nome, email, password, tenantNome, tenantSlug, plan,
  }), { expirationTtl: 3600 })

  // Criar sessão Stripe via API REST (sem SDK, compatível com Workers)
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'customer_email': email,
    'success_url': `${frontendUrl}/checkout/success?tenant=${tenantSlug}`,
    'cancel_url': `${frontendUrl}/checkout/cancel`,
    'metadata[tenantSlug]': tenantSlug,
    'metadata[plan]': plan,
    'allow_promotion_codes': 'true',
  })

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } }
    console.error('Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao criar sessão de pagamento.' }, 500)
  }

  const session = await stripeRes.json() as { url: string; id: string }
  return c.json({ url: session.url, sessionId: session.id })
})

export default app
