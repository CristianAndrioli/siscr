import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'

const app = new Hono<{ Bindings: Env }>()

// ─── Máquinas ────────────────────────────────────────────────────────────────

const maquinaSchema = z.object({
  nome: z.string().min(2),
  modelo: z.string().optional(),
  placa: z.string().optional(),
  numeroSerie: z.string().optional(),
  anoFabricacao: z.coerce.number().int().optional(),
  capacidade: z.string().optional(),
  status: z.enum(['operacional', 'manutencao', 'inativa']).default('operacional'),
  horimetroAtual: z.coerce.number().default(0),
  observacoes: z.string().optional(),
  empresaId: z.string().uuid().optional(),
})

app.get('/maquinas', async (c) => {
  const tenant = c.get('tenant')
  const { busca, status } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = 'WHERE tenant_id = ? AND ativo = 1'
  const params: unknown[] = [tenant.tenantId]
  if (status) { where += ' AND status = ?'; params.push(status) }
  if (busca) { where += ' AND (nome LIKE ? OR modelo LIKE ? OR placa LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c FROM maquinas ${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`SELECT * FROM maquinas ${where} ORDER BY nome LIMIT ? OFFSET ?`).bind(...params, limit, offset).all()

  return c.json({ maquinas: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/maquinas/:id', async (c) => {
  const tenant = c.get('tenant')
  const row = await c.env.DB_SHARED.prepare('SELECT * FROM maquinas WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).first()
  if (!row) return c.json({ error: 'Máquina não encontrada.' }, 404)
  return c.json(row)
})

app.post('/maquinas', zValidator('json', maquinaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  await c.env.DB_SHARED.prepare(`
    INSERT INTO maquinas (id, tenant_id, empresa_id, nome, modelo, placa, numero_serie, ano_fabricacao, capacidade, status, horimetro_atual, observacoes, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, data.empresaId ?? null, data.nome, data.modelo ?? null, data.placa ?? null, data.numeroSerie ?? null, data.anoFabricacao ?? null, data.capacidade ?? null, data.status, data.horimetroAtual, data.observacoes ?? null, now, now, uid, uid).run()
  return c.json({ id, message: 'Máquina cadastrada.' }, 201)
})

app.put('/maquinas/:id', zValidator('json', maquinaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const fields: string[] = []
  const vals: unknown[] = []
  const map: Record<string, string> = { nome: 'nome', modelo: 'modelo', placa: 'placa', numeroSerie: 'numero_serie', anoFabricacao: 'ano_fabricacao', capacidade: 'capacidade', status: 'status', horimetroAtual: 'horimetro_atual', observacoes: 'observacoes', empresaId: 'empresa_id' }
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); vals.push((data as Record<string, unknown>)[k] ?? null) }
  }
  if (!fields.length) return c.json({ error: 'Nenhum campo informado.' }, 400)
  await c.env.DB_SHARED.prepare(`UPDATE maquinas SET ${fields.join(', ')}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`).bind(...vals, now, uid, c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Atualizado.' })
})

app.delete('/maquinas/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('UPDATE maquinas SET ativo = 0 WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Removida.' })
})

// ─── Obras ───────────────────────────────────────────────────────────────────

const obraSchema = z.object({
  nome: z.string().min(2),
  clienteId: z.string().uuid().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  localizacao: z.string().optional(),
  municipio: z.string().optional(),
  areaEstimada: z.string().optional(),
  status: z.enum(['em_andamento', 'concluida', 'cancelada']).default('em_andamento'),
  observacoes: z.string().optional(),
  empresaId: z.string().uuid().optional(),
})

app.get('/obras', async (c) => {
  const tenant = c.get('tenant')
  const { busca, status, clienteId } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = 'FROM obras o LEFT JOIN pessoas p ON p.id = o.cliente_id WHERE o.tenant_id = ? AND o.ativo = 1'
  const params: unknown[] = [tenant.tenantId]
  if (status) { where += ' AND o.status = ?'; params.push(status) }
  if (clienteId) { where += ' AND o.cliente_id = ?'; params.push(clienteId) }
  if (busca) { where += ' AND (o.nome LIKE ? OR o.municipio LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c ${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`SELECT o.*, p.nome as cliente_nome ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all()

  return c.json({ obras: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/obras/:id', async (c) => {
  const tenant = c.get('tenant')
  const row = await c.env.DB_SHARED.prepare(`
    SELECT o.*, p.nome as cliente_nome FROM obras o LEFT JOIN pessoas p ON p.id = o.cliente_id WHERE o.id = ? AND o.tenant_id = ?
  `).bind(c.req.param('id'), tenant.tenantId).first()
  if (!row) return c.json({ error: 'Obra não encontrada.' }, 404)
  return c.json(row)
})

app.post('/obras', zValidator('json', obraSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  await c.env.DB_SHARED.prepare(`
    INSERT INTO obras (id, tenant_id, empresa_id, nome, cliente_id, data_inicio, data_fim, localizacao, municipio, area_estimada, status, observacoes, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, data.empresaId ?? null, data.nome, data.clienteId ?? null, data.dataInicio ?? null, data.dataFim ?? null, data.localizacao ?? null, data.municipio ?? null, data.areaEstimada ?? null, data.status, data.observacoes ?? null, now, now, uid, uid).run()
  return c.json({ id, message: 'Obra cadastrada.' }, 201)
})

app.put('/obras/:id', zValidator('json', obraSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const map: Record<string, string> = { nome: 'nome', clienteId: 'cliente_id', dataInicio: 'data_inicio', dataFim: 'data_fim', localizacao: 'localizacao', municipio: 'municipio', areaEstimada: 'area_estimada', status: 'status', observacoes: 'observacoes', empresaId: 'empresa_id' }
  const fields: string[] = []; const vals: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); vals.push((data as Record<string, unknown>)[k] ?? null) }
  }
  if (!fields.length) return c.json({ error: 'Nenhum campo informado.' }, 400)
  await c.env.DB_SHARED.prepare(`UPDATE obras SET ${fields.join(', ')}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`).bind(...vals, now, uid, c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Atualizado.' })
})

app.delete('/obras/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('UPDATE obras SET ativo = 0 WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Removida.' })
})

// ─── Alocação de máquinas na obra ────────────────────────────────────────────

const obraMaquinaSchema = z.object({
  maquinaId: z.string().uuid(),
  valorHora: z.coerce.number().optional(),
  dataAlocacao: z.string().optional(),
  dataLiberacao: z.string().optional(),
  observacoes: z.string().optional(),
})

app.get('/obras/:id/maquinas', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT om.*, m.nome as maquina_nome, m.placa as maquina_placa, m.status as maquina_status, m.horimetro_atual
    FROM obra_maquinas om
    LEFT JOIN maquinas m ON m.id = om.maquina_id
    WHERE om.obra_id = ? AND om.tenant_id = ? AND om.ativo = 1
    ORDER BY m.nome
  `).bind(c.req.param('id'), tenant.tenantId).all()
  return c.json({ maquinas: results ?? [] })
})

app.post('/obras/:id/maquinas', zValidator('json', obraMaquinaSchema), async (c) => {
  const tenant = c.get('tenant')
  const obraId = c.req.param('id')
  const data = c.req.valid('json')
  const existing = await c.env.DB_SHARED.prepare('SELECT id FROM obra_maquinas WHERE obra_id = ? AND maquina_id = ? AND tenant_id = ? AND ativo = 1').bind(obraId, data.maquinaId, tenant.tenantId).first()
  if (existing) return c.json({ error: 'Máquina já alocada nesta obra.' }, 400)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  await c.env.DB_SHARED.prepare(`
    INSERT INTO obra_maquinas (id, tenant_id, obra_id, maquina_id, valor_hora, data_alocacao, data_liberacao, observacoes, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, obraId, data.maquinaId, data.valorHora ?? null, data.dataAlocacao ?? now.slice(0, 10), data.dataLiberacao ?? null, data.observacoes ?? null, now, now, uid, uid).run()
  return c.json({ id, message: 'Máquina alocada.' }, 201)
})

app.delete('/obras/:obraId/maquinas/:maquinaId', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('UPDATE obra_maquinas SET ativo = 0 WHERE obra_id = ? AND maquina_id = ? AND tenant_id = ?').bind(c.req.param('obraId'), c.req.param('maquinaId'), tenant.tenantId).run()
  return c.json({ message: 'Máquina liberada da obra.' })
})

// ─── Apontamento de horas em lote (cria OS concluídas) ───────────────────────

const apontamentoSchema = z.object({
  turnoData: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turnoInicio: z.string().optional(),
  turnoFim: z.string().optional(),
  linhas: z.array(z.object({
    maquinaId: z.string().uuid().optional(),
    operadorId: z.string().uuid(),
    servicoId: z.string().uuid().optional(),
    descricao: z.string().optional(),
    horimetroInicial: z.coerce.number().optional(),
    horimetroFinal: z.coerce.number().optional(),
    horas: z.coerce.number().optional(),
    valorHora: z.coerce.number().optional(),
  })).min(1),
})

app.post('/obras/:id/apontamentos', zValidator('json', apontamentoSchema), async (c) => {
  const tenant = c.get('tenant')
  const obraId = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const obra = await c.env.DB_SHARED.prepare('SELECT id FROM obras WHERE id = ? AND tenant_id = ?').bind(obraId, tenant.tenantId).first()
  if (!obra) return c.json({ error: 'Obra não encontrada.' }, 404)

  const stmts: D1PreparedStatement[] = []
  for (const linha of data.linhas) {
    const horasFromHor = (linha.horimetroFinal != null && linha.horimetroInicial != null) ? Math.max(0, linha.horimetroFinal - linha.horimetroInicial) : null
    const horas = horasFromHor ?? (linha.horas ?? null)

    let valorHora = linha.valorHora ?? null
    if (!valorHora && linha.servicoId) {
      const svc = await c.env.DB_SHARED.prepare('SELECT preco FROM servicos WHERE id = ? AND tenant_id = ?').bind(linha.servicoId, tenant.tenantId).first<{ preco: number }>()
      if (svc) valorHora = svc.preco
    }
    if (!valorHora && linha.maquinaId) {
      const al = await c.env.DB_SHARED.prepare('SELECT valor_hora FROM obra_maquinas WHERE obra_id = ? AND maquina_id = ? AND tenant_id = ? AND ativo = 1').bind(obraId, linha.maquinaId, tenant.tenantId).first<{ valor_hora: number | null }>()
      if (al?.valor_hora) valorHora = al.valor_hora
    }
    const valorTotal = (horas != null && valorHora != null) ? horas * valorHora : null
    const id = crypto.randomUUID()
    stmts.push(c.env.DB_SHARED.prepare(`
      INSERT INTO ordens_servico_frota
        (id, tenant_id, obra_id, maquina_id, operador_id, servico_id, status, descricao,
         turno_data, turno_inicio, turno_fim, horimetro_inicial, horimetro_final, horas_trabalhadas,
         valor_hora, valor_total, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, 'concluido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, tenant.tenantId, obraId, linha.maquinaId ?? null, linha.operadorId, linha.servicoId ?? null,
      linha.descricao ?? null, data.turnoData, data.turnoInicio ?? null, data.turnoFim ?? null,
      linha.horimetroInicial ?? null, linha.horimetroFinal ?? null, horas, valorHora, valorTotal,
      now, now, uid, uid,
    ))
  }
  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: `${data.linhas.length} apontamento(s) registrado(s).`, count: data.linhas.length }, 201)
})

// ─── Resumo financeiro/operacional da obra ───────────────────────────────────

app.get('/obras/:id/resumo', async (c) => {
  const tenant = c.get('tenant')
  const obraId = c.req.param('id')
  const [horas, maq, med] = await Promise.all([
    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total_os,
        COALESCE(SUM(horas_trabalhadas), 0) as total_horas,
        COALESCE(SUM(valor_total), 0) as total_valor,
        COALESCE(SUM(CASE WHEN status = 'concluido' AND nota_fiscal_id IS NULL THEN valor_total ELSE 0 END), 0) as a_faturar,
        COALESCE(SUM(CASE WHEN nota_fiscal_id IS NOT NULL THEN valor_total ELSE 0 END), 0) as faturado,
        COALESCE(SUM(CASE WHEN status = 'concluido' AND nota_fiscal_id IS NULL THEN horas_trabalhadas ELSE 0 END), 0) as horas_a_faturar
      FROM ordens_servico_frota WHERE obra_id = ? AND tenant_id = ?
    `).bind(obraId, tenant.tenantId).first(),
    c.env.DB_SHARED.prepare('SELECT COUNT(*) as c FROM obra_maquinas WHERE obra_id = ? AND tenant_id = ? AND ativo = 1').bind(obraId, tenant.tenantId).first<{ c: number }>(),
    c.env.DB_SHARED.prepare('SELECT COUNT(*) as c FROM medicoes_frota WHERE obra_id = ? AND tenant_id = ?').bind(obraId, tenant.tenantId).first<{ c: number }>(),
  ])
  return c.json({ ...horas, maquinas_alocadas: Number(maq?.c ?? 0), total_medicoes: Number(med?.c ?? 0) })
})

// ─── Medições / Notas parciais por obra ──────────────────────────────────────

app.get('/obras/:id/medicoes', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare('SELECT * FROM medicoes_frota WHERE obra_id = ? AND tenant_id = ? ORDER BY numero DESC').bind(c.req.param('id'), tenant.tenantId).all()
  return c.json({ medicoes: results ?? [] })
})

app.post('/obras/:id/medicoes', async (c) => {
  const tenant = c.get('tenant')
  const obraId = c.req.param('id')
  let body: { periodoInicio?: string; periodoFim?: string; descricao?: string } = {}
  try { body = await c.req.json() } catch { /* sem body */ }

  const obra = await c.env.DB_SHARED.prepare('SELECT id, nome, cliente_id FROM obras WHERE id = ? AND tenant_id = ?').bind(obraId, tenant.tenantId).first<{ id: string; nome: string; cliente_id: string | null }>()
  if (!obra) return c.json({ error: 'Obra não encontrada.' }, 404)
  if (!obra.cliente_id) return c.json({ error: 'A obra não tem cliente vinculado. Configure o cliente antes de gerar a medição.' }, 400)

  let where = `WHERE os.obra_id = ? AND os.tenant_id = ? AND os.status = 'concluido' AND os.nota_fiscal_id IS NULL AND os.medicao_id IS NULL`
  const params: unknown[] = [obraId, tenant.tenantId]
  if (body.periodoInicio) { where += ' AND os.turno_data >= ?'; params.push(body.periodoInicio) }
  if (body.periodoFim) { where += ' AND os.turno_data <= ?'; params.push(body.periodoFim) }

  const { results: oss } = await c.env.DB_SHARED.prepare(`
    SELECT os.id, os.servico_id, os.horas_trabalhadas, os.valor_hora, os.valor_total, os.turno_data,
           m.nome as maquina_nome, sv.descricao as servico_desc, sv.preco as servico_preco
    FROM ordens_servico_frota os
    LEFT JOIN maquinas m ON m.id = os.maquina_id
    LEFT JOIN servicos sv ON sv.id = os.servico_id
    ${where}
    ORDER BY os.turno_data
  `).bind(...params).all<{ id: string; servico_id: string | null; horas_trabalhadas: number | null; valor_hora: number | null; valor_total: number | null; turno_data: string; maquina_nome: string | null; servico_desc: string | null; servico_preco: number | null }>()

  if (!oss || oss.length === 0) return c.json({ error: 'Não há apontamentos concluídos pendentes de faturamento neste período.' }, 400)

  // ── Busca empresa e próximo número ───
  const empresa = await c.env.DB_SHARED
    .prepare('SELECT id FROM empresas WHERE tenant_id = ? LIMIT 1')
    .bind(tenant.tenantId)
    .first<{ id: string }>()
  if (!empresa) return c.json({ error: 'Nenhuma empresa cadastrada. Cadastre a empresa antes de gerar medições.' }, 400)

  const lastNota = await c.env.DB_SHARED
    .prepare("SELECT MAX(CAST(numero AS INTEGER)) as max_num FROM notas_fiscais WHERE tenant_id = ? AND tipo = 'nfse'")
    .bind(tenant.tenantId)
    .first<{ max_num: number | null }>()
  const proximoNumero = (lastNota?.max_num ?? 0) + 1

  const lastMed = await c.env.DB_SHARED
    .prepare('SELECT MAX(numero) as max_num FROM medicoes_frota WHERE obra_id = ? AND tenant_id = ?')
    .bind(obraId, tenant.tenantId)
    .first<{ max_num: number | null }>()
  const numMedicao = (lastMed?.max_num ?? 0) + 1

  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const notaId = crypto.randomUUID()
  const medicaoId = crypto.randomUUID()

  const periodos = oss.map((o) => o.turno_data)
  const periodoInicio = body.periodoInicio ?? periodos[0]
  const periodoFim = body.periodoFim ?? periodos[periodos.length - 1]
  const descricaoMedicao = body.descricao || `Medição ${numMedicao} — ${obra.nome}`
  const observacoes = `Medição ${numMedicao} — Obra ${obra.nome} (${oss.length} apontamento(s))`

  const totalHoras = oss.reduce((a, os) => a + (os.horas_trabalhadas ?? 0), 0)
  const valorTotal = oss.reduce((a, os) => a + (os.valor_total ?? (os.horas_trabalhadas ?? 1) * (os.valor_hora ?? 0)), 0)

  // ── Monta batch ─────────────────────────────────────────────────────────────
  const batchStmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO notas_fiscais
        (id, tenant_id, empresa_id, tipo, numero, serie, status, destinatario_id,
         natureza_operacao, descricao_servico, aliquota_iss, valor_total,
         forma_pagamento, mod_frete, desconto, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, 'nfse', ?, '1', 'rascunho', ?,
              'Prestação de Serviços de Frota', ?, 0, ?,
              '17', 9, 0, ?, ?, ?, ?, ?)
    `).bind(
      notaId, tenant.tenantId, empresa.id, String(proximoNumero).padStart(9, '0'),
      obra.cliente_id, descricaoMedicao, valorTotal,
      observacoes, now, now, uid, uid,
    ),
  ]

  for (const os of oss) {
    const horas = os.horas_trabalhadas ?? 1
    const valorUnit = os.valor_hora ?? os.servico_preco ?? 0
    const desc = [os.servico_desc ?? 'Serviço de frota', os.maquina_nome ? `— ${os.maquina_nome}` : '', `(${os.turno_data})`].filter(Boolean).join(' ')
    batchStmts.push(c.env.DB_SHARED.prepare(`
      INSERT INTO nota_fiscal_itens
        (id, nota_fiscal_id, tenant_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, unidade, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'HM', ?)
    `).bind(
      crypto.randomUUID(), notaId, tenant.tenantId, os.servico_id ?? null,
      desc, horas, valorUnit, horas * valorUnit, now,
    ))
  }

  batchStmts.push(c.env.DB_SHARED.prepare(`
    INSERT INTO medicoes_frota
      (id, tenant_id, obra_id, numero, descricao, periodo_inicio, periodo_fim, total_horas, valor_total, status, nota_fiscal_id, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'faturada', ?, ?, ?, ?, ?)
  `).bind(medicaoId, tenant.tenantId, obraId, numMedicao, descricaoMedicao, periodoInicio, periodoFim, totalHoras, valorTotal, notaId, now, now, uid, uid))

  for (const os of oss) {
    batchStmts.push(c.env.DB_SHARED.prepare(
      'UPDATE ordens_servico_frota SET medicao_id = ?, nota_fiscal_id = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    ).bind(medicaoId, notaId, now, uid, os.id))
  }

  batchStmts.push(c.env.DB_SHARED.prepare(
    'UPDATE obras SET valor_faturado = COALESCE(valor_faturado, 0) + ?, updated_at = ?, updated_by = ? WHERE id = ?',
  ).bind(valorTotal, now, uid, obraId))

  await c.env.DB_SHARED.batch(batchStmts)

  return c.json({
    medicao_id: medicaoId,
    numero: numMedicao,
    nota_fiscal_id: notaId,
    total: valorTotal,
    ordens: oss.length,
    message: `Medição ${numMedicao} gerada com ${oss.length} apontamento(s). NFS-e rascunho criada — acesse Faturamento → NFS-e para emitir.`,
    redirect: '/faturamento/nfsservice',
  }, 201)
})

// ─── Finalizar obra ──────────────────────────────────────────────────────────

app.post('/obras/:id/finalizar', async (c) => {
  const tenant = c.get('tenant')
  const obraId = c.req.param('id')
  const obra = await c.env.DB_SHARED.prepare('SELECT id, status FROM obras WHERE id = ? AND tenant_id = ?').bind(obraId, tenant.tenantId).first<{ id: string; status: string }>()
  if (!obra) return c.json({ error: 'Obra não encontrada.' }, 404)
  if (obra.status === 'cancelada') return c.json({ error: 'Obra cancelada não pode ser finalizada.' }, 400)

  const pend = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(valor_total), 0) as v FROM ordens_servico_frota WHERE obra_id = ? AND tenant_id = ? AND status = 'concluido' AND nota_fiscal_id IS NULL`).bind(obraId, tenant.tenantId).first<{ c: number; v: number }>()

  const now = new Date().toISOString()
  const uid = auditUserId(c)
  await c.env.DB_SHARED.prepare("UPDATE obras SET status = 'concluida', data_conclusao = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?").bind(now.slice(0, 10), now, uid, obraId, tenant.tenantId).run()

  const pendentes = Number(pend?.c ?? 0)
  return c.json({
    message: 'Obra finalizada.',
    aviso: pendentes > 0 ? `Atenção: existem ${pendentes} apontamento(s) concluído(s) ainda não faturado(s) (R$ ${Number(pend?.v ?? 0).toFixed(2)}). Considere gerar a medição final.` : null,
    apontamentos_pendentes: pendentes,
  })
})

// ─── Ordens de Serviço ───────────────────────────────────────────────────────

const osSchema = z.object({
  obraId: z.string().uuid(),
  operadorId: z.string().uuid(),
  maquinaId: z.string().uuid().optional(),
  servicoId: z.string().uuid().optional(),
  status: z.enum(['pendente', 'execucao', 'concluido', 'cancelado']).default('pendente'),
  descricao: z.string().optional(),
  turnoData: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turnoInicio: z.string().optional(),
  turnoFim: z.string().optional(),
  horimetroInicial: z.coerce.number().optional(),
  horimetroFinal: z.coerce.number().optional(),
  valorHora: z.coerce.number().optional(),
  detalhesOperacao: z.string().optional(),
  empresaId: z.string().uuid().optional(),
})

app.get('/ordens', async (c) => {
  const tenant = c.get('tenant')
  const { busca, status, obraId, maquinaId } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = `FROM ordens_servico_frota os
    LEFT JOIN obras ob ON ob.id = os.obra_id
    LEFT JOIN pessoas op ON op.id = os.operador_id
    LEFT JOIN maquinas m ON m.id = os.maquina_id
    LEFT JOIN servicos sv ON sv.id = os.servico_id
    WHERE os.tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]
  if (status) { where += ' AND os.status = ?'; params.push(status) }
  if (obraId) { where += ' AND os.obra_id = ?'; params.push(obraId) }
  if (maquinaId) { where += ' AND os.maquina_id = ?'; params.push(maquinaId) }
  if (busca) { where += ' AND (ob.nome LIKE ? OR op.nome LIKE ? OR m.nome LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`) }

  const countRow = await c.env.DB_SHARED.prepare(`SELECT COUNT(*) as c ${where}`).bind(...params).first<{ c: number }>()
  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT os.*, ob.nome as obra_nome, op.nome as operador_nome, m.nome as maquina_nome, sv.descricao as servico_nome
    ${where} ORDER BY os.turno_data DESC, os.created_at DESC LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  return c.json({ ordens: results ?? [], total: Number(countRow?.c ?? 0), page, limit })
})

app.get('/ordens/:id', async (c) => {
  const tenant = c.get('tenant')
  const row = await c.env.DB_SHARED.prepare(`
    SELECT os.*, ob.nome as obra_nome, op.nome as operador_nome, m.nome as maquina_nome, sv.descricao as servico_nome, sv.preco as servico_preco
    FROM ordens_servico_frota os
    LEFT JOIN obras ob ON ob.id = os.obra_id
    LEFT JOIN pessoas op ON op.id = os.operador_id
    LEFT JOIN maquinas m ON m.id = os.maquina_id
    LEFT JOIN servicos sv ON sv.id = os.servico_id
    WHERE os.id = ? AND os.tenant_id = ?
  `).bind(c.req.param('id'), tenant.tenantId).first()
  if (!row) return c.json({ error: 'Ordem não encontrada.' }, 404)
  return c.json(row)
})

app.post('/ordens', zValidator('json', osSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Calcula horas trabalhadas e valor total
  const horasTrabalhadas = (data.horimetroFinal && data.horimetroInicial)
    ? Math.max(0, data.horimetroFinal - data.horimetroInicial)
    : null

  // Busca preço do serviço se não informado
  let valorHora = data.valorHora ?? null
  if (!valorHora && data.servicoId) {
    const svc = await c.env.DB_SHARED.prepare('SELECT preco FROM servicos WHERE id = ? AND tenant_id = ?').bind(data.servicoId, tenant.tenantId).first<{ preco: number }>()
    if (svc) valorHora = svc.preco
  }
  const valorTotal = (horasTrabalhadas && valorHora) ? horasTrabalhadas * valorHora : null

  await c.env.DB_SHARED.prepare(`
    INSERT INTO ordens_servico_frota
      (id, tenant_id, empresa_id, obra_id, maquina_id, operador_id, servico_id, status, descricao,
       turno_data, turno_inicio, turno_fim, horimetro_inicial, horimetro_final, horas_trabalhadas,
       valor_hora, valor_total, detalhes_operacao, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, tenant.tenantId, data.empresaId ?? null, data.obraId, data.maquinaId ?? null,
    data.operadorId, data.servicoId ?? null, data.status, data.descricao ?? null,
    data.turnoData, data.turnoInicio ?? null, data.turnoFim ?? null,
    data.horimetroInicial ?? null, data.horimetroFinal ?? null, horasTrabalhadas,
    valorHora, valorTotal, data.detalhesOperacao ?? null,
    now, now, uid, uid
  ).run()

  return c.json({ id, message: 'Ordem de serviço criada.' }, 201)
})

app.put('/ordens/:id', zValidator('json', osSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const current = await c.env.DB_SHARED.prepare('SELECT horimetro_inicial, horimetro_final, valor_hora, servico_id FROM ordens_servico_frota WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).first<{ horimetro_inicial: number | null; horimetro_final: number | null; valor_hora: number | null; servico_id: string | null }>()
  if (!current) return c.json({ error: 'Ordem não encontrada.' }, 404)

  const hI = data.horimetroInicial !== undefined ? data.horimetroInicial : current.horimetro_inicial
  const hF = data.horimetroFinal !== undefined ? data.horimetroFinal : current.horimetro_final
  const horasTrabalhadas = (hI != null && hF != null) ? Math.max(0, hF - hI) : null

  let valorHora = data.valorHora !== undefined ? data.valorHora : current.valor_hora
  const servicoId = data.servicoId !== undefined ? data.servicoId : current.servico_id
  if (!valorHora && servicoId) {
    const svc = await c.env.DB_SHARED.prepare('SELECT preco FROM servicos WHERE id = ? AND tenant_id = ?').bind(servicoId, tenant.tenantId).first<{ preco: number }>()
    if (svc) valorHora = svc.preco
  }
  const valorTotal = (horasTrabalhadas && valorHora) ? horasTrabalhadas * valorHora : null

  const map: Record<string, string> = { obraId: 'obra_id', maquinaId: 'maquina_id', operadorId: 'operador_id', servicoId: 'servico_id', status: 'status', descricao: 'descricao', turnoData: 'turno_data', turnoInicio: 'turno_inicio', turnoFim: 'turno_fim', horimetroInicial: 'horimetro_inicial', horimetroFinal: 'horimetro_final', valorHora: 'valor_hora', detalhesOperacao: 'detalhes_operacao', empresaId: 'empresa_id' }
  const fields: string[] = []; const vals: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); vals.push((data as Record<string, unknown>)[k] ?? null) }
  }
  fields.push('horas_trabalhadas = ?', 'valor_total = ?')
  vals.push(horasTrabalhadas, valorTotal)

  await c.env.DB_SHARED.prepare(`UPDATE ordens_servico_frota SET ${fields.join(', ')}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`).bind(...vals, now, uid, c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Atualizado.' })
})

app.delete('/ordens/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('DELETE FROM ordens_servico_frota WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Removida.' })
})

// ─── Faturar OS → cria NFS-e rascunho integrado ao módulo faturamento ────────
app.post('/ordens/:id/faturar', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const os = await c.env.DB_SHARED.prepare(`
    SELECT os.*, ob.cliente_id, ob.nome as obra_nome, sv.descricao as servico_desc, sv.preco as servico_preco,
           m.nome as maquina_nome
    FROM ordens_servico_frota os
    LEFT JOIN obras ob ON ob.id = os.obra_id
    LEFT JOIN servicos sv ON sv.id = os.servico_id
    LEFT JOIN maquinas m ON m.id = os.maquina_id
    WHERE os.id = ? AND os.tenant_id = ?
  `).bind(id, tenant.tenantId).first<{
    id: string; status: string; obra_id: string; obra_nome: string; cliente_id: string | null;
    servico_id: string | null; servico_desc: string | null; servico_preco: number | null;
    horas_trabalhadas: number | null; valor_hora: number | null; valor_total: number | null;
    maquina_nome: string | null; turno_data: string; nota_fiscal_id: string | null
  }>()

  if (!os) return c.json({ error: 'Ordem não encontrada.' }, 404)
  if (os.status !== 'concluido') return c.json({ error: 'Apenas ordens concluídas podem ser faturadas.' }, 400)
  if (os.nota_fiscal_id) return c.json({ error: 'Esta OS já foi faturada.' }, 400)
  if (!os.cliente_id) return c.json({ error: 'A obra não tem cliente vinculado. Configure o cliente da obra antes de faturar.' }, 400)

  const horas = os.horas_trabalhadas ?? 1
  const valorUnitario = os.valor_hora ?? os.servico_preco ?? 0
  const valorTotal = horas * valorUnitario

  const descricaoServico = [
    os.servico_desc ?? 'Serviço de frota',
    os.maquina_nome ? `— Máquina: ${os.maquina_nome}` : '',
    `— Obra: ${os.obra_nome}`,
    `— Turno: ${os.turno_data}`,
  ].filter(Boolean).join(' ')

  const empresa = await c.env.DB_SHARED
    .prepare('SELECT id FROM empresas WHERE tenant_id = ? LIMIT 1')
    .bind(tenant.tenantId)
    .first<{ id: string }>()
  if (!empresa) return c.json({ error: 'Nenhuma empresa cadastrada.' }, 400)

  const lastNota = await c.env.DB_SHARED
    .prepare("SELECT MAX(CAST(numero AS INTEGER)) as max_num FROM notas_fiscais WHERE tenant_id = ? AND tipo = 'nfse'")
    .bind(tenant.tenantId)
    .first<{ max_num: number | null }>()
  const proximoNumero = (lastNota?.max_num ?? 0) + 1

  const agora = new Date().toISOString()
  const uid = auditUserId(c)
  const notaId = crypto.randomUUID()

  await c.env.DB_SHARED.batch([
    c.env.DB_SHARED.prepare(`
      INSERT INTO notas_fiscais
        (id, tenant_id, empresa_id, tipo, numero, serie, status, destinatario_id,
         natureza_operacao, descricao_servico, aliquota_iss, valor_total,
         forma_pagamento, mod_frete, desconto, observacoes, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, 'nfse', ?, '1', 'rascunho', ?,
              'Prestação de Serviços de Frota', ?, 0, ?,
              '17', 9, 0, ?, ?, ?, ?, ?)
    `).bind(
      notaId, tenant.tenantId, empresa.id, String(proximoNumero).padStart(9, '0'),
      os.cliente_id, descricaoServico, valorTotal,
      `OS Frota #${id.slice(0, 8)} — ${os.obra_nome}`, agora, agora, uid, uid,
    ),
    c.env.DB_SHARED.prepare(`
      INSERT INTO nota_fiscal_itens
        (id, nota_fiscal_id, tenant_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, unidade, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'HM', ?)
    `).bind(
      crypto.randomUUID(), notaId, tenant.tenantId, os.servico_id ?? null,
      descricaoServico, horas, valorUnitario, valorTotal, agora,
    ),
    c.env.DB_SHARED.prepare('UPDATE ordens_servico_frota SET nota_fiscal_id = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .bind(notaId, agora, uid, id),
  ])

  return c.json({
    nota_fiscal_id: notaId,
    message: 'NFS-e rascunho criada. Acesse Faturamento → NFS-e para emitir e gerar o Contas a Receber.',
    redirect: `/faturamento/nfsservice`,
  }, 201)
})

// ─── Dashboard Frota ─────────────────────────────────────────────────────────
app.get('/dashboard', async (c) => {
  const tenant = c.get('tenant')

  const [maquinasStats, osStats, horasStats] = await Promise.all([
    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'operacional' THEN 1 ELSE 0 END) as operacionais,
        SUM(CASE WHEN status = 'manutencao' THEN 1 ELSE 0 END) as manutencao
      FROM maquinas WHERE tenant_id = ? AND ativo = 1
    `).bind(tenant.tenantId).first(),

    c.env.DB_SHARED.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN status = 'execucao' THEN 1 ELSE 0 END) as em_execucao,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluidas,
        SUM(CASE WHEN status = 'concluido' AND nota_fiscal_id IS NULL THEN 1 ELSE 0 END) as a_faturar
      FROM ordens_servico_frota WHERE tenant_id = ?
    `).bind(tenant.tenantId).first(),

    c.env.DB_SHARED.prepare(`
      SELECT
        COALESCE(SUM(horas_trabalhadas), 0) as total_horas,
        COALESCE(SUM(valor_total), 0) as total_valor,
        COALESCE(SUM(CASE WHEN nota_fiscal_id IS NOT NULL THEN valor_total ELSE 0 END), 0) as faturado
      FROM ordens_servico_frota WHERE tenant_id = ? AND status = 'concluido'
    `).bind(tenant.tenantId).first(),
  ])

  return c.json({ maquinas: maquinasStats, ordens: osStats, financeiro: horasStats })
})

export default app
