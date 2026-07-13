/**
 * routes/frotaExtras.ts
 *
 * Abastecimentos e Manutenções programadas do módulo Frota (redesign).
 * Entidades novas que não cabiam em routes/frota.ts (694 linhas — não
 * editar). Montado no MESMO prefixo /api/tenant/frota, com o mesmo
 * gate requireTenantModule('frota') já aplicado em index.ts.
 *
 * Padrão: SQL direto (sem repository/service), igual cadastrosFinanceiro.ts.
 * SQL sempre parametrizado; nunca interpolar valor do client.
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

// ─── Abastecimentos ─────────────────────────────────────────────────

const abastecimentoSchema = z.object({
  maquinaId: z.string().uuid(),
  obraId: emptyToUndef(z.string().uuid().optional()),
  data: z.string().min(1).max(10),
  litros: z.coerce.number().positive(),
  valorTotal: z.coerce.number().positive(),
  horimetro: emptyToUndef(z.coerce.number().optional()),
  posto: emptyToUndef(z.string().max(120).optional()),
  observacoes: emptyToUndef(z.string().max(2000).optional()),
  empresaId: emptyToUndef(z.string().uuid().optional()),
})

app.get('/abastecimentos', async (c) => {
  const tenant = c.get('tenant')
  const { maquinaId } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE a.tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (maquinaId) { where += ' AND a.maquina_id = ?'; params.push(maquinaId) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM abastecimentos_frota a${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT a.*, m.nome as maquina_nome
    FROM abastecimentos_frota a
    JOIN maquinas m ON m.id = a.maquina_id
    ${where}
    ORDER BY a.data DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json({ abastecimentos: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/abastecimentos', zValidator('json', abastecimentoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')

  const maquina = await c.env.DB_SHARED.prepare('SELECT id, horimetro_atual FROM maquinas WHERE id = ? AND tenant_id = ?').bind(body.maquinaId, tenant.tenantId).first<{ id: string; horimetro_atual: number | null }>()
  if (!maquina) return c.json({ error: 'Máquina não encontrada.' }, 404)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const stmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO abastecimentos_frota (id, tenant_id, empresa_id, maquina_id, obra_id, data, litros, valor_total, horimetro, posto, observacoes, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, tenant.tenantId, body.empresaId ?? null, body.maquinaId, body.obraId ?? null, body.data, body.litros, body.valorTotal, body.horimetro ?? null, body.posto ?? null, body.observacoes ?? null, now, uid),
  ]

  if (body.horimetro != null && body.horimetro > Number(maquina.horimetro_atual ?? 0)) {
    stmts.push(
      c.env.DB_SHARED.prepare('UPDATE maquinas SET horimetro_atual = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
        .bind(body.horimetro, now, uid, body.maquinaId, tenant.tenantId),
    )
  }

  await c.env.DB_SHARED.batch(stmts)

  return c.json({ id, message: 'Abastecimento registrado.' }, 201)
})

app.put('/abastecimentos/:id', zValidator('json', abastecimentoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM abastecimentos_frota WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first<Record<string, unknown>>()
  if (!row) return c.json({ error: 'Abastecimento não encontrado.' }, 404)

  if (body.maquinaId && body.maquinaId !== row.maquina_id) {
    const maquina = await c.env.DB_SHARED.prepare('SELECT id FROM maquinas WHERE id = ? AND tenant_id = ?').bind(body.maquinaId, tenant.tenantId).first()
    if (!maquina) return c.json({ error: 'Máquina não encontrada.' }, 404)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE abastecimentos_frota SET maquina_id = ?, obra_id = ?, data = ?, litros = ?, valor_total = ?, horimetro = ?, posto = ?, observacoes = ?, empresa_id = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.maquinaId ?? row.maquina_id,
    body.obraId !== undefined ? body.obraId : row.obra_id,
    body.data ?? row.data,
    body.litros ?? row.litros,
    body.valorTotal ?? row.valor_total,
    body.horimetro !== undefined ? body.horimetro : row.horimetro,
    body.posto !== undefined ? body.posto : row.posto,
    body.observacoes !== undefined ? body.observacoes : row.observacoes,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Abastecimento atualizado.' })
})

app.delete('/abastecimentos/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM abastecimentos_frota WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Abastecimento não encontrado.' }, 404)
  return c.json({ message: 'Abastecimento removido.' })
})

// ─── Manutenções programadas ────────────────────────────────────────

const manutencaoSchema = z.object({
  maquinaId: z.string().uuid(),
  tipo: z.enum(['preventiva', 'corretiva']).default('preventiva'),
  descricao: z.string().min(2).max(2000),
  dataPrevista: emptyToUndef(z.string().max(10).optional()),
  dataRealizada: emptyToUndef(z.string().max(10).optional()),
  horimetroPrevisto: emptyToUndef(z.coerce.number().optional()),
  status: z.enum(['pendente', 'concluida', 'cancelada']).default('pendente'),
  custo: emptyToUndef(z.coerce.number().optional()),
  observacoes: emptyToUndef(z.string().max(2000).optional()),
  empresaId: emptyToUndef(z.string().uuid().optional()),
})

app.get('/manutencoes', async (c) => {
  const tenant = c.get('tenant')
  const { maquinaId, status } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = ' WHERE m.tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]
  if (maquinaId) { where += ' AND m.maquina_id = ?'; params.push(maquinaId) }
  if (status) { where += ' AND m.status = ?'; params.push(status) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM manutencoes_frota m${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT m.*, mq.nome as maquina_nome
    FROM manutencoes_frota m
    JOIN maquinas mq ON mq.id = m.maquina_id
    ${where}
    ORDER BY m.data_prevista IS NULL, m.data_prevista ASC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json({ manutencoes: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.post('/manutencoes', zValidator('json', manutencaoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')

  const maquina = await c.env.DB_SHARED.prepare('SELECT id FROM maquinas WHERE id = ? AND tenant_id = ?').bind(body.maquinaId, tenant.tenantId).first()
  if (!maquina) return c.json({ error: 'Máquina não encontrada.' }, 404)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const dataRealizada = body.status === 'concluida' ? (body.dataRealizada ?? now.slice(0, 10)) : (body.dataRealizada ?? null)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO manutencoes_frota (id, tenant_id, empresa_id, maquina_id, tipo, descricao, data_prevista, data_realizada, horimetro_previsto, status, custo, observacoes, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.maquinaId, body.tipo, body.descricao, body.dataPrevista ?? null, dataRealizada, body.horimetroPrevisto ?? null, body.status, body.custo ?? null, body.observacoes ?? null, now, auditUserId(c)).run()

  return c.json({ id, message: 'Manutenção cadastrada.' }, 201)
})

app.put('/manutencoes/:id', zValidator('json', manutencaoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED.prepare('SELECT * FROM manutencoes_frota WHERE id = ? AND tenant_id = ?').bind(id, tenant.tenantId).first<Record<string, unknown>>()
  if (!row) return c.json({ error: 'Manutenção não encontrada.' }, 404)

  if (body.maquinaId && body.maquinaId !== row.maquina_id) {
    const maquina = await c.env.DB_SHARED.prepare('SELECT id FROM maquinas WHERE id = ? AND tenant_id = ?').bind(body.maquinaId, tenant.tenantId).first()
    if (!maquina) return c.json({ error: 'Máquina não encontrada.' }, 404)
  }

  // Se o status está mudando para concluída e nenhuma data_realizada foi enviada, preenche com hoje.
  let dataRealizada = body.dataRealizada !== undefined ? body.dataRealizada : row.data_realizada
  const novoStatus = body.status ?? row.status
  if (body.status === 'concluida' && body.dataRealizada === undefined && !row.data_realizada) {
    dataRealizada = new Date().toISOString().slice(0, 10)
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE manutencoes_frota SET maquina_id = ?, tipo = ?, descricao = ?, data_prevista = ?, data_realizada = ?, horimetro_previsto = ?, status = ?, custo = ?, observacoes = ?, empresa_id = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    body.maquinaId ?? row.maquina_id,
    body.tipo ?? row.tipo,
    body.descricao ?? row.descricao,
    body.dataPrevista !== undefined ? body.dataPrevista : row.data_prevista,
    dataRealizada,
    body.horimetroPrevisto !== undefined ? body.horimetroPrevisto : row.horimetro_previsto,
    novoStatus,
    body.custo !== undefined ? body.custo : row.custo,
    body.observacoes !== undefined ? body.observacoes : row.observacoes,
    body.empresaId !== undefined ? body.empresaId : row.empresa_id,
    new Date().toISOString(), auditUserId(c), id, tenant.tenantId,
  ).run()

  return c.json({ message: 'Manutenção atualizada.' })
})

app.delete('/manutencoes/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED.prepare('DELETE FROM manutencoes_frota WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  if (!r.meta.changes) return c.json({ error: 'Manutenção não encontrada.' }, 404)
  return c.json({ message: 'Manutenção removida.' })
})

export default app
