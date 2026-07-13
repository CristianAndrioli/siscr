/**
 * routes/cadastrosFinanceiro.ts
 *
 * Cadastros auxiliares do Financeiro — Categorias financeiras, Centros
 * de custo, Formas de pagamento e Condições de pagamento. Registros
 * independentes (ver handoff de redesign) que outras telas (contas a
 * receber/pagar, faturamento) podem referenciar depois.
 *
 * Prefixo: /tenant/cadastros (montado ao lado de cadastros.ts em
 * index.ts) — mesma permissão de módulo ('cadastros').
 *
 * Padrão: SQL direto (sem repository/service) como em routes/conexoes.ts,
 * adequado para CRUD simples de tabelas auxiliares. SQL sempre
 * parametrizado; nunca interpolar valor do client.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'

const app = new Hono<{ Bindings: Env }>()

const emptyToUndef = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema)

// ─── Categorias financeiras ────────────────────────────────────────

const categoriaFinanceiraSchema = z.object({
  codigo: z.string().min(1).max(30),
  nome: z.string().min(2).max(120),
  tipo: z.enum(['receita', 'despesa']),
  grupoDre: emptyToUndef(z.string().max(120).optional()),
  categoriaPaiId: emptyToUndef(z.string().uuid().optional()),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
})

app.get('/categorias-financeiras', async (c) => {
  const tenant = c.get('tenant')
  const { busca, tipo } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND (nome LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }
  if (tipo) { where += ' AND tipo = ?'; params.push(tipo) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM categorias_financeiras${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT * FROM categorias_financeiras${where} ORDER BY codigo LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ categorias: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/categorias-financeiras', zValidator('json', categoriaFinanceiraSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const dup = await c.env.DB_SHARED.prepare('SELECT id FROM categorias_financeiras WHERE tenant_id = ? AND codigo = ?').bind(tenant.tenantId, body.codigo).first()
  if (dup) return c.json({ error: `Já existe uma categoria com o código "${body.codigo}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO categorias_financeiras (id, tenant_id, empresa_id, codigo, nome, tipo, grupo_dre, categoria_pai_id, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.codigo, body.nome, body.tipo, body.grupoDre ?? null, body.categoriaPaiId ?? null, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  return c.json({ id, message: 'Categoria financeira cadastrada.' }, 201)
})

app.put('/categorias-financeiras/:id', zValidator('json', categoriaFinanceiraSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM categorias_financeiras WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Categoria não encontrada.' }, 404)

  if (body.codigo && body.codigo !== row.codigo) {
    const dup = await c.env.DB_SHARED.prepare('SELECT id FROM categorias_financeiras WHERE tenant_id = ? AND codigo = ? AND id != ?').bind(tenant.tenantId, body.codigo, id).first()
    if (dup) return c.json({ error: `Já existe uma categoria com o código "${body.codigo}".` }, 409)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE categorias_financeiras SET codigo = ?, nome = ?, tipo = ?, grupo_dre = ?, categoria_pai_id = ?, empresa_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.codigo ?? row.codigo, body.nome ?? row.nome, body.tipo ?? row.tipo,
    body.grupoDre !== undefined ? body.grupoDre : row.grupo_dre,
    body.categoriaPaiId !== undefined ? body.categoriaPaiId : row.categoria_pai_id,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Categoria atualizada.' })
})

app.delete('/categorias-financeiras/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM categorias_financeiras WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Categoria não encontrada.' }, 404)
  return c.json({ message: 'Categoria removida.' })
})

// ─── Centros de custo ───────────────────────────────────────────────

const centroCustoSchema = z.object({
  codigo: z.string().min(1).max(30),
  nome: z.string().min(2).max(120),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  filialId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
})

app.get('/centros-custo', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND (nome LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM centros_custo${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT * FROM centros_custo${where} ORDER BY codigo LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ centros: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/centros-custo', zValidator('json', centroCustoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const dup = await c.env.DB_SHARED.prepare('SELECT id FROM centros_custo WHERE tenant_id = ? AND codigo = ?').bind(tenant.tenantId, body.codigo).first()
  if (dup) return c.json({ error: `Já existe um centro de custo com o código "${body.codigo}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO centros_custo (id, tenant_id, empresa_id, filial_id, codigo, nome, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.filialId ?? null, body.codigo, body.nome, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  return c.json({ id, message: 'Centro de custo cadastrado.' }, 201)
})

app.put('/centros-custo/:id', zValidator('json', centroCustoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM centros_custo WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Centro de custo não encontrado.' }, 404)

  if (body.codigo && body.codigo !== row.codigo) {
    const dup = await c.env.DB_SHARED.prepare('SELECT id FROM centros_custo WHERE tenant_id = ? AND codigo = ? AND id != ?').bind(tenant.tenantId, body.codigo, id).first()
    if (dup) return c.json({ error: `Já existe um centro de custo com o código "${body.codigo}".` }, 409)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE centros_custo SET codigo = ?, nome = ?, empresa_id = ?, filial_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.codigo ?? row.codigo, body.nome ?? row.nome,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.filialId !== undefined ? body.filialId : row.filial_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Centro de custo atualizado.' })
})

app.delete('/centros-custo/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM centros_custo WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Centro de custo não encontrado.' }, 404)
  return c.json({ message: 'Centro de custo removido.' })
})

// ─── Condições de pagamento (+ parcelas) ───────────────────────────

const parcelaSchema = z.object({
  numeroParcela: z.coerce.number().int().min(1),
  diasPrazo: z.coerce.number().int().min(0),
  percentual: z.coerce.number().min(0).max(100),
})

const condicaoPagamentoSchema = z.object({
  codigo: z.string().min(1).max(30),
  descricao: z.string().min(2).max(120),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
  parcelas: z.array(parcelaSchema).min(1).default([{ numeroParcela: 1, diasPrazo: 0, percentual: 100 }]),
})

app.get('/condicoes-pagamento', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND (descricao LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM condicoes_pagamento${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM condicao_pagamento_parcelas p WHERE p.condicao_pagamento_id = c.id) as num_parcelas
     FROM condicoes_pagamento c${where} ORDER BY codigo LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ condicoes: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/condicoes-pagamento/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const row = await c.env.DB_SHARED.prepare('SELECT * FROM condicoes_pagamento WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Condição de pagamento não encontrada.' }, 404)
  const { results: parcelas } = await c.env.DB_SHARED.prepare(
    'SELECT * FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id = ? ORDER BY numero_parcela',
  ).bind(id).all()
  return c.json({ ...row, parcelas })
})

async function salvarParcelas(env: Env, tenantId: string, condicaoId: string, parcelas: z.infer<typeof parcelaSchema>[]) {
  await env.DB_SHARED.prepare('DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id = ? AND tenant_id = ?').bind(condicaoId, tenantId).run()
  const now = new Date().toISOString()
  for (const p of parcelas) {
    await env.DB_SHARED.prepare(`
      INSERT INTO condicao_pagamento_parcelas (id, tenant_id, condicao_pagamento_id, numero_parcela, dias_prazo, percentual, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), tenantId, condicaoId, p.numeroParcela, p.diasPrazo, p.percentual, now).run()
  }
}

app.post('/condicoes-pagamento', zValidator('json', condicaoPagamentoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const dup = await c.env.DB_SHARED.prepare('SELECT id FROM condicoes_pagamento WHERE tenant_id = ? AND codigo = ?').bind(tenant.tenantId, body.codigo).first()
  if (dup) return c.json({ error: `Já existe uma condição de pagamento com o código "${body.codigo}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO condicoes_pagamento (id, tenant_id, empresa_id, codigo, descricao, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.codigo, body.descricao, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  await salvarParcelas(c.env, tenant.tenantId, id, body.parcelas)

  return c.json({ id, message: 'Condição de pagamento cadastrada.' }, 201)
})

app.put('/condicoes-pagamento/:id', zValidator('json', condicaoPagamentoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM condicoes_pagamento WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Condição de pagamento não encontrada.' }, 404)

  if (body.codigo && body.codigo !== row.codigo) {
    const dup = await c.env.DB_SHARED.prepare('SELECT id FROM condicoes_pagamento WHERE tenant_id = ? AND codigo = ? AND id != ?').bind(tenant.tenantId, body.codigo, id).first()
    if (dup) return c.json({ error: `Já existe uma condição de pagamento com o código "${body.codigo}".` }, 409)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE condicoes_pagamento SET codigo = ?, descricao = ?, empresa_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.codigo ?? row.codigo, body.descricao ?? row.descricao,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  if (body.parcelas) await salvarParcelas(c.env, tenant.tenantId, id, body.parcelas)

  return c.json({ message: 'Condição de pagamento atualizada.' })
})

app.delete('/condicoes-pagamento/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  await c.env.DB_SHARED.prepare('DELETE FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id = ? AND tenant_id = ?').bind(id, tenant.tenantId).run()
  const r = await c.env.DB_SHARED.prepare('DELETE FROM condicoes_pagamento WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Condição de pagamento não encontrada.' }, 404)
  return c.json({ message: 'Condição de pagamento removida.' })
})

export default app
