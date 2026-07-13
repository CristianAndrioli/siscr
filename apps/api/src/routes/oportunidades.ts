/**
 * routes/oportunidades.ts
 *
 * Funil de vendas (Kanban) — prefixo /tenant/vendas (montado ao lado de
 * vendas.ts em index.ts, mesmo gate 'faturamento').
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

const ESTAGIOS = ['novo', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] as const

// GET /api/tenant/vendas/oportunidades
app.get('/oportunidades', async (c) => {
  const tenant = c.get('tenant')
  const { vendedorId } = c.req.query()

  let query = `
    SELECT o.*, p.nome as pessoa_nome, v.nome as vendedor_nome
    FROM oportunidades o
    LEFT JOIN pessoas p ON p.id = o.pessoa_id
    LEFT JOIN pessoas v ON v.id = o.vendedor_id
    WHERE o.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]
  if (vendedorId) { query += ' AND o.vendedor_id = ?'; params.push(vendedorId) }
  query += ' ORDER BY o.created_at DESC LIMIT 500'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ oportunidades: results ?? [] })
})

const oportunidadeSchema = z.object({
  titulo: z.string().min(2),
  pessoaId: z.string().uuid().optional(),
  vendedorId: z.string().uuid().optional(),
  valorEstimado: z.number().nonnegative().default(0),
  probabilidade: z.number().int().min(0).max(100).default(0),
  dataPrevistaFechamento: z.string().optional(),
})

// POST /api/tenant/vendas/oportunidades
app.post('/oportunidades', zValidator('json', oportunidadeSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO oportunidades
      (id, tenant_id, titulo, pessoa_id, vendedor_id, valor_estimado, estagio, probabilidade, data_prevista_fechamento, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'novo', ?, ?, ?, ?)
  `).bind(
    id, tenant.tenantId, body.titulo, body.pessoaId ?? null, body.vendedorId ?? null,
    body.valorEstimado, body.probabilidade, body.dataPrevistaFechamento ?? null, now, uid,
  ).run()

  return c.json({ id, message: 'Oportunidade criada.' }, 201)
})

// PUT /api/tenant/vendas/oportunidades/:id
app.put('/oportunidades/:id', zValidator('json', oportunidadeSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM oportunidades WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Oportunidade não encontrada.' }, 404)

  await c.env.DB_SHARED.prepare(`
    UPDATE oportunidades SET
      titulo = ?, pessoa_id = ?, vendedor_id = ?, valor_estimado = ?, probabilidade = ?, data_prevista_fechamento = ?,
      updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.titulo ?? row.titulo,
    body.pessoaId === undefined ? row.pessoa_id : body.pessoaId,
    body.vendedorId === undefined ? row.vendedor_id : body.vendedorId,
    body.valorEstimado ?? row.valor_estimado,
    body.probabilidade ?? row.probabilidade,
    body.dataPrevistaFechamento === undefined ? row.data_prevista_fechamento : body.dataPrevistaFechamento,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Oportunidade atualizada.' })
})

const estagioSchema = z.object({
  estagio: z.enum(ESTAGIOS),
  motivoPerda: z.string().optional(),
})

// PATCH /api/tenant/vendas/oportunidades/:id/estagio
app.patch('/oportunidades/:id/estagio', zValidator('json', estagioSchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT id FROM oportunidades WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Oportunidade não encontrada.' }, 404)

  if (body.estagio === 'perdido' && !body.motivoPerda) {
    return c.json({ error: 'Informe o motivo da perda.' }, 400)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE oportunidades SET estagio = ?, motivo_perda = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.estagio,
    body.estagio === 'perdido' ? (body.motivoPerda ?? null) : null,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Estágio atualizado.' })
})

// DELETE /api/tenant/vendas/oportunidades/:id
app.delete('/oportunidades/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM oportunidades WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Oportunidade não encontrada.' }, 404)
  return c.json({ message: 'Oportunidade removida.' })
})

export default app
