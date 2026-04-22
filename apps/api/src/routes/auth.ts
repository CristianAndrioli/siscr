import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { PasswordHasher } from '../lib/password'
import { buildSessionUserPayload } from '../lib/modulePermissions'
import { checkTenantSlugAvailability, resolveTenantSlug } from '../lib/tenantSlug'

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

    if (tenant.status !== 'active') {
      return c.json({
        error: 'Sua assinatura está suspensa ou cancelada.',
        tenantStatus: tenant.status,
        tenant: { id: tenant.id, slug: tenant.slug, nome: tenant.nome, status: tenant.status },
      }, 403)
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
    if (row.tenant_status !== 'active') continue
    if (await PasswordHasher.verify(password, row.password_hash)) matches.push(row)
  }

  if (matches.length === 0) {
    const suspended = rows.find(r => r.tenant_status !== 'active')
    if (suspended && rows.every(r => r.tenant_status !== 'active')) {
      return c.json({
        error: 'Sua assinatura está suspensa ou cancelada.',
        tenantStatus: suspended.tenant_status,
        tenant: {
          id: suspended.tenant_id,
          slug: suspended.tenant_slug,
          nome: suspended.tenant_nome,
          status: suspended.tenant_status,
        },
      }, 403)
    }
    return c.json({ error: 'E-mail ou senha incorretos.' }, 401)
  }

  if (matches.length > 1) {
    return c.json({
      error: 'Este e-mail está vinculado a mais de uma empresa. Informe o identificador da empresa.',
      code: 'MULTIPLE_TENANTS',
      tenants: matches.map(m => ({ slug: m.tenant_slug, nome: m.tenant_nome })),
    }, 409)
  }

  const row = matches[0]!

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
  const SESSION_TTL = 60 * 60 * 24 * 7

  const sessionData = await buildSessionUserPayload(c.env.DB_SHARED, {
    userId: row.user_id,
    email: row.email,
    nome: row.nome,
    role: row.role,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    customRoleId: row.custom_role_id,
  })

  await c.env.KV_SESSIONS.put(`session:${sessionToken}`, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL })

  return c.json({
    token: sessionToken,
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

// POST /api/auth/logout
app.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
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
