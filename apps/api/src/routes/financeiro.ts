import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { csvAttachment, rowsToCsv } from '../lib/csv'
import { parseListPagination } from '../lib/listPagination'

const app = new Hono<{ Bindings: Env }>()

const contaSchema = z.object({
  pessoaId: z.string().uuid(),
  descricao: z.string().min(2),
  valor: z.number().positive(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.string().optional(),
  observacoes: z.string().optional(),
  empresaId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  reguaId: z.string().uuid().optional().nullable(),
  // Issue #8 — campos financeiros
  nr_documento: z.string().optional(),
  especie: z.string().optional(),
  data_emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  data_lancamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  moeda: z.string().length(3).optional(),
})

const etapaReguaSchema = z.object({
  ordem: z.number().int(),
  offsetDias: z.number().int(),
  canal: z.enum(['email', 'sms', 'whatsapp']),
  mensagemTemplate: z.string().max(16000).optional().default(''),
})

const reguaCobrancaBodySchema = z.object({
  nome: z.string().min(2),
  perfil: z.enum(['geral', 'novo_cliente', 'bom_pagador', 'pagador_duvidoso', 'mau_pagador']),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  ehPadrao: z.boolean().optional(),
  etapas: z.array(etapaReguaSchema).optional().default([]),
})

// ─── Contas a Receber ─────────────────────────────────────────────

app.get('/receber', async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query()
  const { empresaId, filialId, status, vencidoAte, pedidoId } = q
  const exportFmt = q.export

  let where = `
    FROM contas_receber cr
    LEFT JOIN pessoas p ON p.id = cr.pessoa_id
    LEFT JOIN regua_cobranca rg ON rg.id = cr.regua_id AND rg.tenant_id = cr.tenant_id
    WHERE cr.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { where += ' AND cr.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { where += ' AND cr.filial_id = ?'; params.push(filialId) }
  if (status) { where += ' AND cr.status = ?'; params.push(status) }
  if (pedidoId) { where += ' AND cr.pedido_id = ?'; params.push(pedidoId) }
  if (vencidoAte) { where += ' AND cr.vencimento <= ? AND cr.status != ?'; params.push(vencidoAte, 'pago') }

  const selectList = `
    SELECT cr.id, cr.codigo, cr.descricao, cr.valor, cr.vencimento, cr.status,
           cr.categoria, cr.observacoes, cr.data_pagamento, cr.valor_pago,
           cr.created_at, cr.pessoa_id, cr.pedido_id, cr.regua_id,
           p.nome as cliente,
           rg.nome as regua_nome
  `

  const query = `${selectList} ${where} ORDER BY cr.vencimento`

  if (exportFmt === 'csv') {
    const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
    const cols = [
      'codigo',
      'id',
      'descricao',
      'valor',
      'vencimento',
      'status',
      'categoria',
      'pessoa_id',
      'pedido_id',
      'cliente',
      'data_pagamento',
      'valor_pago',
    ]
    const rows = ((results ?? []) as unknown[]).map((r) => r as Record<string, unknown>)
    return csvAttachment(rowsToCsv(rows, cols), 'contas_receber.csv')
  }

  const { limit, offset, page } = parseListPagination(c)
  const countRow = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c ${where}`)
    .bind(...params)
    .first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)

  const pageQuery = `${query} LIMIT ? OFFSET ?`
  const { results: pageResults } = await c.env.DB_SHARED.prepare(pageQuery).bind(...params, limit, offset).all()

  return c.json({ contas: pageResults, total, page, limit })
})

