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

export default app
