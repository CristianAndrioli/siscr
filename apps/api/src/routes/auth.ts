import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { PasswordHasher } from '../lib/password'
import { buildSessionUserPayload } from '../lib/modulePermissions'
import { checkTenantSlugAvailability, resolveTenantSlug } from '../lib/tenantSlug'
import { hasEmailBinding, sendEmailVerification, sendPasswordResetEmail } from '../lib/email'
import { resolvePriceIdForPlan } from '../lib/stripe/stripeApi'

const app = new Hono<{ Bindings: Env }>()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  /** Opcional: se omitido, o sistema localiza o tenant pelo e-mail (uma conta). Com várias contas no mesmo e-mail, é obrigatório. */
  tenantSlug: z.string().min(1).optional(),
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nome: z.string().min(2),
  tenantNome: z.string().min(2),
  /** Vazio = gerado automaticamente a partir do nome da empresa. */
  tenantSlug: z.string().max(40).optional(),
  planId: z.string().optional(),
})

type LoginRow = {
  user_id: string
  email: string
  nome: string
  password_hash: string
  role: string
  custom_role_id: string | null
  tenant_id: string
  tenant_slug: string
  tenant_nome: string
  tenant_status: string
}

// POST /api/auth/login — e-mail + senha; tenantSlug opcional (obrigatório se o e-mail existir em mais de um tenant)
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, tenantSlug } = c.req.valid('json')
  const emailNorm = email.trim().toLowerCase()

  let rows: LoginRow[]

  if (tenantSlug?.trim()) {
    const slug = tenantSlug.toLowerCase().trim()
    const tenant = await c.env.DB_SHARED
      .prepare('SELECT id, slug, nome, status FROM tenants WHERE slug = ?')
      .bind(slug)
      .first<{ id: string; slug: string; nome: string; status: string }>()

    if (!tenant) {
      return c.json({ error: 'Identificador da empresa não encontrado.' }, 404)
    }

    const user = await c.env.DB_SHARED
      .prepare(`
        SELECT u.id as user_id, u.email, u.nome, u.password_hash, u.role, u.custom_role_id,
               t.id as tenant_id, t.slug as tenant_slug, t.nome as tenant_nome, t.status as tenant_status
        FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        WHERE LOWER(TRIM(u.email)) = ? AND u.tenant_id = ? AND u.ativo = 1
      `)
      .bind(emailNorm, tenant.id)
      .first<LoginRow>()

    if (!user) {
      return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
    }

    rows = [user]
  } else {
    const { results } = await c.env.DB_SHARED
      .prepare(`
        SELECT u.id as user_id, u.email, u.nome, u.password_hash, u.role, u.custom_role_id,
               t.id as tenant_id, t.slug as tenant_slug, t.nome as tenant_nome, t.status as tenant_status
        FROM users u
        JOIN tenants t ON t.id = u.tenant_id
        WHERE LOWER(TRIM(u.email)) = ? AND u.ativo = 1
      `)
      .bind(emailNorm)
      .all<LoginRow>()

    rows = (results ?? []) as LoginRow[]
  }

  if (rows.length === 0) {
    return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
  }

  const matches: LoginRow[] = []
  for (const row of rows) {
    if (await PasswordHasher.verify(password, row.password_hash)) matches.push(row)
  }

  if (matches.length === 0) {
    return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
  }

  const activeMatches = matches.filter((r) => r.tenant_status === 'active')
  const pool = activeMatches.length > 0 ? activeMatches : matches

  if (pool.length > 1) {
    return c.json({
      error: 'Este e-mail está vinculado a mais de uma empresa. Informe o identificador da empresa.',
      code: 'MULTIPLE_TENANTS',
      tenants: pool.map(m => ({ slug: m.tenant_slug, nome: m.tenant_nome })),
    }, 409)
  }

  const row = pool[0]!
  const billingOnly = row.tenant_status !== 'active'

  // Rehash transparente: se o hash armazenado estiver em formato legado
  // ou com iterações abaixo do alvo atual, gera um novo e atualiza.
  // Melhora a segurança da base gradualmente, sem forçar reset de senha.
  if (PasswordHasher.needsRehash(row.password_hash)) {
    try {
      const fresh = await PasswordHasher.hash(password)
      await c.env.DB_SHARED
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .bind(fresh, new Date().toISOString(), row.user_id)
        .run()
    } catch (err) {
      console.error('[auth.login] Falha ao rehashing senha:', err)
    }
  }

  const sessionToken = crypto.randomUUID()
  const SESSION_TTL = billingOnly ? 60 * 60 * 24 : 60 * 60 * 24 * 7

  const sessionData = await buildSessionUserPayload(c.env.DB_SHARED, {
    userId: row.user_id,
    email: row.email,
    nome: row.nome,
    role: row.role,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    customRoleId: row.custom_role_id,
  })

  await c.env.KV_SESSIONS.put(
    `session:${sessionToken}`,
    JSON.stringify({ ...sessionData, billingOnly }),
    { expirationTtl: SESSION_TTL },
  )

  return c.json({
    token: sessionToken,
    billingOnly,
    user: {
      id: row.user_id,
      email: row.email,
      nome: row.nome,
      role: row.role,
      modules: sessionData.modules,
      customRoleId: row.custom_role_id,
    },
    tenant: { id: row.tenant_id, slug: row.tenant_slug, nome: row.tenant_nome, status: row.tenant_status },
  })
})