app.get('/receber/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare(`
      SELECT cr.*, p.nome as cliente, rg.nome as regua_nome
      FROM contas_receber cr
      LEFT JOIN pessoas p ON p.id = cr.pessoa_id
      LEFT JOIN regua_cobranca rg ON rg.id = cr.regua_id AND rg.tenant_id = cr.tenant_id
      WHERE cr.id = ? AND cr.tenant_id = ?
    `)
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/receber', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  if (data.reguaId) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT 1 AS x FROM regua_cobranca WHERE id = ? AND tenant_id = ?')
      .bind(data.reguaId, tenant.tenantId)
      .first()
    if (!ok) return c.json({ error: 'Régua de cobrança inválida ou inexistente.' }, 400)
  }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_receber
        (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status,
         categoria, observacoes, nr_documento, especie, data_emissao, data_lancamento, moeda,
         regua_id, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.pessoaId, data.descricao, data.valor, data.vencimento,
      data.categoria ?? null, data.observacoes ?? null,
      data.nr_documento ?? null, data.especie ?? 'DM',
      data.data_emissao ?? null, data.data_lancamento ?? now.slice(0, 10),
      data.moeda ?? 'BRL',
      data.reguaId ?? null,
      now, now, uid, uid,
    )
    .run()

  return c.json({ id, message: 'Conta a receber criada.' }, 201)
})

app.put('/receber/:id', zValidator('json', contaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  if (data.reguaId) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT 1 AS x FROM regua_cobranca WHERE id = ? AND tenant_id = ?')
      .bind(data.reguaId, tenant.tenantId)
      .first()
    if (!ok) return c.json({ error: 'Régua de cobrança inválida ou inexistente.' }, 400)
  }

  const fieldMap: Record<string, string> = {
    pessoaId: 'pessoa_id', descricao: 'descricao', valor: 'valor',
    vencimento: 'vencimento', categoria: 'categoria', observacoes: 'observacoes',
    empresaId: 'empresa_id', filialId: 'filial_id',
    reguaId: 'regua_id',
    nr_documento: 'nr_documento', especie: 'especie',
    data_emissao: 'data_emissao', data_lancamento: 'data_lancamento', moeda: 'moeda',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_receber SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/receber/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM contas_receber WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

app.patch('/receber/:id/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { dataPagamento, valorPago, contaBancariaId } = await c.req.json<{
    dataPagamento: string
    valorPago: number
    contaBancariaId?: string
  }>()

  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const id = c.req.param('id')

  // Busca o título para montar a descrição do movimento
  const titulo = await c.env.DB_SHARED
    .prepare('SELECT descricao, pessoa_id FROM contas_receber WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId).first<{ descricao: string }>()

  const stmts = [
    c.env.DB_SHARED.prepare(`
      UPDATE contas_receber
      SET status = 'pago', data_pagamento = ?, valor_pago = ?,
          conta_bancaria_id = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(dataPagamento, valorPago, contaBancariaId ?? null, now, uid, id, tenant.tenantId),
  ]

  // Gera movimento bancário se informou conta
  if (contaBancariaId) {
    const mbId = crypto.randomUUID()
    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO movimentos_bancarios
          (id, tenant_id, conta_bancaria_id, tipo, valor, data, descricao, origem_tipo, origem_id, created_at, created_by)
        VALUES (?, ?, ?, 'credito', ?, ?, ?, 'contas_receber', ?, ?, ?)
      `).bind(mbId, tenant.tenantId, contaBancariaId, valorPago, dataPagamento,
        titulo?.descricao ?? 'Recebimento', id, now, uid)
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: 'Recebimento registrado.', movimento_gerado: !!contaBancariaId })
})

// ─── Contas a Pagar ───────────────────────────────────────────────

app.get('/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = `
    FROM contas_pagar cp
    LEFT JOIN pessoas p ON p.id = cp.pessoa_id
    WHERE cp.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { where += ' AND cp.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { where += ' AND cp.filial_id = ?'; params.push(filialId) }
  if (status) { where += ' AND cp.status = ?'; params.push(status) }

  const selectList = `
    SELECT cp.id, cp.codigo, cp.descricao, cp.valor, cp.vencimento, cp.status,
           cp.categoria, cp.observacoes, cp.data_pagamento, cp.valor_pago,
           cp.created_at, cp.pessoa_id,
           p.nome as fornecedor
  `
  const query = `${selectList} ${where} ORDER BY cp.vencimento`

  const countRow = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c ${where}`)
    .bind(...params)
    .first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)

  const { results } = await c.env.DB_SHARED.prepare(`${query} LIMIT ? OFFSET ?`).bind(...params, limit, offset).all()
  return c.json({ contas: results, total, page, limit })
})

app.get('/pagar/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare(`
      SELECT cp.*, p.nome as fornecedor
      FROM contas_pagar cp
      LEFT JOIN pessoas p ON p.id = cp.pessoa_id
      WHERE cp.id = ? AND cp.tenant_id = ?
    `)
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/pagar', zValidator('json', contaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO contas_pagar
        (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status,
         categoria, observacoes, nr_documento, especie, data_emissao, data_lancamento, moeda,
         created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.pessoaId, data.descricao, data.valor, data.vencimento,
      data.categoria ?? null, data.observacoes ?? null,
      data.nr_documento ?? null, data.especie ?? 'DM',
      data.data_emissao ?? null, data.data_lancamento ?? now.slice(0, 10),
      data.moeda ?? 'BRL',
      now, now, uid, uid,
    )
    .run()

  return c.json({ id, message: 'Conta a pagar criada.' }, 201)
})

app.put('/pagar/:id', zValidator('json', contaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    pessoaId: 'pessoa_id', descricao: 'descricao', valor: 'valor',
    vencimento: 'vencimento', categoria: 'categoria', observacoes: 'observacoes',
    empresaId: 'empresa_id', filialId: 'filial_id',
    nr_documento: 'nr_documento', especie: 'especie',
    data_emissao: 'data_emissao', data_lancamento: 'data_lancamento', moeda: 'moeda',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_pagar SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/pagar/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM contas_pagar WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

app.patch('/pagar/:id/pagar', async (c) => {
  const tenant = c.get('tenant')
  const { dataPagamento, valorPago, contaBancariaId } = await c.req.json<{
    dataPagamento: string
    valorPago: number
    contaBancariaId?: string
  }>()

  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const id = c.req.param('id')

  const titulo = await c.env.DB_SHARED
    .prepare('SELECT descricao FROM contas_pagar WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId).first<{ descricao: string }>()

  const stmts = [
    c.env.DB_SHARED.prepare(`
      UPDATE contas_pagar
      SET status = 'pago', data_pagamento = ?, valor_pago = ?,
          conta_bancaria_id = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(dataPagamento, valorPago, contaBancariaId ?? null, now, uid, id, tenant.tenantId),
  ]

  if (contaBancariaId) {
    const mbId = crypto.randomUUID()
    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO movimentos_bancarios
          (id, tenant_id, conta_bancaria_id, tipo, valor, data, descricao, origem_tipo, origem_id, created_at, created_by)
        VALUES (?, ?, ?, 'debito', ?, ?, ?, 'contas_pagar', ?, ?, ?)
      `).bind(mbId, tenant.tenantId, contaBancariaId, valorPago, dataPagamento,
        titulo?.descricao ?? 'Pagamento', id, now, uid)
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: 'Pagamento registrado.', movimento_gerado: !!contaBancariaId })
})

// ─── Régua de cobrança (issue #21) ────────────────────────────────

app.get('/reguas-cobranca', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT r.id, r.nome, r.perfil, r.descricao, r.ativo, r.eh_padrao, r.created_at, r.updated_at,
           (SELECT COUNT(*) FROM regua_cobranca_etapa e WHERE e.regua_id = r.id) AS etapa_count
    FROM regua_cobranca r
    WHERE r.tenant_id = ?
    ORDER BY r.perfil, r.nome
  `).bind(tenant.tenantId).all()
  return c.json({ reguas: results ?? [] })
})

