import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().min(1),
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nome: z.string().min(2),
  tenantNome: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  planId: z.string().optional(),
})

// POST /api/auth/login
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, tenantSlug } = c.req.valid('json')

  // Verificar tenant
  const tenant = await c.env.DB_SHARED
    .prepare('SELECT id, slug, db_id FROM tenants WHERE slug = ? AND status = ?')
    .bind(tenantSlug, 'active')
    .first<{ id: string; slug: string; db_id: string }>()

  if (!tenant) {
    return c.json({ error: 'Tenant não encontrado.' }, 404)
  }

  // Verificar usuário no banco compartilhado
  const user = await c.env.DB_SHARED
    .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ? AND tenant_id = ?')
    .bind(email, tenant.id)
    .first<{ id: string; email: string; password_hash: string; role: string }>()

  if (!user) {
    return c.json({ error: 'Email ou senha incorretos.' }, 401)
  }

  // Verificar senha com Web Crypto API (PBKDF2)
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    return c.json({ error: 'Email ou senha incorretos.' }, 401)
  }

  // Gerar token de sessão
  const sessionToken = crypto.randomUUID()
  const SESSION_TTL = 60 * 60 * 24 * 7 // 7 dias

  const sessionData = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    empresaId: null,
    filialId: null,
  }

  await c.env.KV_SESSIONS.put(
    `session:${sessionToken}`,
    JSON.stringify(sessionData),
    { expirationTtl: SESSION_TTL }
  )

  return c.json({
    token: sessionToken,
    user: { id: user.id, email: user.email, role: user.role },
    tenant: { id: tenant.id, slug: tenant.slug },
  })
})

// POST /api/auth/signup — cria tenant + usuário admin
app.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, nome, tenantNome, tenantSlug, planId } = c.req.valid('json')

  // Verificar se slug já existe
  const existing = await c.env.DB_SHARED
    .prepare('SELECT id FROM tenants WHERE slug = ?')
    .bind(tenantSlug)
    .first()

  if (existing) {
    return c.json({ error: `O identificador "${tenantSlug}" já está em uso.` }, 409)
  }

  const tenantId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  // Criar tenant e usuário admin atomicamente
  await c.env.DB_SHARED.batch([
    c.env.DB_SHARED.prepare(
      'INSERT INTO tenants (id, slug, nome, plan_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tenantId, tenantSlug, tenantNome, planId ?? 'free', 'active', new Date().toISOString()),

    c.env.DB_SHARED.prepare(
      'INSERT INTO users (id, tenant_id, email, password_hash, nome, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, tenantId, email, passwordHash, nome, 'admin', new Date().toISOString()),
  ])

  return c.json({ message: 'Conta criada com sucesso!', tenantSlug }, 201)
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

// ─── Utilitários de senha (Web Crypto API — nativo no Workers) ─
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const testHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return testHex === hashHex
}

export default app