// GET /api/auth/tenant-slug/availability?slug= — disponibilidade do subdomínio (tabela tenants)
app.get('/tenant-slug/availability', async (c) => {
  const slug = c.req.query('slug') ?? ''
  const result = await checkTenantSlugAvailability(c.env.DB_SHARED, slug)
  return c.json(result)
})

// POST /api/auth/signup — cria tenant + usuário admin (plano free)
app.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, nome, tenantNome, tenantSlug, planId } = c.req.valid('json')

  const resolved = await resolveTenantSlug(c.env.DB_SHARED, tenantNome, tenantSlug?.trim() || null)
  if ('error' in resolved) {
    return c.json({ error: resolved.error }, 400)
  }
  const finalSlug = resolved.slug

  const tenantId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const passwordHash = await PasswordHasher.hash(password)
  const now = new Date().toISOString()

  // Criar tenant e usuário admin atomicamente
  await c.env.DB_SHARED.batch([
    c.env.DB_SHARED.prepare(
      'INSERT INTO tenants (id, slug, nome, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tenantId, finalSlug, tenantNome, planId ?? 'free', 'active', now),

    c.env.DB_SHARED.prepare(
      'INSERT INTO users (id, tenant_id, email, password_hash, nome, role, ativo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).bind(userId, tenantId, email, passwordHash, nome, 'admin', now),
  ])

  const sessionToken = crypto.randomUUID()
  const SESSION_TTL = 60 * 60 * 24 * 7

  const sessionData = await buildSessionUserPayload(c.env.DB_SHARED, {
    userId,
    email,
    nome,
    role: 'admin',
    tenantId,
    tenantSlug: finalSlug,
    customRoleId: null,
  })

  await c.env.KV_SESSIONS.put(`session:${sessionToken}`, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL })

  return c.json({
    message: 'Conta criada com sucesso!',
    tenantSlug: finalSlug,
    token: sessionToken,
    user: { id: userId, email, nome, role: 'admin', modules: sessionData.modules, customRoleId: null },
    tenant: { id: tenantId, slug: finalSlug, nome: tenantNome, status: 'active' },
  }, 201)
})

// GET /api/auth/session-status?tenant=slug — verifica se tenant foi criado (pós-Stripe)
app.get('/session-status', async (c) => {
  const tenantSlug = c.req.query('tenant')
  if (!tenantSlug) {
    return c.json({ error: 'Parâmetro tenant obrigatório.' }, 400)
  }

  // Verificar se tenant existe e está ativo
  const tenant = await c.env.DB_SHARED
    .prepare('SELECT id, slug, nome, status FROM tenants WHERE slug = ? AND status = ?')
    .bind(tenantSlug, 'active')
    .first<{ id: string; slug: string; nome: string; status: string }>()

  if (!tenant) {
    return c.json({ status: 'pending' })
  }

  // Verificar se há token de auto-login disponível (gravado pelo webhook)
  const autoLoginRaw = await c.env.KV_SESSIONS.get(`auto_login:${tenantSlug}`)
  if (!autoLoginRaw) {
    // Tenant existe mas token já foi consumido ou expirou — pedir login manual
    return c.json({ status: 'ready', requiresLogin: true })
  }

  const autoLogin = JSON.parse(autoLoginRaw) as {
    email: string; userId: string; tenantId: string; tenantSlug: string
  }

  // Buscar dados completos do usuário
  const user = await c.env.DB_SHARED
    .prepare('SELECT id, email, nome, role, custom_role_id FROM users WHERE id = ? AND tenant_id = ?')
    .bind(autoLogin.userId, tenant.id)
    .first<{ id: string; email: string; nome: string; role: string; custom_role_id: string | null }>()

  if (!user) {
    return c.json({ status: 'ready', requiresLogin: true })
  }

  // Criar sessão e consumir o token de auto-login (one-time use)
  const sessionToken = crypto.randomUUID()
  const SESSION_TTL = 60 * 60 * 24 * 7 // 7 dias

  const sessionData = await buildSessionUserPayload(c.env.DB_SHARED, {
    userId: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    customRoleId: user.custom_role_id,
  })

  await c.env.KV_SESSIONS.put(`session:${sessionToken}`, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL })

  await c.env.KV_SESSIONS.delete(`auto_login:${tenantSlug}`)

  return c.json({
    status: 'ready',
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      modules: sessionData.modules,
      customRoleId: user.custom_role_id,
    },
    tenant: { id: tenant.id, slug: tenant.slug, nome: tenant.nome, status: tenant.status },
  })
})

