import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { resolveTenantSlug } from '../lib/tenantSlug'
import { PasswordHasher } from '../lib/password'
import { resolvePriceIdForPlan } from '../lib/stripe/stripeApi'

/**
 * Rotas públicas de planos e checkout Stripe (signup pago).
 *
 * SEGURANÇA
 * -----------------------------------------------------------------
 * O `/checkout` grava dados do signup pendente no KV durante a janela
 * em que o usuário finaliza o pagamento no Stripe. Para NUNCA manter a
 * senha em plaintext no KV, o hash é calculado aqui e só o `passwordHash`
 * vai para o KV. O webhook (`routes/stripe-webhook.ts`) persiste o hash
 * direto em `users.password_hash`.
 *
 * O body do KV é validado com Zod no webhook antes de ser consumido.
 */
const app = new Hono<{ Bindings: Env }>()

// ─── Planos públicos ───────────────────────────────────────────
app.get('/plans', async (c) => {
  const { results: planRows } = await c.env.DB_SHARED
    .prepare(
      `SELECT id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios,
              COALESCE(max_docs_fiscais_mes, 0) AS max_docs_fiscais_mes,
              COALESCE(max_emails_mes, 0) AS max_emails_mes, features
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
      max_docs_fiscais_mes: number
      max_emails_mes: number
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
/**
 * Schema partilhado com o webhook para deserialização segura do body
 * gravado em KV. Ver `routes/stripe-webhook.ts`.
 */
const checkoutBodySchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantNome: z.string().trim().min(2),
  tenantSlug: z.string().trim().max(40).optional(),
  plan: z.string().trim().min(1),
})

app.post('/checkout', zValidator('json', checkoutBodySchema), async (c) => {
  const { nome, email, password, tenantNome, tenantSlug, plan } = c.req.valid('json')

  const resolved = await resolveTenantSlug(c.env.DB_SHARED, tenantNome, tenantSlug?.trim() || null)
  if ('error' in resolved) {
    return c.json({ error: resolved.error }, 400)
  }
  const finalSlug = resolved.slug

  // Verificar se email já existe
  const emailNorm = email.trim().toLowerCase()
  const existingEmail = await c.env.DB_SHARED
    .prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?')
    .bind(emailNorm)
    .first()

  if (existingEmail) {
    return c.json({ error: 'Esse e-mail já está cadastrado.' }, 409)
  }

  const priceId = await resolvePriceIdForPlan(c.env, c.env.DB_SHARED, plan)
  if (!priceId) {
    return c.json({ error: 'Plano inválido para checkout.' }, 400)
  }

  // ─── Hash da senha ANTES de gravar no KV ──────────────────────
  // A senha nunca trafega ao KV em plaintext. Em caso de vazamento
  // do token de API do KV, as credenciais pendentes permanecem
  // protegidas pelo mesmo esquema que a base (PBKDF2 600k).
  const passwordHash = await PasswordHasher.hash(password)

  // Guardar dados pendentes no KV (expira em 1 hora — TTL estreito
  // proposital: pagamento Stripe normalmente demora < 5 min).
  const pendingKey = `pending_signup:${finalSlug}`
  await c.env.KV_TENANT_CACHE.put(
    pendingKey,
    JSON.stringify({
      nome,
      email: emailNorm,
      passwordHash,
      tenantNome,
      tenantSlug: finalSlug,
      plan,
    }),
    { expirationTtl: 3600 },
  )

  // Criar sessão Stripe via API REST (sem SDK, compatível com Workers)
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'customer_email': emailNorm,
    'success_url': `${frontendUrl}/checkout/success?tenant=${encodeURIComponent(finalSlug)}`,
    'cancel_url': `${frontendUrl}/checkout/cancel`,
    'metadata[tenantSlug]': finalSlug,
    'metadata[plan]': plan,
    'subscription_data[metadata][tenantSlug]': finalSlug,
    'subscription_data[metadata][plan]': plan,
    'subscription_data[trial_period_days]': '14',
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

// GET /api/subscriptions/billing-status — status do tenant pela sessão (inclui suspenso)
app.get('/billing-status', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Não autenticado.' }, 401)
  }

  const token = authHeader.slice(7)
  const session = await c.env.KV_SESSIONS.get(`session:${token}`, 'json') as {
    tenantId?: string
    billingOnly?: boolean
  } | null

  if (!session?.tenantId) {
    return c.json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  const tenant = await c.env.DB_SHARED
    .prepare('SELECT status, slug FROM tenants WHERE id = ?')
    .bind(session.tenantId)
    .first<{ status: string; slug: string }>()

  if (!tenant) {
    return c.json({ error: 'Tenant não encontrado.' }, 404)
  }

  return c.json({
    status: tenant.status,
    slug: tenant.slug,
    billingOnly: session.billingOnly === true,
  })
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
    return_url: `${frontendUrl}/subscription-expired`,
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

/** Exportar schema para o webhook reutilizar a validação do body persistido em KV. */
export const pendingSignupSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  passwordHash: z.string().min(10),
  tenantNome: z.string().min(2),
  tenantSlug: z.string().min(1),
  plan: z.string().min(1),
})

export default app