app.get('/reguas-cobranca/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const regua = await c.env.DB_SHARED
    .prepare('SELECT * FROM regua_cobranca WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first()
  if (!regua) return c.json({ error: 'Régua não encontrada.' }, 404)

  const { results: etapasRows } = await c.env.DB_SHARED.prepare(`
    SELECT id, ordem, offset_dias, canal, mensagem_template, created_at, updated_at
    FROM regua_cobranca_etapa WHERE regua_id = ?
    ORDER BY ordem ASC, offset_dias ASC
  `).bind(id).all()

  return c.json({ ...regua, etapas: etapasRows ?? [] })
})

app.post('/reguas-cobranca', zValidator('json', reguaCobrancaBodySchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  if (data.ehPadrao) {
    await c.env.DB_SHARED
      .prepare('UPDATE regua_cobranca SET eh_padrao = 0 WHERE tenant_id = ?')
      .bind(tenant.tenantId)
      .run()
  }

  await c.env.DB_SHARED.prepare(`
    INSERT INTO regua_cobranca
      (id, tenant_id, nome, perfil, descricao, ativo, eh_padrao, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    tenant.tenantId,
    data.nome,
    data.perfil,
    data.descricao ?? null,
    data.ativo === false ? 0 : 1,
    data.ehPadrao ? 1 : 0,
    now,
    now,
    uid,
    uid,
  ).run()

  const etapas = data.etapas ?? []
  if (etapas.length > 0) {
    const stmts = etapas.map((e) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO regua_cobranca_etapa
          (id, regua_id, ordem, offset_dias, canal, mensagem_template, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        id,
        e.ordem,
        e.offsetDias,
        e.canal,
        e.mensagemTemplate ?? '',
        now,
        now,
      ))
    await c.env.DB_SHARED.batch(stmts)
  }

  return c.json({ id, message: 'Régua criada.' }, 201)
})

app.put('/reguas-cobranca/:id', zValidator('json', reguaCobrancaBodySchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const existing = await c.env.DB_SHARED
    .prepare('SELECT id FROM regua_cobranca WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first()
  if (!existing) return c.json({ error: 'Régua não encontrada.' }, 404)

  if (data.ehPadrao) {
    await c.env.DB_SHARED
      .prepare('UPDATE regua_cobranca SET eh_padrao = 0 WHERE tenant_id = ? AND id != ?')
      .bind(tenant.tenantId, id)
      .run()
  }

  await c.env.DB_SHARED.prepare(`
    UPDATE regua_cobranca SET
      nome = ?, perfil = ?, descricao = ?, ativo = ?, eh_padrao = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND tenant_id = ?
  `).bind(
    data.nome,
    data.perfil,
    data.descricao ?? null,
    data.ativo === false ? 0 : 1,
    data.ehPadrao ? 1 : 0,
    now,
    uid,
    id,
    tenant.tenantId,
  ).run()

  await c.env.DB_SHARED.prepare('DELETE FROM regua_cobranca_etapa WHERE regua_id = ?').bind(id).run()

  const etapas = data.etapas ?? []
  if (etapas.length > 0) {
    const stmts = etapas.map((e) =>
      c.env.DB_SHARED.prepare(`
        INSERT INTO regua_cobranca_etapa
          (id, regua_id, ordem, offset_dias, canal, mensagem_template, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        id,
        e.ordem,
        e.offsetDias,
        e.canal,
        e.mensagemTemplate ?? '',
        now,
        now,
      ))
    await c.env.DB_SHARED.batch(stmts)
  }

  return c.json({ message: 'Régua atualizada.' })
})

