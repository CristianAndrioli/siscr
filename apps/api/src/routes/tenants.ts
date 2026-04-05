import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { hashPassword } from '../lib/password'
import { createEmpresaFilialService, createTenantInfoService } from '../services/tenant/factory'

function jsonHttpError(c: { json: (b: unknown, s?: number) => Response }, e: unknown) {
  if (e instanceof Error && typeof (e as Error & { status?: number }).status === 'number') {
    const status = (e as Error & { status: number }).status
    return c.json({ error: e.message }, status)
  }
  throw e
}

const app = new Hono<{ Bindings: Env }>()

// GET /api/tenant/info — dados do tenant atual
app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const info = createTenantInfoService(c.env.DB_SHARED, tenant.tenantId)
  const data = await info.getTenant()
  return c.json({ tenant: data, currentUser: user })
})

// GET /api/tenant/info/empresas — listar empresas do tenant
app.get('/empresas', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const empresas = await svc.listEmpresas()
  return c.json({ empresas })
})

// POST /api/tenant/info/empresas — criar empresa
const empresaSchema = z.object({
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().length(14),
  inscricaoEstadual: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().length(2).optional(),
  cep: z.string().optional(),
})

app.post('/empresas', zValidator('json', empresaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const id = await svc.createEmpresa(data)
  return c.json({ id, message: 'Empresa criada com sucesso.' }, 201)
})

// GET /api/tenant/info/empresas/:id/filiais
app.get('/empresas/:id/filiais', async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const filiais = await svc.listFiliaisByEmpresa(empresaId)
    return c.json({ filiais })
  } catch (e) {
    return jsonHttpError(c, e)
  }
})

// POST /api/tenant/info/empresas/:id/filiais — criar filial
const filialSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional(),
  uf: z.string().length(2).optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
})

app.post('/empresas/:id/filiais', zValidator('json', filialSchema), async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const data = c.req.valid('json')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const id = await svc.createFilial(empresaId, data)
    return c.json({ id, message: 'Filial criada com sucesso.' }, 201)
  } catch (e) {
    return jsonHttpError(c, e)
  }
})

// PUT /api/tenant/info/empresas/:id — atualizar empresa
app.put('/empresas/:id', zValidator('json', empresaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as Record<string, unknown>
  const id = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.updateEmpresa(id, data)
  return c.json({ message: 'Empresa atualizada.' })
})

// DELETE /api/tenant/info/empresas/:id
app.delete('/empresas/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.deleteEmpresa(c.req.param('id'))
  return c.json({ message: 'Empresa removida.' })
})

// GET /api/tenant/info/filiais — todas as filiais do tenant
app.get('/filiais', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const filiais = await svc.listAllFiliais()
  return c.json({ filiais })
})

// PUT /api/tenant/info/filiais/:id
app.put('/filiais/:id', zValidator('json', filialSchema.partial().extend({ ativa: z.boolean().optional() })), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as Record<string, unknown> & { ativa?: boolean }
  const id = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.updateFilial(id, data)
  return c.json({ message: 'Filial atualizada.' })
})

// DELETE /api/tenant/info/filiais/:id
app.delete('/filiais/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.deleteFilial(c.req.param('id'))
  return c.json({ message: 'Filial removida.' })
})

// ─── Usuários ─────────────────────────────────────────────────────

