/**
 * routes/contabilidade.ts
 *
 * Módulo de escrituração contábil.
 * Prefixo: /tenant/contabilidade
 *
 * Funcionalidades:
 *   - Plano de contas (CRUD + seed padrão Simples Nacional)
 *   - Centros de custo (CRUD)
 *   - Lançamentos contábeis (CRUD + estorno)
 *   - Relatórios: Razão, Balancete, DRE, Livro Caixa
 *   - Exportação CSV
 *   - Exportação ECD (SPED Contábil .txt)
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { tenantMiddleware } from '../middleware/tenant'
import { authMiddleware } from '../middleware/auth'
import { PLANO_PADRAO, codigoPai } from '../lib/contabilidade/planoPadrao'
import { gerarEcd } from '../lib/sped/ecd/index'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function auditUserId(c: any): string | null {
  try { return c.get('user')?.id ?? null } catch { return null }
}

type HonoCtx = { Bindings: Env; Variables: { tenant: { tenantId: string }; user?: { id: string } } }

const app = new Hono<HonoCtx>()
app.use('*', authMiddleware)
app.use('*', tenantMiddleware)

// ─── Plano de Contas ─────────────────────────────────────────────────────────

const contaSchema = z.object({
  empresaId:        z.string().optional().nullable(),
  codigo:           z.string().min(1),
  descricao:        z.string().min(1),
  tipo:             z.enum(['ativo', 'passivo', 'pl', 'receita', 'despesa', 'custo']),
  natureza:         z.enum(['devedora', 'credora']),
  nivel:            z.number().int().min(1).max(6),
  contaPaiId:       z.string().optional().nullable(),
  aceitaLancamento: z.boolean().default(false),
  ativo:            z.boolean().default(true),
})

app.get('/plano-contas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId } = c.req.query()

  const { results } = await c.env.DB_SHARED
    .prepare(`
      SELECT pc.*, pp.descricao as conta_pai_descricao
      FROM plano_contas pc
      LEFT JOIN plano_contas pp ON pp.id = pc.conta_pai_id
      WHERE pc.tenant_id = ?
        ${empresaId ? 'AND (pc.empresa_id = ? OR pc.empresa_id IS NULL)' : ''}
        AND pc.ativo = 1
      ORDER BY pc.codigo
    `)
    .bind(...(empresaId ? [tenant.tenantId, empresaId] : [tenant.tenantId]))
    .all()
  return c.json({ contas: results })
})

app.post('/plano-contas', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const d = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // Resolve conta pai pelo código se não veio ID
  let contaPaiId = d.contaPaiId ?? null
  if (!contaPaiId && d.codigo.includes('.')) {
    const paiCodigo = codigoPai(d.codigo)
    if (paiCodigo) {
      const pai = await c.env.DB_SHARED
        .prepare('SELECT id FROM plano_contas WHERE tenant_id = ? AND codigo = ? LIMIT 1')
        .bind(tenant.tenantId, paiCodigo)
        .first<{ id: string }>()
      contaPaiId = pai?.id ?? null
    }
  }

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO plano_contas
        (id, tenant_id, empresa_id, codigo, descricao, tipo, natureza, nivel,
         conta_pai_id, aceita_lancamento, ativo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(id, tenant.tenantId, d.empresaId ?? null, d.codigo, d.descricao,
      d.tipo, d.natureza, d.nivel, contaPaiId,
      d.aceitaLancamento ? 1 : 0, d.ativo ? 1 : 0, now)
    .run()

  return c.json({ id }, 201)
})

app.put('/plano-contas/:id', zValidator('json', contaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const d = c.req.valid('json')
  const now = new Date().toISOString()

  const fields: string[] = []
  const vals: unknown[] = []

  if (d.codigo !== undefined)           { fields.push('codigo = ?');            vals.push(d.codigo) }
  if (d.descricao !== undefined)        { fields.push('descricao = ?');         vals.push(d.descricao) }
  if (d.tipo !== undefined)             { fields.push('tipo = ?');              vals.push(d.tipo) }
  if (d.natureza !== undefined)         { fields.push('natureza = ?');          vals.push(d.natureza) }
  if (d.nivel !== undefined)            { fields.push('nivel = ?');             vals.push(d.nivel) }
  if (d.contaPaiId !== undefined)       { fields.push('conta_pai_id = ?');      vals.push(d.contaPaiId ?? null) }
  if (d.aceitaLancamento !== undefined) { fields.push('aceita_lancamento = ?'); vals.push(d.aceitaLancamento ? 1 : 0) }
  if (d.ativo !== undefined)            { fields.push('ativo = ?');             vals.push(d.ativo ? 1 : 0) }

  if (fields.length === 0) return c.json({ ok: true })

  fields.push('updated_at = ?')
  vals.push(now)
  vals.push(c.req.param('id'))
  vals.push(tenant.tenantId)

  await c.env.DB_SHARED
    .prepare(`UPDATE plano_contas SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals)
    .run()

  return c.json({ ok: true })
})

app.delete('/plano-contas/:id', async (c) => {
  const tenant = c.get('tenant')
  // Soft delete
  await c.env.DB_SHARED
    .prepare('UPDATE plano_contas SET ativo = 0, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind(new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ ok: true })
})

// Seed: importar plano padrão Simples Nacional
app.post('/plano-contas/seed', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId } = await c.req.json<{ empresaId?: string }>()

  // Verificar se já foi importado
  const existente = await c.env.DB_SHARED
    .prepare('SELECT COUNT(*) as c FROM plano_contas WHERE tenant_id = ? LIMIT 1')
    .bind(tenant.tenantId)
    .first<{ c: number }>()

  if ((existente?.c ?? 0) > 0) {
    return c.json({ error: 'Plano de contas já existente. Use a edição individual para modificar.' }, 409)
  }

  const now = new Date().toISOString()
  const idMap = new Map<string, string>() // código → id

  for (const conta of PLANO_PADRAO) {
    const id = crypto.randomUUID()
    idMap.set(conta.codigo, id)

    const paiCodigo = codigoPai(conta.codigo)
    const contaPaiId = paiCodigo ? (idMap.get(paiCodigo) ?? null) : null

    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO plano_contas
          (id, tenant_id, empresa_id, codigo, descricao, tipo, natureza, nivel,
           conta_pai_id, aceita_lancamento, ativo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .bind(id, tenant.tenantId, empresaId ?? null, conta.codigo, conta.descricao,
        conta.tipo, conta.natureza, conta.nivel, contaPaiId,
        conta.aceitaLancamento ? 1 : 0, now)
      .run()
  }

  return c.json({ ok: true, total: PLANO_PADRAO.length }, 201)
})

// ─── Centros de Custo ────────────────────────────────────────────────────────

const ccSchema = z.object({
  empresaId: z.string().optional().nullable(),
  codigo:    z.string().min(1),
  descricao: z.string().min(1),
  ativo:     z.boolean().default(true),
})

app.get('/centros-custo', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT * FROM centros_custo WHERE tenant_id = ? AND ativo = 1 ORDER BY codigo')
    .bind(tenant.tenantId)
    .all()
  return c.json({ centros: results })
})

app.post('/centros-custo', zValidator('json', ccSchema), async (c) => {
  const tenant = c.get('tenant')
  const d = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await c.env.DB_SHARED
    .prepare('INSERT INTO centros_custo (id, tenant_id, empresa_id, codigo, descricao, ativo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, tenant.tenantId, d.empresaId ?? null, d.codigo, d.descricao, d.ativo ? 1 : 0, now)
    .run()
  return c.json({ id }, 201)
})

app.put('/centros-custo/:id', zValidator('json', ccSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const d = c.req.valid('json')
  const now = new Date().toISOString()
  const fields: string[] = []
  const vals: unknown[] = []
  if (d.codigo)    { fields.push('codigo = ?');    vals.push(d.codigo) }
  if (d.descricao) { fields.push('descricao = ?'); vals.push(d.descricao) }
  if (d.ativo !== undefined) { fields.push('ativo = ?'); vals.push(d.ativo ? 1 : 0) }
  fields.push('updated_at = ?')
  vals.push(now, c.req.param('id'), tenant.tenantId)
  await c.env.DB_SHARED
    .prepare(`UPDATE centros_custo SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals).run()
  return c.json({ ok: true })
})

// ─── Lançamentos ─────────────────────────────────────────────────────────────

const partidaSchema = z.object({
  contaId:              z.string(),
  debito:               z.number().min(0).default(0),
  credito:              z.number().min(0).default(0),
  centroCustoId:        z.string().optional().nullable(),
  historicoComplementar: z.string().optional().nullable(),
})

const lancamentoSchema = z.object({
  empresaId:     z.string().optional().nullable(),
  dataLancamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  historico:     z.string().min(1),
  partidas:      z.array(partidaSchema).min(2),
})

app.get('/lancamentos', async (c) => {
  const tenant = c.get('tenant')
  const { de, ate, contaId, page, limit: limitQ } = c.req.query()
  const limit = Math.min(parseInt(limitQ ?? '50'), 200)
  const offset = Math.max(0, (parseInt(page ?? '0')) * limit)

  const conds = ['lc.tenant_id = ?']
  const params: unknown[] = [tenant.tenantId]

  if (de)      { conds.push('lc.data_lancamento >= ?'); params.push(de) }
  if (ate)     { conds.push('lc.data_lancamento <= ?'); params.push(ate) }
  if (contaId) {
    conds.push('EXISTS (SELECT 1 FROM lancamentos_contabeis_itens lci2 WHERE lci2.lancamento_id = lc.id AND lci2.conta_id = ?)')
    params.push(contaId)
  }

  const where = conds.join(' AND ')
  const total = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c FROM lancamentos_contabeis lc WHERE ${where}`)
    .bind(...params)
    .first<{ c: number }>()

  const { results: lancamentos } = await c.env.DB_SHARED
    .prepare(`
      SELECT lc.id, lc.numero, lc.data_lancamento, lc.historico,
             lc.origem_tipo, lc.origem_id, lc.status, lc.created_at
      FROM lancamentos_contabeis lc
      WHERE ${where}
      ORDER BY lc.data_lancamento DESC, lc.numero DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...params, limit, offset)
    .all()

  // Buscar partidas de cada lançamento
  const ids = lancamentos.map((l: any) => l.id)
  let itens: any[] = []
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',')
    const { results } = await c.env.DB_SHARED
      .prepare(`
        SELECT lci.*, pc.codigo as conta_codigo, pc.descricao as conta_descricao
        FROM lancamentos_contabeis_itens lci
        JOIN plano_contas pc ON pc.id = lci.conta_id
        WHERE lci.lancamento_id IN (${placeholders})
      `)
      .bind(...ids)
      .all()
    itens = results as any[]
  }

  const itensPorLancamento = new Map<string, any[]>()
  for (const item of itens) {
    const arr = itensPorLancamento.get(item.lancamento_id) ?? []
    arr.push(item)
    itensPorLancamento.set(item.lancamento_id, arr)
  }

  const result = lancamentos.map((l: any) => ({
    ...l,
    partidas: itensPorLancamento.get(l.id) ?? [],
  }))

  return c.json({ lancamentos: result, total: total?.c ?? 0, page: parseInt(page ?? '0'), limit })
})

app.get('/lancamentos/:id', async (c) => {
  const tenant = c.get('tenant')
  const lanc = await c.env.DB_SHARED
    .prepare('SELECT * FROM lancamentos_contabeis WHERE id = ? AND tenant_id = ? LIMIT 1')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()
  if (!lanc) return c.json({ error: 'Não encontrado' }, 404)

  const { results: partidas } = await c.env.DB_SHARED
    .prepare(`
      SELECT lci.*, pc.codigo as conta_codigo, pc.descricao as conta_descricao
      FROM lancamentos_contabeis_itens lci
      JOIN plano_contas pc ON pc.id = lci.conta_id
      WHERE lci.lancamento_id = ?
    `)
    .bind(c.req.param('id'))
    .all()

  return c.json({ ...lanc, partidas })
})

app.post('/lancamentos', zValidator('json', lancamentoSchema), async (c) => {
  const tenant = c.get('tenant')
  const d = c.req.valid('json')

  // Validar que débitos = créditos
  const totalDebito  = d.partidas.reduce((s, p) => s + p.debito, 0)
  const totalCredito = d.partidas.reduce((s, p) => s + p.credito, 0)
  if (Math.abs(totalDebito - totalCredito) > 0.005) {
    return c.json({ error: `Débitos (${totalDebito.toFixed(2)}) ≠ Créditos (${totalCredito.toFixed(2)})` }, 422)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const ano = new Date(d.dataLancamento).getFullYear()

  // Número sequencial
  const maxRow = await c.env.DB_SHARED
    .prepare(`SELECT MAX(numero) as m FROM lancamentos_contabeis WHERE tenant_id = ? AND substr(data_lancamento,1,4) = ?`)
    .bind(tenant.tenantId, String(ano))
    .first<{ m: number | null }>()
  const numero = (maxRow?.m ?? 0) + 1

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO lancamentos_contabeis
        (id, tenant_id, empresa_id, numero, data_lancamento, historico, origem_tipo, status, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'manual', 'ativo', ?, ?)
    `)
    .bind(id, tenant.tenantId, d.empresaId ?? null, numero, d.dataLancamento, d.historico, auditUserId(c), now)
    .run()

  for (const p of d.partidas) {
    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO lancamentos_contabeis_itens
          (id, tenant_id, lancamento_id, conta_id, debito, credito, centro_custo_id, historico_complementar, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(crypto.randomUUID(), tenant.tenantId, id, p.contaId, p.debito, p.credito,
        p.centroCustoId ?? null, p.historicoComplementar ?? null, now)
      .run()
  }

  return c.json({ id, numero }, 201)
})

// Estorno de lançamento
app.post('/lancamentos/:id/estornar', async (c) => {
  const tenant = c.get('tenant')
  const lcId = c.req.param('id')

  const original = await c.env.DB_SHARED
    .prepare('SELECT * FROM lancamentos_contabeis WHERE id = ? AND tenant_id = ? AND status = ? LIMIT 1')
    .bind(lcId, tenant.tenantId, 'ativo')
    .first<any>()
  if (!original) return c.json({ error: 'Lançamento não encontrado ou já estornado' }, 404)

  const { results: partidas } = await c.env.DB_SHARED
    .prepare('SELECT * FROM lancamentos_contabeis_itens WHERE lancamento_id = ?')
    .bind(lcId)
    .all<any>()

  const estornoId = crypto.randomUUID()
  const now = new Date().toISOString()
  const hoje = now.slice(0, 10)
  const ano = new Date(hoje).getFullYear()

  const maxRow = await c.env.DB_SHARED
    .prepare(`SELECT MAX(numero) as m FROM lancamentos_contabeis WHERE tenant_id = ? AND substr(data_lancamento,1,4) = ?`)
    .bind(tenant.tenantId, String(ano))
    .first<{ m: number | null }>()
  const numero = (maxRow?.m ?? 0) + 1

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO lancamentos_contabeis
        (id, tenant_id, empresa_id, numero, data_lancamento, historico, origem_tipo, status, estorno_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'manual', 'ativo', ?, ?, ?)
    `)
    .bind(estornoId, tenant.tenantId, original.empresa_id, numero, hoje,
      `ESTORNO: ${original.historico}`, auditUserId(c), lcId, now)
    .run()

  // Inverter débito/crédito
  for (const p of partidas) {
    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO lancamentos_contabeis_itens
          (id, tenant_id, lancamento_id, conta_id, debito, credito, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(crypto.randomUUID(), tenant.tenantId, estornoId, p.conta_id, p.credito, p.debito, now)
      .run()
  }

  // Marcar original como estornado
  await c.env.DB_SHARED
    .prepare('UPDATE lancamentos_contabeis SET status = ?, estorno_id = ?, updated_at = ? WHERE id = ?')
    .bind('estornado', estornoId, now, lcId)
    .run()

  return c.json({ estornoId, numero })
})

// ─── Relatórios ──────────────────────────────────────────────────────────────

// Razão Contábil
app.get('/relatorios/razao', async (c) => {
  const tenant = c.get('tenant')
  const { contaId, de, ate } = c.req.query()

  if (!contaId) return c.json({ error: 'contaId obrigatório' }, 400)

  const { results: movimentos } = await c.env.DB_SHARED
    .prepare(`
      SELECT lc.numero, lc.data_lancamento, lc.historico, lc.origem_tipo,
             lci.debito, lci.credito
      FROM lancamentos_contabeis lc
      JOIN lancamentos_contabeis_itens lci ON lci.lancamento_id = lc.id
      WHERE lc.tenant_id = ?
        AND lci.conta_id = ?
        AND lc.status = 'ativo'
        ${de  ? 'AND lc.data_lancamento >= ?' : ''}
        ${ate ? 'AND lc.data_lancamento <= ?' : ''}
      ORDER BY lc.data_lancamento, lc.numero
    `)
    .bind(...([tenant.tenantId, contaId, ...(de ? [de] : []), ...(ate ? [ate] : [])]))
    .all()

  const conta = await c.env.DB_SHARED
    .prepare('SELECT * FROM plano_contas WHERE id = ? AND tenant_id = ? LIMIT 1')
    .bind(contaId, tenant.tenantId)
    .first()

  // Calcular saldo progressivo
  let saldo = 0
  const linhas = (movimentos as any[]).map(m => {
    saldo += m.debito - m.credito
    return { ...m, saldo }
  })

  return c.json({ conta, movimentos: linhas })
})

// Balancete de Verificação
app.get('/relatorios/balancete', async (c) => {
  const tenant = c.get('tenant')
  const { de, ate, empresaId } = c.req.query()

  const { results: contas } = await c.env.DB_SHARED
    .prepare(`
      SELECT pc.*,
             COALESCE(SUM(lci.debito), 0)  as total_debito,
             COALESCE(SUM(lci.credito), 0) as total_credito
      FROM plano_contas pc
      LEFT JOIN lancamentos_contabeis_itens lci ON lci.conta_id = pc.id
      LEFT JOIN lancamentos_contabeis lc ON lc.id = lci.lancamento_id
        AND lc.status = 'ativo'
        ${de  ? 'AND lc.data_lancamento >= ?' : ''}
        ${ate ? 'AND lc.data_lancamento <= ?' : ''}
      WHERE pc.tenant_id = ?
        AND pc.ativo = 1
        ${empresaId ? 'AND (pc.empresa_id = ? OR pc.empresa_id IS NULL)' : ''}
      GROUP BY pc.id
      ORDER BY pc.codigo
    `)
    .bind(...([...(de ? [de] : []), ...(ate ? [ate] : []), tenant.tenantId, ...(empresaId ? [empresaId] : [])]))
    .all()

  const total = {
    debito:  (contas as any[]).reduce((s, c) => s + c.total_debito, 0),
    credito: (contas as any[]).reduce((s, c) => s + c.total_credito, 0),
  }

  return c.json({ contas, total })
})

// DRE — Demonstração do Resultado do Exercício
app.get('/relatorios/dre', async (c) => {
  const tenant = c.get('tenant')
  const { de, ate, empresaId } = c.req.query()

  const { results } = await c.env.DB_SHARED
    .prepare(`
      SELECT pc.codigo, pc.descricao, pc.tipo, pc.natureza, pc.nivel,
             COALESCE(SUM(lci.debito), 0)  as total_debito,
             COALESCE(SUM(lci.credito), 0) as total_credito
      FROM plano_contas pc
      LEFT JOIN lancamentos_contabeis_itens lci ON lci.conta_id = pc.id
      LEFT JOIN lancamentos_contabeis lc ON lc.id = lci.lancamento_id
        AND lc.status = 'ativo'
        ${de  ? 'AND lc.data_lancamento >= ?' : ''}
        ${ate ? 'AND lc.data_lancamento <= ?' : ''}
      WHERE pc.tenant_id = ?
        AND pc.ativo = 1
        AND pc.tipo IN ('receita', 'custo', 'despesa')
        ${empresaId ? 'AND (pc.empresa_id = ? OR pc.empresa_id IS NULL)' : ''}
      GROUP BY pc.id
      ORDER BY pc.codigo
    `)
    .bind(...([...(de ? [de] : []), ...(ate ? [ate] : []), tenant.tenantId, ...(empresaId ? [empresaId] : [])]))
    .all()

  const linhas = (results as any[]).map(r => ({
    ...r,
    saldo_liquido: r.tipo === 'receita'
      ? r.total_credito - r.total_debito
      : r.total_debito - r.total_credito,
  }))

  const receitaBruta = linhas.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.saldo_liquido, 0)
  const totalCustos  = linhas.filter(l => l.tipo === 'custo').reduce((s, l) => s + l.saldo_liquido, 0)
  const totalDespesas = linhas.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.saldo_liquido, 0)
  const lucroBruto   = receitaBruta - totalCustos
  const resultadoLiq = lucroBruto - totalDespesas

  return c.json({
    linhas,
    resumo: { receitaBruta, totalCustos, lucroBruto, totalDespesas, resultadoLiq },
  })
})

// Livro Caixa (relevante para Simples Nacional)
app.get('/relatorios/livro-caixa', async (c) => {
  const tenant = c.get('tenant')
  const { de, ate, empresaId } = c.req.query()

  // Contas de caixa/banco (tipo ativo, nível 4 no grupo 1.1.01)
  const { results: contasCaixa } = await c.env.DB_SHARED
    .prepare(`SELECT id FROM plano_contas WHERE tenant_id = ? AND codigo LIKE '1.1.01.%' AND ativo = 1`)
    .bind(tenant.tenantId)
    .all<{ id: string }>()

  const contaIds = contasCaixa.map(c => c.id)
  if (contaIds.length === 0) return c.json({ movimentos: [], saldoFinal: 0 })

  const placeholders = contaIds.map(() => '?').join(',')

  const { results: movimentos } = await c.env.DB_SHARED
    .prepare(`
      SELECT lc.numero, lc.data_lancamento, lc.historico, lc.origem_tipo, lc.origem_id,
             pc.codigo as conta_codigo, pc.descricao as conta_descricao,
             lci.debito, lci.credito
      FROM lancamentos_contabeis lc
      JOIN lancamentos_contabeis_itens lci ON lci.lancamento_id = lc.id
      JOIN plano_contas pc ON pc.id = lci.conta_id
      WHERE lc.tenant_id = ?
        AND lci.conta_id IN (${placeholders})
        AND lc.status = 'ativo'
        ${de  ? 'AND lc.data_lancamento >= ?' : ''}
        ${ate ? 'AND lc.data_lancamento <= ?' : ''}
      ORDER BY lc.data_lancamento, lc.numero
    `)
    .bind(...([tenant.tenantId, ...contaIds, ...(de ? [de] : []), ...(ate ? [ate] : [])]))
    .all()

  let saldo = 0
  const linhas = (movimentos as any[]).map(m => {
    saldo += m.debito - m.credito
    return { ...m, saldo }
  })

  return c.json({ movimentos: linhas, saldoFinal: saldo })
})

// ─── Exportação CSV ───────────────────────────────────────────────────────────

app.get('/exportar/csv', async (c) => {
  const tenant = c.get('tenant')
  const { tipo, de, ate, empresaId } = c.req.query()

  let csvContent = ''
  let filename = 'exportacao.csv'

  if (tipo === 'lancamentos') {
    const { results } = await c.env.DB_SHARED
      .prepare(`
        SELECT lc.numero, lc.data_lancamento, lc.historico, lc.origem_tipo,
               pc.codigo as conta_codigo, pc.descricao as conta_descricao,
               lci.debito, lci.credito
        FROM lancamentos_contabeis lc
        JOIN lancamentos_contabeis_itens lci ON lci.lancamento_id = lc.id
        JOIN plano_contas pc ON pc.id = lci.conta_id
        WHERE lc.tenant_id = ?
          AND lc.status = 'ativo'
          ${de  ? 'AND lc.data_lancamento >= ?' : ''}
          ${ate ? 'AND lc.data_lancamento <= ?' : ''}
        ORDER BY lc.data_lancamento, lc.numero
      `)
      .bind(...([tenant.tenantId, ...(de ? [de] : []), ...(ate ? [ate] : [])]))
      .all()

    csvContent = 'Numero;Data;Historico;Origem;Conta Codigo;Conta Descricao;Debito;Credito\n'
    for (const r of results as any[]) {
      csvContent += `${r.numero};${r.data_lancamento};"${r.historico}";"${r.origem_tipo ?? ''}";${r.conta_codigo};"${r.conta_descricao}";${r.debito.toFixed(2)};${r.credito.toFixed(2)}\n`
    }
    filename = `lancamentos_${de ?? 'inicio'}_${ate ?? 'fim'}.csv`

  } else if (tipo === 'balancete') {
    const { results } = await c.env.DB_SHARED
      .prepare(`
        SELECT pc.codigo, pc.descricao, pc.tipo, pc.natureza,
               COALESCE(SUM(lci.debito), 0) as total_debito,
               COALESCE(SUM(lci.credito), 0) as total_credito
        FROM plano_contas pc
        LEFT JOIN lancamentos_contabeis_itens lci ON lci.conta_id = pc.id
        LEFT JOIN lancamentos_contabeis lc ON lc.id = lci.lancamento_id
          AND lc.status = 'ativo'
          ${de  ? 'AND lc.data_lancamento >= ?' : ''}
          ${ate ? 'AND lc.data_lancamento <= ?' : ''}
        WHERE pc.tenant_id = ? AND pc.ativo = 1
        GROUP BY pc.id
        ORDER BY pc.codigo
      `)
      .bind(...([...(de ? [de] : []), ...(ate ? [ate] : []), tenant.tenantId]))
      .all()

    csvContent = 'Codigo;Descricao;Tipo;Natureza;Total Debito;Total Credito;Saldo\n'
    for (const r of results as any[]) {
      const saldo = r.total_debito - r.total_credito
      csvContent += `${r.codigo};"${r.descricao}";${r.tipo};${r.natureza};${r.total_debito.toFixed(2)};${r.total_credito.toFixed(2)};${saldo.toFixed(2)}\n`
    }
    filename = `balancete_${de ?? 'inicio'}_${ate ?? 'fim'}.csv`

  } else if (tipo === 'dre') {
    const { results } = await c.env.DB_SHARED
      .prepare(`
        SELECT pc.codigo, pc.descricao, pc.tipo,
               COALESCE(SUM(lci.debito), 0) as total_debito,
               COALESCE(SUM(lci.credito), 0) as total_credito
        FROM plano_contas pc
        LEFT JOIN lancamentos_contabeis_itens lci ON lci.conta_id = pc.id
        LEFT JOIN lancamentos_contabeis lc ON lc.id = lci.lancamento_id
          AND lc.status = 'ativo'
          ${de  ? 'AND lc.data_lancamento >= ?' : ''}
          ${ate ? 'AND lc.data_lancamento <= ?' : ''}
        WHERE pc.tenant_id = ? AND pc.ativo = 1
          AND pc.tipo IN ('receita', 'custo', 'despesa')
        GROUP BY pc.id
        ORDER BY pc.codigo
      `)
      .bind(...([...(de ? [de] : []), ...(ate ? [ate] : []), tenant.tenantId]))
      .all()

    csvContent = 'Codigo;Descricao;Tipo;Credito;Debito;Saldo Liquido\n'
    for (const r of results as any[]) {
      const saldo = r.tipo === 'receita'
        ? r.total_credito - r.total_debito
        : r.total_debito - r.total_credito
      csvContent += `${r.codigo};"${r.descricao}";${r.tipo};${r.total_credito.toFixed(2)};${r.total_debito.toFixed(2)};${saldo.toFixed(2)}\n`
    }
    filename = `dre_${de ?? 'inicio'}_${ate ?? 'fim'}.csv`
  } else {
    return c.json({ error: 'tipo inválido. Use: lancamentos | balancete | dre' }, 400)
  }

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// ─── Exportação ECD (SPED Contábil) ─────────────────────────────────────────

app.get('/exportar/ecd', async (c) => {
  const tenant = c.get('tenant')
  const { ano, empresaId } = c.req.query()

  if (!ano || !empresaId) {
    return c.json({ error: 'ano e empresaId são obrigatórios' }, 400)
  }

  const anoNum = parseInt(ano, 10)
  if (isNaN(anoNum) || anoNum < 2020 || anoNum > 2100) {
    return c.json({ error: 'ano inválido' }, 400)
  }

  try {
    const txt = await gerarEcd(c.env.DB_SHARED, {
      tenantId: tenant.tenantId,
      empresaId,
      ano: anoNum,
    })

    return new Response(txt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="ECD_${anoNum}_${Date.now()}.txt"`,
      },
    })
  } catch (e: any) {
    return c.json({ error: e?.message ?? 'Erro ao gerar ECD' }, 500)
  }
})

export default app
