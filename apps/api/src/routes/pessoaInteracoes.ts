/**
 * routes/pessoaInteracoes.ts
 *
 * Histórico de interações (CRM) — contatos registrados com clientes,
 * fornecedores etc. Prefixo: /tenant/vendas/interacoes (montado ao
 * lado de vendas.ts em index.ts, mesmo gate 'faturamento').
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'

const app = new Hono<{ Bindings: Env }>()

app.get('/interacoes', async (c) => {
  const tenant = c.get('tenant')
  const { pessoaId, tipo } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE i.tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (pessoaId) { where += ' AND i.pessoa_id = ?'; params.push(pessoaId) }
  if (tipo) { where += ' AND i.tipo = ?'; params.push(tipo) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM pessoa_interacoes i${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT i.*, p.nome as pessoa_nome
    FROM pessoa_interacoes i JOIN pessoas p ON p.id = i.pessoa_id
    ${where} ORDER BY i.data DESC, i.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json({ interacoes: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

const interacaoSchema = z.object({
  pessoaId: z.string().uuid(),
  tipo: z.enum(['ligacao', 'email', 'reuniao', 'visita', 'outro']).default('outro'),
  data: z.string().min(1),
  descricao: z.string().min(2),
})

app.post('/interacoes', zValidator('json', interacaoSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const body = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB_SHARED.prepare(`
    INSERT INTO pessoa_interacoes (id, tenant_id, pessoa_id, tipo, data, descricao, usuario_id, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.pessoaId, body.tipo, body.data, body.descricao, user.userId ?? null, now, auditUserId(c)).run()

  return c.json({ id, message: 'Interação registrada.' }, 201)
})

app.put('/interacoes/:id', zValidator('json', interacaoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM pessoa_interacoes WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Interação não encontrada.' }, 404)

  await c.env.DB_SHARED.prepare(`
    UPDATE pessoa_interacoes SET pessoa_id = ?, tipo = ?, data = ?, descricao = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.pessoaId ?? row.pessoa_id, body.tipo ?? row.tipo, body.data ?? row.data, body.descricao ?? row.descricao,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Interação atualizada.' })
})

app.delete('/interacoes/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM pessoa_interacoes WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Interação não encontrada.' }, 404)
  return c.json({ message: 'Interação removida.' })
})

export default app