// GET /api/tenant/info/usuarios
app.get('/usuarios', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT u.id, u.email, u.nome, u.role, u.ativo, u.created_at, u.custom_role_id,
            r.nome AS custom_role_nome
     FROM users u
     LEFT JOIN tenant_custom_roles r ON r.id = u.custom_role_id AND r.tenant_id = u.tenant_id
     WHERE u.tenant_id = ? ORDER BY u.nome`
  ).bind(tenant.tenantId).all()
  return c.json({ usuarios: results })
})

const userSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).default('user'),
  senha: z.string().min(6).optional(),
  customRoleId: z.string().uuid().nullable().optional(),
})

// POST /api/tenant/info/usuarios
app.post('/usuarios', zValidator('json', userSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM users WHERE email = ? AND tenant_id = ?')
    .bind(data.email, tenant.tenantId).first()
  if (exists) return c.json({ error: 'Já existe um usuário com este e-mail.' }, 400)

  let customRoleId: string | null = data.customRoleId ?? null
  if (customRoleId) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
      .bind(customRoleId, tenant.tenantId).first()
    if (!ok) return c.json({ error: 'Perfil personalizado inválido.' }, 400)
  }
  if (data.role === 'admin') customRoleId = null

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(data.senha ?? 'Mudar@123')

  await c.env.DB_SHARED.prepare(
    'INSERT INTO users (id, tenant_id, email, nome, password_hash, role, ativo, created_at, custom_role_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(id, tenant.tenantId, data.email, data.nome, passwordHash, data.role, now, customRoleId).run()

  return c.json({ id, message: 'Usuário criado.' }, 201)
})

const userUpdateSchema = userSchema.partial().omit({ senha: true }).extend({
  ativo: z.boolean().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
})

// PUT /api/tenant/info/usuarios/:id
app.put('/usuarios/:id', zValidator('json', userUpdateSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const cur = await c.env.DB_SHARED
    .prepare('SELECT role, custom_role_id FROM users WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ role: string; custom_role_id: string | null }>()
  if (!cur) return c.json({ error: 'Usuário não encontrado.' }, 404)

  const nextRole = data.role ?? cur.role
  let nextCustom: string | null =
    data.customRoleId !== undefined ? data.customRoleId : cur.custom_role_id

  if (nextCustom) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
      .bind(nextCustom, tenant.tenantId).first()
    if (!ok) return c.json({ error: 'Perfil personalizado inválido.' }, 400)
  } else {
    nextCustom = null
  }
  const finalCustom = nextRole === 'admin' ? null : nextCustom

  const fields = ['updated_at = ?']
  const vals: unknown[] = [now]
  if (data.nome !== undefined) { fields.push('nome = ?'); vals.push(data.nome) }
  if (data.email !== undefined) { fields.push('email = ?'); vals.push(data.email) }
  if (data.role !== undefined) { fields.push('role = ?'); vals.push(data.role) }
  if (data.ativo !== undefined) { fields.push('ativo = ?'); vals.push(data.ativo ? 1 : 0) }
  if (data.customRoleId !== undefined || data.role !== undefined) {
    fields.push('custom_role_id = ?')
    vals.push(finalCustom)
  }

  await c.env.DB_SHARED.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals, id, tenant.tenantId).run()
  return c.json({ message: 'Usuário atualizado.' })
})

// DELETE /api/tenant/info/usuarios/:id
app.delete('/usuarios/:id', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  if (user.userId === c.req.param('id')) return c.json({ error: 'Não é possível excluir seu próprio usuário.' }, 400)
  await c.env.DB_SHARED.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Usuário removido.' })
})

const subscriptionCheckoutSchema = z.object({
  plan: z.enum(['basico', 'pro', 'enterprise']),
})

// POST /api/tenant/info/subscription/checkout — sessão Stripe para upgrade (tenant ativo + usuário logado)
app.post('/subscription/checkout', zValidator('json', subscriptionCheckoutSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const { plan } = c.req.valid('json')

  const STRIPE_PRICE_IDS: Record<string, string> = {
    basico: c.env.STRIPE_PRICE_BASICO || '',
    pro: c.env.STRIPE_PRICE_PRO || '',
    enterprise: c.env.STRIPE_PRICE_ENTERPRISE || '',
  }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    return c.json({ error: 'Este plano não está configurado para checkout (Stripe).' }, 400)
  }

  const row = await c.env.DB_SHARED
    .prepare('SELECT slug, stripe_customer_id FROM tenants WHERE id = ?')
    .bind(tenant.tenantId)
    .first<{ slug: string; stripe_customer_id: string | null }>()

  if (!row) return c.json({ error: 'Tenant não encontrado.' }, 404)

  const u = await c.env.DB_SHARED
    .prepare('SELECT email FROM users WHERE id = ? AND tenant_id = ?')
    .bind(user.userId, tenant.tenantId)
    .first<{ email: string }>()

  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'success_url': `${frontendUrl}/checkout/success?tenant=${encodeURIComponent(row.slug)}`,
    'cancel_url': `${frontendUrl}/checkout/cancel`,
    'metadata[tenantSlug]': row.slug,
    'metadata[plan]': plan,
    'metadata[flow]': 'tenant_upgrade',
    'allow_promotion_codes': 'true',
  })

  if (row.stripe_customer_id) {
    params.set('customer', row.stripe_customer_id)
  } else if (u?.email) {
    params.set('customer_email', u.email)
  } else {
    return c.json({ error: 'Não foi possível identificar o e-mail para o checkout.' }, 400)
  }

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
    console.error('[SubscriptionCheckout] Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao criar sessão de pagamento.' }, 500)
  }

  const session = await stripeRes.json() as { url: string; id: string }
  return c.json({ url: session.url, sessionId: session.id })
})

// POST /api/tenant/info/subscription/portal — abre o Stripe Customer Portal
app.post('/subscription/portal', async (c) => {
  const tenant = c.get('tenant')

  const tenantData = await c.env.DB_SHARED
    .prepare('SELECT stripe_customer_id, plan_id, status FROM tenants WHERE id = ?')
    .bind(tenant.tenantId)
    .first<{ stripe_customer_id: string | null; plan_id: string; status: string }>()

  if (!tenantData?.stripe_customer_id) {
    return c.json({ error: 'Nenhuma assinatura Stripe ativa para este tenant.' }, 404)
  }

  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    customer: tenantData.stripe_customer_id,
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
    console.error('[Portal] Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao abrir portal de assinatura.' }, 500)
  }

  const portalSession = await portalRes.json() as { url: string }
  return c.json({ url: portalSession.url })
})

// GET /api/tenant/info/subscription — dados da assinatura atual
app.get('/subscription', async (c) => {
  const tenant = c.get('tenant')

  const data = await c.env.DB_SHARED
    .prepare(`
      SELECT t.plan_id, t.status, t.stripe_customer_id, t.subscription_expires_at,
             p.nome as plan_nome, p.preco_mensal, p.preco_anual,
             p.max_empresas, p.max_filiais, p.max_usuarios
      FROM tenants t
      LEFT JOIN plans p ON p.id = t.plan_id
      WHERE t.id = ?
    `)
    .bind(tenant.tenantId)
    .first()

  return c.json({ subscription: data })
})

export default app
