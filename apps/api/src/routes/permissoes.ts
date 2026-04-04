import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
const app = new Hono<{ Bindings: Env }>()

const MODULE_KEY_Z = z.enum(['cadastros', 'financeiro', 'faturamento', 'estoque', 'configuracoes'])

function requireAdmin(c: { get: (k: 'user') => { role: string }; json: (b: object, s: number) => Response }) {
  const u = c.get('user')
  if (u.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem gerenciar perfis personalizados.' }, 403)
  }
  return null
}

const moduleEntrySchema = z.object({
  moduleKey: MODULE_KEY_Z,
  canView: z.boolean(),
  canEdit: z.boolean(),
})

const createPerfilSchema = z
  .object({
    nome: z.string().min(2).max(120),
    modulos: z.array(moduleEntrySchema).min(1),
  })
  .refine((d) => d.modulos.every((m) => !m.canEdit || m.canView), {
    message: 'Para permitir edição, marque também visualização.',
    path: ['modulos'],
  })

// GET /api/tenant/permissoes/perfis
app.get('/perfis', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare(
      `
      SELECT r.id, r.nome, r.created_at, r.updated_at,
             (SELECT COUNT(*) FROM users u WHERE u.custom_role_id = r.id AND u.tenant_id = r.tenant_id) as usuarios_count
      FROM tenant_custom_roles r
      WHERE r.tenant_id = ?
      ORDER BY r.nome
    `
    )
    .bind(tenant.tenantId)
    .all()

  return c.json({ perfis: results ?? [] })
})

// GET /api/tenant/permissoes/perfis/:id
app.get('/perfis/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const role = await c.env.DB_SHARED
    .prepare('SELECT id, nome, created_at, updated_at FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ id: string; nome: string; created_at: string; updated_at: string | null }>()

  if (!role) return c.json({ error: 'Perfil não encontrado.' }, 404)

  const { results } = await c.env.DB_SHARED
    .prepare(
      'SELECT module_key, can_view, can_edit FROM tenant_custom_role_modules WHERE custom_role_id = ? AND tenant_id = ?'
    )
    .bind(id, tenant.tenantId)
    .all<{ module_key: string; can_view: number; can_edit: number }>()

  const modulos = (results ?? []).map((r) => ({
    moduleKey: r.module_key,
    canView: r.can_view === 1,
    canEdit: r.can_edit === 1,
  }))

  return c.json({ perfil: role, modulos })
})

// POST /api/tenant/permissoes/perfis
app.post('/perfis', zValidator('json', createPerfilSchema), async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const stmts = [
    c.env.DB_SHARED
      .prepare('INSERT INTO tenant_custom_roles (id, tenant_id, nome, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, tenant.tenantId, data.nome.trim(), now),
  ]

  for (const m of data.modulos) {
    const mid = crypto.randomUUID()
    stmts.push(
      c.env.DB_SHARED
        .prepare(
          `INSERT INTO tenant_custom_role_modules (id, tenant_id, custom_role_id, module_key, can_view, can_edit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(mid, tenant.tenantId, id, m.moduleKey, m.canView ? 1 : 0, m.canEdit ? 1 : 0, now)
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ id, message: 'Perfil criado.' }, 201)
})

// PUT /api/tenant/permissoes/perfis/:id
app.put('/perfis/:id', zValidator('json', createPerfilSchema), async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const data = c.req.valid('json')

  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first()
  if (!exists) return c.json({ error: 'Perfil não encontrado.' }, 404)

  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare('UPDATE tenant_custom_roles SET nome = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind(data.nome.trim(), now, id, tenant.tenantId)
    .run()

  await c.env.DB_SHARED
    .prepare('DELETE FROM tenant_custom_role_modules WHERE custom_role_id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .run()

  const stmts = []
  for (const m of data.modulos) {
    const mid = crypto.randomUUID()
    stmts.push(
      c.env.DB_SHARED
        .prepare(
          `INSERT INTO tenant_custom_role_modules (id, tenant_id, custom_role_id, module_key, can_view, can_edit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(mid, tenant.tenantId, id, m.moduleKey, m.canView ? 1 : 0, m.canEdit ? 1 : 0, now)
    )
  }
  if (stmts.length) await c.env.DB_SHARED.batch(stmts)

  return c.json({ message: 'Perfil atualizado.' })
})

// DELETE /api/tenant/permissoes/perfis/:id
app.delete('/perfis/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const tenant = c.get('tenant')
  const id = c.req.param('id')

  await c.env.DB_SHARED
    .prepare('UPDATE users SET custom_role_id = NULL WHERE custom_role_id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .run()

  await c.env.DB_SHARED
    .prepare('DELETE FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .run()

  return c.json({ message: 'Perfil removido.' })
})

export default app