app.delete('/reguas-cobranca/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const r = await c.env.DB_SHARED
    .prepare('DELETE FROM regua_cobranca WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .run()
  if (!r.meta?.changes) return c.json({ error: 'Régua não encontrada.' }, 404)
  return c.json({ message: 'Régua removida.' })
})

// ─── Dashboard ────────────────────────────────────────────────────

app.get('/dashboard', async (c) => {
  const tenant = c.get('tenant')

  const [receber, pagar, vencerEm7, vencerPagar7] = await Promise.all([
    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as recebido,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido,
        COUNT(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN 1 END) as qtd_vencido
      FROM contas_receber WHERE tenant_id = ?
    `).bind(tenant.tenantId).first(),

    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END) as pendente,
        SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as pago,
        SUM(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN valor ELSE 0 END) as vencido,
        COUNT(CASE WHEN status = 'pendente' AND vencimento < date('now') THEN 1 END) as qtd_vencido
      FROM contas_pagar WHERE tenant_id = ?
    `).bind(tenant.tenantId).first(),

    // Próximos vencimentos CR (7 dias)
    c.env.DB_SHARED.prepare(`
      SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, p.nome as cliente
      FROM contas_receber cr
      LEFT JOIN pessoas p ON p.id = cr.pessoa_id
      WHERE cr.tenant_id = ? AND cr.status = 'pendente'
        AND cr.vencimento BETWEEN date('now') AND date('now', '+7 days')
      ORDER BY cr.vencimento LIMIT 5
    `).bind(tenant.tenantId).all(),

    c.env.DB_SHARED.prepare(`
      SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, p.nome as fornecedor
      FROM contas_pagar cp
      LEFT JOIN pessoas p ON p.id = cp.pessoa_id
      WHERE cp.tenant_id = ? AND cp.status = 'pendente'
        AND cp.vencimento BETWEEN date('now') AND date('now', '+7 days')
      ORDER BY cp.vencimento LIMIT 5
    `).bind(tenant.tenantId).all(),
  ])

  // Saldos bancários
  const { results: contasBancarias } = await c.env.DB_SHARED.prepare(`
    SELECT cb.id, cb.nome, cb.tipo, cb.banco_nome,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.tenant_id = ? AND cb.ativo = 1
    GROUP BY cb.id
    ORDER BY cb.tipo, cb.nome
  `).bind(tenant.tenantId).all()

  const totalDisponivel = (contasBancarias as Array<{ saldo_atual: number }>)
    .reduce((sum, r) => sum + (r.saldo_atual ?? 0), 0)

  return c.json({
    receber,
    pagar,
    proximosVencimentosCR: vencerEm7.results,
    proximosVencimentosCP: vencerPagar7.results,
    contas_bancarias: contasBancarias,
    total_disponivel: totalDisponivel,
  })
})

export default app
