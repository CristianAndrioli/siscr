/**
 * routes/cadastrosProdutosAux.ts
 *
 * Cadastros auxiliares de Produtos & Serviços — Grupos de produtos,
 * Unidades de medida e Tabelas de preço. Registros independentes (ver
 * handoff de redesign); produtos.grupo/unidade continuam texto livre.
 *
 * Prefixo: /tenant/cadastros (montado ao lado de cadastros.ts em
 * index.ts) — mesma permissão de módulo ('cadastros').
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

// ─── Grupos de produtos ─────────────────────────────────────────────

const grupoProdutoSchema = z.object({
  codigo: z.string().min(1).max(30),
  descricao: z.string().min(2).max(120),
  grupoPaiId: emptyToUndef(z.string().uuid().optional()),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
})

app.get('/grupos-produtos', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND (descricao LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM grupos_produtos${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT * FROM grupos_produtos${where} ORDER BY codigo LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ grupos: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/grupos-produtos', zValidator('json', grupoProdutoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const dup = await c.env.DB_SHARED.prepare('SELECT id FROM grupos_produtos WHERE tenant_id = ? AND codigo = ?').bind(tenant.tenantId, body.codigo).first()
  if (dup) return c.json({ error: `Já existe um grupo com o código "${body.codigo}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO grupos_produtos (id, tenant_id, empresa_id, codigo, descricao, grupo_pai_id, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.codigo, body.descricao, body.grupoPaiId ?? null, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  return c.json({ id, message: 'Grupo de produtos cadastrado.' }, 201)
})

app.put('/grupos-produtos/:id', zValidator('json', grupoProdutoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM grupos_produtos WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Grupo não encontrado.' }, 404)

  if (body.codigo && body.codigo !== row.codigo) {
    const dup = await c.env.DB_SHARED.prepare('SELECT id FROM grupos_produtos WHERE tenant_id = ? AND codigo = ? AND id != ?').bind(tenant.tenantId, body.codigo, id).first()
    if (dup) return c.json({ error: `Já existe um grupo com o código "${body.codigo}".` }, 409)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE grupos_produtos SET codigo = ?, descricao = ?, grupo_pai_id = ?, empresa_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.codigo ?? row.codigo, body.descricao ?? row.descricao,
    body.grupoPaiId !== undefined ? body.grupoPaiId : row.grupo_pai_id,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Grupo atualizado.' })
})

app.delete('/grupos-produtos/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM grupos_produtos WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Grupo não encontrado.' }, 404)
  return c.json({ message: 'Grupo removido.' })
})

// ─── Unidades de medida ─────────────────────────────────────────────

const unidadeMedidaSchema = z.object({
  sigla: z.string().min(1).max(6),
  descricao: z.string().min(2).max(80),
  fatorConversao: z.coerce.number().positive().default(1),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
})

app.get('/unidades-medida', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND (descricao LIKE ? OR sigla LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM unidades_medida${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT * FROM unidades_medida${where} ORDER BY sigla LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ unidades: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/unidades-medida', zValidator('json', unidadeMedidaSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const dup = await c.env.DB_SHARED.prepare('SELECT id FROM unidades_medida WHERE tenant_id = ? AND sigla = ?').bind(tenant.tenantId, body.sigla).first()
  if (dup) return c.json({ error: `Já existe uma unidade com a sigla "${body.sigla}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO unidades_medida (id, tenant_id, empresa_id, sigla, descricao, fator_conversao, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.sigla, body.descricao, body.fatorConversao, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  return c.json({ id, message: 'Unidade de medida cadastrada.' }, 201)
})

app.put('/unidades-medida/:id', zValidator('json', unidadeMedidaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM unidades_medida WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Unidade não encontrada.' }, 404)

  if (body.sigla && body.sigla !== row.sigla) {
    const dup = await c.env.DB_SHARED.prepare('SELECT id FROM unidades_medida WHERE tenant_id = ? AND sigla = ? AND id != ?').bind(tenant.tenantId, body.sigla, id).first()
    if (dup) return c.json({ error: `Já existe uma unidade com a sigla "${body.sigla}".` }, 409)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE unidades_medida SET sigla = ?, descricao = ?, fator_conversao = ?, empresa_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.sigla ?? row.sigla, body.descricao ?? row.descricao, body.fatorConversao ?? row.fator_conversao,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Unidade atualizada.' })
})

app.delete('/unidades-medida/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM unidades_medida WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Unidade não encontrada.' }, 404)
  return c.json({ message: 'Unidade removida.' })
})

// ─── Tabelas de preço (+ itens) ─────────────────────────────────────

const tabelaPrecoSchema = z.object({
  nome: z.string().min(2).max(120),
  tipoAjuste: z.enum(['percentual', 'fixo']).default('percentual'),
  valorAjuste: z.coerce.number().default(0),
  vigenciaInicio: emptyToUndef(z.string().optional()),
  vigenciaFim: emptyToUndef(z.string().optional()),
  empresaId: emptyToUndef(z.string().uuid().optional()),
  ativo: z.boolean().default(true),
})

const itemPrecoSchema = z.object({
  produtoId: z.string().uuid(),
  preco: z.coerce.number().min(0),
})

app.get('/tabelas-preco', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (busca) { where += ' AND nome LIKE ?'; params.push(`%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM tabelas_preco${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM tabela_preco_itens i WHERE i.tabela_preco_id = t.id) as num_itens
     FROM tabelas_preco t${where} ORDER BY nome LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all()

  return c.json({ tabelas: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/tabelas-preco/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const row = await c.env.DB_SHARED.prepare('SELECT * FROM tabelas_preco WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Tabela de preço não encontrada.' }, 404)
  const { results: itens } = await c.env.DB_SHARED.prepare(`
    SELECT i.*, p.descricao as produto_descricao, p.codigo as produto_codigo
    FROM tabela_preco_itens i JOIN produtos p ON p.id = i.produto_id
    WHERE i.tabela_preco_id = ? ORDER BY p.descricao
  `).bind(id).all()
  return c.json({ ...row, itens })
})

app.post('/tabelas-preco', zValidator('json', tabelaPrecoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED.prepare(`
    INSERT INTO tabelas_preco (id, tenant_id, empresa_id, nome, tipo_ajuste, valor_ajuste, vigencia_inicio, vigencia_fim, ativo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.nome, body.tipoAjuste, body.valorAjuste, body.vigenciaInicio ?? null, body.vigenciaFim ?? null, body.ativo ? 1 : 0, now, auditUserId(c)).run()

  return c.json({ id, message: 'Tabela de preço cadastrada.' }, 201)
})

app.put('/tabelas-preco/:id', zValidator('json', tabelaPrecoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM tabelas_preco WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!row) return c.json({ error: 'Tabela de preço não encontrada.' }, 404)

  await c.env.DB_SHARED.prepare(`
    UPDATE tabelas_preco SET nome = ?, tipo_ajuste = ?, valor_ajuste = ?, vigencia_inicio = ?, vigencia_fim = ?, empresa_id = ?, ativo = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.nome ?? row.nome, body.tipoAjuste ?? row.tipo_ajuste, body.valorAjuste ?? row.valor_ajuste,
    body.vigenciaInicio !== undefined ? body.vigenciaInicio : row.vigencia_inicio,
    body.vigenciaFim !== undefined ? body.vigenciaFim : row.vigencia_fim,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Tabela de preço atualizada.' })
})

app.delete('/tabelas-preco/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  await c.env.DB_SHARED.prepare('DELETE FROM tabela_preco_itens WHERE tabela_preco_id = ? AND tenant_id = ?').bind(id, tenant.tenantId).run()
  const r = await c.env.DB_SHARED.prepare('DELETE FROM tabelas_preco WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Tabela de preço não encontrada.' }, 404)
  return c.json({ message: 'Tabela de preço removida.' })
})

// Upsert de um item (produto + preço) na tabela
app.put('/tabelas-preco/:id/itens', zValidator('json', itemPrecoSchema), async (c) => {
  const tenant = c.get('tenant')
  const tabelaId = c.req.param('id')
  const body = c.req.valid('json')

  const tabela = await c.env.DB_SHARED.prepare('SELECT id FROM tabelas_preco WHERE id = ? AND tenant_id = ?').bind(tabelaId, tenant.tenantId).first()
  if (!tabela) return c.json({ error: 'Tabela de preço não encontrada.' }, 404)

  const existing = await c.env.DB_SHARED.prepare(
    'SELECT id FROM tabela_preco_itens WHERE tabela_preco_id = ? AND produto_id = ? AND tenant_id = ?',
  ).bind(tabelaId, body.produtoId, tenant.tenantId).first<{ id: string }>()

  const now = new Date().toISOString()
  if (existing) {
    await c.env.DB_SHARED.prepare('UPDATE tabela_preco_itens SET preco = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .bind(body.preco, now, auditUserId(c), existing.id).run()
  } else {
    await c.env.DB_SHARED.prepare(`
      INSERT INTO tabela_preco_itens (id, tenant_id, tabela_preco_id, produto_id, preco, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), tenant.tenantId, tabelaId, body.produtoId, body.preco, now, auditUserId(c)).run()
  }

  return c.json({ message: 'Item da tabela salvo.' })
})

app.delete('/tabelas-preco/:id/itens/:produtoId', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare(
    'DELETE FROM tabela_preco_itens WHERE tabela_preco_id = ? AND produto_id = ? AND tenant_id = ?',
  ).bind(c.req.param('id'), c.req.param('produtoId'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Item não encontrado.' }, 404)
  return c.json({ message: 'Item removido.' })
})

export default app
