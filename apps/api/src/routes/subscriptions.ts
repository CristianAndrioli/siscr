import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// ─── Planos públicos ───────────────────────────────────────────
app.get('/plans', async (c) => {
  const { results: planRows } = await c.env.DB_SHARED
    .prepare(
      `SELECT id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios, features
       FROM plans WHERE ativo = 1 ORDER BY preco_mensal`,
    )
    .all<{
      id: string
      nome: string
      preco_mensal: number
      preco_anual: number
      max_empresas: number
      max_filiais: number
      max_usuarios: number
      features: string | null
    }>()

  const { results: charRows } = await c.env.DB_SHARED
    .prepare(`SELECT plan_id, rotulo, ordem FROM plan_caracteristicas ORDER BY plan_id, ordem`)
    .all<{ plan_id: string; rotulo: string; ordem: number }>()

  const byPlan = new Map<string, { rotulo: string; ordem: number }[]>()
  for (const r of charRows ?? []) {
    const list = byPlan.get(r.plan_id) ?? []
    list.push({ rotulo: r.rotulo, ordem: r.ordem })
    byPlan.set(r.plan_id, list)
  }

  const plans = (planRows ?? []).map((p) => ({
    ...p,
    caracteristicas: byPlan.get(p.id) ?? [],
  }))

  return c.json({ plans })
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
    basico:     c.env.STRIPE_PRICE_BASICO || '',
    pro:        c.env.STRIPE_PRICE_PRO || '',
    enterprise: c.env.STRIPE_PRICE_ENTERPRISE || '',
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

// ─── Portal de reativação (público — funciona mesmo para tenants suspensos) ──
// POST /api/subscriptions/reactivation-portal
// Lê a sessão do token Bearer, busca o stripe_customer_id e abre o portal
app.post('/reactivation-portal', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Não autenticado.' }, 401)
  }

  const token = authHeader.slice(7)
  const session = await c.env.KV_SESSIONS.get(`session:${token}`, 'json') as {
    tenantId?: string; tenantSlug?: string
  } | null

  if (!session?.tenantId) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  // Busca stripe_customer_id ignorando o status do tenant
  const tenant = await c.env.DB_SHARED
    .prepare('SELECT stripe_customer_id, slug, status FROM tenants WHERE id = ?')
    .bind(session.tenantId)
    .first<{ stripe_customer_id: string | null; slug: string; status: string }>()

  if (!tenant?.stripe_customer_id) {
    return c.json({ error: 'Nenhuma assinatura Stripe encontrada para esta conta.' }, 404)
  }

  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    customer: tenant.stripe_customer_id,
    return_url: `${frontendUrl}/subscription-management`,
  })

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!portalRes.ok) {
    const err = await portalRes.json() as { error?: { message?: string } }
    console.error('[ReactivationPortal] Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao abrir portal de reativação.' }, 500)
  }

  const portalSession = await portalRes.json() as { url: string }
  return c.json({ url: portalSession.url })
})

export default app