// POST /api/auth/request-email-verification — armazena dados de cadastro no KV e envia e-mail de verificação
app.post('/request-email-verification', async (c) => {
  const body = await c.req.json<{
    nome: string; email: string; password: string
    tenantNome: string; tenantSlug: string; plan: string
  }>()

  const { nome, email, password, tenantNome, tenantSlug, plan } = body
  if (!nome || !email || !password || !tenantNome || !tenantSlug || !plan) {
    return c.json({ error: 'Todos os campos são obrigatórios.' }, 400)
  }

  if (!hasEmailBinding(c.env)) {
    return c.json({ error: 'Serviço de e-mail não configurado.' }, 503)
  }

  const token = crypto.randomUUID()
  const key = `email_verify:${token}`
  await c.env.KV_TENANT_CACHE.put(key, JSON.stringify({ nome, email, password, tenantNome, tenantSlug, plan }), {
    expirationTtl: 60 * 60 * 24, // 24h
  })

  await sendEmailVerification(c.env, email, nome, token)

  return c.json({ message: 'E-mail de verificação enviado.' })
})

// GET /api/auth/verify-email?token= — valida token e cria conta (free) ou retorna URL do Stripe (paid)
app.get('/verify-email', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Token ausente.' }, 400)

  const raw = await c.env.KV_TENANT_CACHE.get(`email_verify:${token}`)
  if (!raw) return c.json({ error: 'Link inválido ou expirado.' }, 410)

  const data = JSON.parse(raw) as {
    nome: string; email: string; password: string
    tenantNome: string; tenantSlug: string; plan: string
  }

  await c.env.KV_TENANT_CACHE.delete(`email_verify:${token}`)

  const FREE_PLANS = ['free', 'trial']

  if (FREE_PLANS.includes(data.plan)) {
    // Criar conta imediatamente
    const resolved = await resolveTenantSlug(c.env.DB_SHARED, data.tenantNome, data.tenantSlug)
    if ('error' in resolved) return c.json({ error: resolved.error }, 400)

    const tenantId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const passwordHash = await PasswordHasher.hash(data.password)
    const now = new Date().toISOString()

    await c.env.DB_SHARED.batch([
      c.env.DB_SHARED.prepare(
        'INSERT INTO tenants (id, slug, nome, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(tenantId, resolved.slug, data.tenantNome, 'free', 'active', now),
      c.env.DB_SHARED.prepare(
        'INSERT INTO users (id, tenant_id, email, password_hash, nome, role, ativo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
      ).bind(userId, tenantId, data.email, passwordHash, data.nome, 'admin', now),
    ])

    const sessionToken = crypto.randomUUID()
    const sessionData = await buildSessionUserPayload(c.env.DB_SHARED, {
      userId, email: data.email, nome: data.nome, role: 'admin',
      tenantId, tenantSlug: resolved.slug, customRoleId: null,
    })
    await c.env.KV_SESSIONS.put(`session:${sessionToken}`, JSON.stringify(sessionData), { expirationTtl: 60 * 60 * 24 * 7 })

    return c.json({ action: 'free', tenantSlug: resolved.slug, token: sessionToken, user: { id: userId, email: data.email, nome: data.nome, role: 'admin', modules: sessionData.modules }, tenant: { id: tenantId, slug: resolved.slug, nome: data.tenantNome, status: 'active' } })
  }

  // Plano pago: criar sessão Stripe
  const priceId = await resolvePriceIdForPlan(c.env, c.env.DB_SHARED, data.plan)
  if (!priceId) return c.json({ error: 'Plano inválido.' }, 400)

  const resolvedPaid = await resolveTenantSlug(c.env.DB_SHARED, data.tenantNome, data.tenantSlug)
  if ('error' in resolvedPaid) return c.json({ error: resolvedPaid.error }, 400)
  const finalSlug = resolvedPaid.slug

  const emailNorm = data.email.trim().toLowerCase()

  // O KV recebe apenas o hash — o webhook grava direto em `users.password_hash`
  // e valida este payload com `pendingSignupSchema`, que exige `passwordHash`.
  const pendingKey = `pending_signup:${finalSlug}`
  await c.env.KV_TENANT_CACHE.put(
    pendingKey,
    JSON.stringify({
      nome: data.nome,
      email: emailNorm,
      passwordHash: await PasswordHasher.hash(data.password),
      tenantNome: data.tenantNome,
      tenantSlug: finalSlug,
      plan: data.plan,
    }),
    { expirationTtl: 3600 },
  )

  const frontendUrl = c.env.FRONTEND_URL
  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: emailNorm,
    success_url: `${frontendUrl}/checkout/success?tenant=${encodeURIComponent(finalSlug)}`,
    cancel_url: `${frontendUrl}/checkout/cancel`,
    'metadata[tenantSlug]': finalSlug,
    'metadata[plan]': data.plan,
    'subscription_data[metadata][tenantSlug]': finalSlug,
    'subscription_data[metadata][plan]': data.plan,
    'subscription_data[trial_period_days]': '14',
    allow_promotion_codes: 'true',
  })

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } }
    return c.json({ error: err.error?.message || 'Erro ao criar sessão de pagamento.' }, 500)
  }

  const session = await stripeRes.json() as { url: string; id: string }
  return c.json({ action: 'stripe', url: session.url, sessionId: session.id })
})

