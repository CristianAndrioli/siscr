/**
 * routes/estoqueInventario.ts
 *
 * Inventário (contagem física de estoque) — prefixo /tenant/estoque
 * (montado ao lado de estoque.ts em index.ts, mesmo gate 'estoque').
 *
 * Fluxo: abrir gera snapshot da posição atual (`estoque`); usuário
 * preenche a quantidade contada por item; "aplicar" grava a diferença
 * como movimentação tipo 'ajuste' em `movimentacoes_estoque` e atualiza
 * `estoque.quantidade` diretamente — não reaproveita POST
 * /movimentacoes porque esse endpoint só soma (não subtrai) quando
 * tipo='ajuste'; aqui a diferença pode ser positiva ou negativa.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'

const app = new Hono<{ Bindings: Env }>()

app.get('/inventarios', async (c) => {
  const tenant = c.get('tenant')
  const { status } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE i.tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (status) { where += ' AND i.status = ?'; params.push(status) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM inventarios i${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT i.*, (SELECT COUNT(*) FROM inventario_itens ii WHERE ii.inventario_id = i.id) as num_itens
    FROM inventarios i${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json({ inventarios: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/inventarios/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const inventario = await c.env.DB_SHARED.prepare('SELECT * FROM inventarios WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first()
  if (!inventario) return c.json({ error: 'Inventário não encontrado.' }, 404)

  const { results: itens } = await c.env.DB_SHARED.prepare(`
    SELECT ii.*, p.descricao as produto_descricao, p.codigo as produto_codigo
    FROM inventario_itens ii JOIN produtos p ON p.id = ii.produto_id
    WHERE ii.inventario_id = ? ORDER BY p.descricao
  `).bind(id).all()

  return c.json({ ...inventario, itens: itens ?? [] })
})

const abrirSchema = z.object({
  descricao: z.string().min(2),
  location: z.string().optional(),
  empresaId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
})

app.post('/inventarios', zValidator('json', abrirSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  let where = 'WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (body.location) { where += ' AND location = ?'; params.push(body.location) }

  const { results: posicao } = await c.env.DB_SHARED
    .prepare(`SELECT produto_id, location, quantidade FROM estoque ${where}`)
    .bind(...params)
    .all<{ produto_id: string; location: string; quantidade: number }>()

  const itens = posicao ?? []
  if (itens.length === 0) {
    return c.json({ error: 'Nenhum produto com posição de estoque para o local informado.' }, 400)
  }

  const stmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO inventarios (id, tenant_id, empresa_id, filial_id, descricao, location, status, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'aberto', ?, ?)
    `).bind(id, tenant.tenantId, body.empresaId ?? null, body.filialId ?? null, body.descricao, body.location ?? null, now, uid),
    ...itens.map((it) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO inventario_itens (id, tenant_id, inventario_id, produto_id, location, quantidade_sistema, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tenant.tenantId, id, it.produto_id, it.location, it.quantidade, now),
    ),
  ]

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ id, message: `Inventário aberto com ${itens.length} item(ns).` }, 201)
})

app.put('/inventarios/:id/itens/:itemId', zValidator('json', z.object({ quantidadeContada: z.number().min(0) })), async (c) => {
  const tenant = c.get('tenant')
  const { id, itemId } = c.req.param()
  const { quantidadeContada } = c.req.valid('json')

  const inventario = await c.env.DB_SHARED.prepare('SELECT status FROM inventarios WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first<{ status: string }>()
  if (!inventario) return c.json({ error: 'Inventário não encontrado.' }, 404)
  if (inventario.status !== 'aberto') return c.json({ error: 'Só é possível editar a contagem de um inventário em aberto.' }, 400)

  await c.env.DB_SHARED
    .prepare('UPDATE inventario_itens SET quantidade_contada = ?, updated_at = ? WHERE id = ? AND inventario_id = ? AND tenant_id = ?')
    .bind(quantidadeContada, new Date().toISOString(), itemId, id, tenant.tenantId)
    .run()

  return c.json({ message: 'Contagem registrada.' })
})

app.post('/inventarios/:id/aplicar', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const id = c.req.param('id')
  const uid = auditUserId(c)
  const now = new Date().toISOString()

  const inventario = await c.env.DB_SHARED.prepare('SELECT status FROM inventarios WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first<{ status: string }>()
  if (!inventario) return c.json({ error: 'Inventário não encontrado.' }, 404)
  if (inventario.status !== 'aberto') return c.json({ error: 'Este inventário já foi aplicado ou cancelado.' }, 400)

  const { results: itens } = await c.env.DB_SHARED
    .prepare('SELECT * FROM inventario_itens WHERE inventario_id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .all<{ id: string; produto_id: string; location: string; quantidade_sistema: number; quantidade_contada: number | null }>()

  const stmts = []
  let ajustes = 0
  for (const it of itens ?? []) {
    if (it.quantidade_contada === null) continue
    const delta = it.quantidade_contada - it.quantidade_sistema
    if (delta === 0) continue
    ajustes++

    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, tipo, quantidade, location, motivo, referencia_id, usuario_id, created_at, created_by, updated_by, updated_at)
        VALUES (?, ?, ?, 'ajuste', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), tenant.tenantId, it.produto_id, Math.abs(delta), it.location,
        `Inventário — contagem física (${delta > 0 ? '+' : ''}${delta})`, id, user?.userId ?? null,
        now, uid, uid, now,
      ),
      c.env.DB_SHARED.prepare(`
        INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
          quantidade = quantidade + ?, updated_at = ?, updated_by = ?
      `).bind(crypto.randomUUID(), tenant.tenantId, it.produto_id, it.location, it.quantidade_contada, now, now, uid, uid, delta, now, uid),
    )
  }

  stmts.push(
    c.env.DB_SHARED.prepare(`UPDATE inventarios SET status = 'aplicado', data_contagem = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
      .bind(now, now, uid, id, tenant.tenantId),
  )

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: `Inventário aplicado. ${ajustes} ajuste(s) de estoque gerado(s).` })
})

app.post('/inventarios/:id/cancelar', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const r = await c.env.DB_SHARED
    .prepare(`UPDATE inventarios SET status = 'cancelado', updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ? AND status = 'aberto'`)
    .bind(new Date().toISOString(), auditUserId(c), id, tenant.tenantId)
    .run()
  if (!r.meta.changes) return c.json({ error: 'Inventário não encontrado ou já finalizado.' }, 404)
  return c.json({ message: 'Inventário cancelado.' })
})

export default app
