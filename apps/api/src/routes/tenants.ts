import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /api/tenant/info — dados do tenant atual
app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')

  const data = await c.env.DB_SHARED
    .prepare('SELECT id, slug, nome, plan_id, status, created_at FROM tenants WHERE id = ?')
    .bind(tenant.tenantId)
    .first()

  return c.json({ tenant: data, currentUser: user })
})

// GET /api/tenant/info/empresas — listar empresas do tenant
app.get('/empresas', async (c) => {
  const tenant = c.get('tenant')
  const db = c.env.DB_SHARED

  const { results } = await db
    .prepare(`
      SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.created_at,
             (SELECT COUNT(*) FROM filiais f WHERE f.empresa_id = e.id) as total_filiais
      FROM empresas e
      WHERE e.tenant_id = ?
      ORDER BY e.razao_social
    `)
    .bind(tenant.tenantId)
    .all()

  return c.json({ empresas: results })
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
  const id = crypto.randomUUID()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO empresas (id, tenant_id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
        email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId, data.razaoSocial, data.nomeFantasia ?? null, data.cnpj,
      data.inscricaoEstadual ?? null, data.email ?? null, data.telefone ?? null,
      data.logradouro ?? null, data.numero ?? null, data.complemento ?? null,
      data.bairro ?? null, data.cidade ?? null, data.uf ?? null, data.cep ?? null,
      new Date().toISOString()
    )
    .run()

  return c.json({ id, message: 'Empresa criada com sucesso.' }, 201)
})

// GET /api/tenant/info/empresas/:id/filiais
app.get('/empresas/:id/filiais', async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')

  const { results } = await c.env.DB_SHARED
    .prepare(`
      SELECT id, nome, cnpj, uf, cidade, ativa, created_at
      FROM filiais
      WHERE empresa_id = ? AND tenant_id = ?
      ORDER BY nome
    `)
    .bind(empresaId, tenant.tenantId)
    .all()

  return c.json({ filiais: results })
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
  const id = crypto.randomUUID()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO filiais (id, tenant_id, empresa_id, nome, cnpj, uf, cidade, logradouro, numero, bairro, cep, ativa, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId, empresaId, data.nome, data.cnpj ?? null,
      data.uf ?? null, data.cidade ?? null, data.logradouro ?? null,
      data.numero ?? null, data.bairro ?? null, data.cep ?? null,
      1, new Date().toISOString()
    )
    .run()

  return c.json({ id, message: 'Filial criada com sucesso.' }, 201)
})

// PUT /api/tenant/info/empresas/:id — atualizar empresa
app.put('/empresas/:id', zValidator('json', empresaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const fields: string[] = ['updated_at = ?']
  const vals: unknown[] = [now]
  const map: Record<string, string> = {
    razaoSocial: 'razao_social', nomeFantasia: 'nome_fantasia', cnpj: 'cnpj',
    inscricaoEstadual: 'inscricao_estadual', email: 'email', telefone: 'telefone',
    logradouro: 'logradouro', numero: 'numero', complemento: 'complemento',
    bairro: 'bairro', cidade: 'cidade', uf: 'uf', cep: 'cep',
  }
  for (const [k, col] of Object.entries(map)) {
    if ((data as any)[k] !== undefined) { fields.push(`${col} = ?`); vals.push((data as any)[k]) }
  }
  await c.env.DB_SHARED.prepare(`UPDATE empresas SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals, id, tenant.tenantId).run()

  return c.json({ message: 'Empresa atualizada.' })
})

// DELETE /api/tenant/info/empresas/:id
app.delete('/empresas/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('DELETE FROM empresas WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Empresa removida.' })
})

// GET /api/tenant/info/filiais — todas as filiais do tenant
app.get('/filiais', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT f.id, f.nome, f.cnpj, f.uf, f.cidade, f.logradouro, f.numero, f.bairro, f.cep, f.ativa, f.created_at,
           e.id as empresa_id, e.razao_social as empresa_nome
    FROM filiais f
    LEFT JOIN empresas e ON e.id = f.empresa_id
    WHERE f.tenant_id = ?
    ORDER BY e.razao_social, f.nome
  `).bind(tenant.tenantId).all()
  return c.json({ filiais: results })
})

// PUT /api/tenant/info/filiais/:id
app.put('/filiais/:id', zValidator('json', filialSchema.partial().extend({ ativa: z.boolean().optional() })), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const fields: string[] = ['updated_at = ?']
  const vals: unknown[] = [now]
  const cols = ['nome', 'cnpj', 'uf', 'cidade', 'logradouro', 'numero', 'bairro', 'cep']
  for (const col of cols) {
    if ((data as any)[col] !== undefined) { fields.push(`${col} = ?`); vals.push((data as any)[col]) }
  }
  if ((data as any).ativa !== undefined) { fields.push('ativa = ?'); vals.push((data as any).ativa ? 1 : 0) }

  await c.env.DB_SHARED.prepare(`UPDATE filiais SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals, id, tenant.tenantId).run()
  return c.json({ message: 'Filial atualizada.' })
})

// DELETE /api/tenant/info/filiais/:id
app.delete('/filiais/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('DELETE FROM filiais WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Filial removida.' })
})

// ─── Usuários ─────────────────────────────────────────────────────

// GET /api/tenant/info/usuarios
app.get('/usuarios', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(
    'SELECT id, email, nome, role, ativo, created_at FROM users WHERE tenant_id = ? ORDER BY nome'
  ).bind(tenant.tenantId).all()
  return c.json({ usuarios: results })
})

const userSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).default('user'),
  senha: z.string().min(6).optional(),
})

// POST /api/tenant/info/usuarios
app.post('/usuarios', zValidator('json', userSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM users WHERE email = ? AND tenant_id = ?')
    .bind(data.email, tenant.tenantId).first()
  if (exists) return c.json({ error: 'Já existe um usuário com este e-mail.' }, 400)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // Hash da senha (simples — em produção use bcrypt via Worker)
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data.senha ?? 'Mudar@123'))
  const hashArray = Array.from(new Uint8Array(buf))
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  await c.env.DB_SHARED.prepare(
    'INSERT INTO users (id, tenant_id, email, nome, password_hash, role, ativo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
  ).bind(id, tenant.tenantId, data.email, data.nome, passwordHash, data.role, now).run()

  return c.json({ id, message: 'Usuário criado.' }, 201)
})

// PUT /api/tenant/info/usuarios/:id
app.put('/usuarios/:id', zValidator('json', userSchema.partial().omit({ senha: true }).extend({ ativo: z.boolean().optional() })), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const fields = ['updated_at = ?']
  const vals: unknown[] = [now]
  if (data.nome !== undefined) { fields.push('nome = ?'); vals.push(data.nome) }
  if (data.email !== undefined) { fields.push('email = ?'); vals.push(data.email) }
  if (data.role !== undefined) { fields.push('role = ?'); vals.push(data.role) }
  if (data.ativo !== undefined) { fields.push('ativo = ?'); vals.push(data.ativo ? 1 : 0) }

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