// POST /api/auth/forgot-password — gera token e envia e-mail de redefinição
app.post('/forgot-password', zValidator('json', z.object({ email: z.string().email() })), async (c) => {
  const { email } = c.req.valid('json')

  if (!hasEmailBinding(c.env)) {
    return c.json({ message: 'Se o e-mail existir, você receberá as instruções em breve.' })
  }

  const user = await c.env.DB_SHARED
    .prepare('SELECT id, nome, email FROM users WHERE LOWER(TRIM(email)) = ? AND ativo = 1 LIMIT 1')
    .bind(email.trim().toLowerCase())
    .first<{ id: string; nome: string; email: string }>()

  if (user) {
    const token = crypto.randomUUID()
    await c.env.KV_SESSIONS.put(`password_reset:${user.id}:${token}`, '1', { expirationTtl: 3600 })

    await sendPasswordResetEmail(c.env, user.email, user.nome, user.id, token)
  }

  // Sempre retorna 200 para não revelar se o e-mail existe
  return c.json({ message: 'Se o e-mail existir, você receberá as instruções em breve.' })
})

// POST /api/auth/reset-password — valida token e atualiza a senha
app.post('/reset-password', zValidator('json', z.object({
  uid: z.string().uuid(),
  token: z.string().uuid(),
  newPassword: z.string().min(8),
})), async (c) => {
  const { uid, token, newPassword } = c.req.valid('json')

  const valid = await c.env.KV_SESSIONS.get(`password_reset:${uid}:${token}`)
  if (!valid) return c.json({ error: 'Link inválido ou expirado.' }, 410)

  const passwordHash = await PasswordHasher.hash(newPassword)
  const result = await c.env.DB_SHARED
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(passwordHash, new Date().toISOString(), uid)
    .run()

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado.' }, 404)

  await c.env.KV_SESSIONS.delete(`password_reset:${uid}:${token}`)

  return c.json({ message: 'Senha redefinida com sucesso.' })
})

// POST /api/auth/logout
app.post('/logout', async (c) => {  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    await c.env.KV_SESSIONS.delete(`session:${token}`)
  }
  return c.json({ message: 'Logout realizado.' })
})

// GET /api/auth/me
app.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Não autenticado.' }, 401)
  }
  const token = authHeader.slice(7)
  const session = await c.env.KV_SESSIONS.get(`session:${token}`, 'json')
  if (!session) {
    return c.json({ error: 'Sessão inválida.' }, 401)
  }
  return c.json(session)
})

export default app
