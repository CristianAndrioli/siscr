import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

const contaBancariaSchema = z.object({
  nome: z.string().min(2),
  banco_codigo: z.string().optional(),
  banco_nome: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo: z.enum(['corrente', 'poupanca', 'caixa', 'investimento']).default('corrente'),
  saldo_inicial: z.number().default(0),
  empresa_id: z.string().uuid().optional(),
  ativo: z.number().int().min(0).max(1).default(1),
})

// ─── Contas Bancárias ──────────────────────────────────────────────

app.get('/contas', async (c) => {
  const tenant = c.get('tenant')

  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.*,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.tenant_id = ? AND cb.ativo = 1
    GROUP BY cb.id
    ORDER BY cb.nome
  `).bind(tenant.tenantId).all()

  return c.json({ contas: results })
})

app.get('/contas/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.*,
      COALESCE(cb.saldo_inicial, 0)
        + COALESCE(SUM(CASE WHEN mb.tipo = 'credito' THEN mb.valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN mb.tipo = 'debito'  THEN mb.valor ELSE 0 END), 0)
      AS saldo_atual
    FROM contas_bancarias cb
    LEFT JOIN movimentos_bancarios mb ON mb.conta_bancaria_id = cb.id
    WHERE cb.id = ? AND cb.tenant_id = ?
    GROUP BY cb.id
  `).bind(c.req.param('id'), tenant.tenantId).first()

  if (!result) return c.json({ error: 'Conta não encontrada.' }, 404)
  return c.json(result)
})

app.post('/contas', zValidator('json', contaBancariaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO contas_bancarias
      (id, tenant_id, empresa_id, nome, banco_codigo, banco_nome, agencia, conta,
       tipo, saldo_inicial, ativo, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).bind(
    id, tenant.tenantId, data.empresa_id ?? null,
    data.nome, data.banco_codigo ?? null, data.banco_nome ?? null,
    data.agencia ?? null, data.conta ?? null,
    data.tipo, data.saldo_inicial,
    now, now, uid, uid,
  ).run()

  return c.json({ id, message: 'Conta bancária criada.' }, 201)
})

app.put('/contas/:id', zValidator('json', contaBancariaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    nome: 'nome', banco_codigo: 'banco_codigo', banco_nome: 'banco_nome',
    agencia: 'agencia', conta: 'conta', tipo: 'tipo',
    saldo_inicial: 'saldo_inicial', ativo: 'ativo', empresa_id: 'empresa_id',
  }

  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE contas_bancarias SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/contas/:id', async (c) => {
  const tenant = c.get('tenant')
  // Soft delete — apenas desativa
  await c.env.DB_SHARED
    .prepare(`UPDATE contas_bancarias SET ativo = 0, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Conta desativada.' })
})

// ─── Movimentos bancários ──────────────────────────────────────────

app.get('/movimentos', async (c) => {
  const tenant = c.get('tenant')
  const { contaId, dataInicio, dataFim, tipo } = c.req.query()

  let query = `
    SELECT mb.*, cb.nome as conta_nome
    FROM movimentos_bancarios mb
    JOIN contas_bancarias cb ON cb.id = mb.conta_bancaria_id
    WHERE mb.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (contaId) { query += ' AND mb.conta_bancaria_id = ?'; params.push(contaId) }
  if (tipo) { query += ' AND mb.tipo = ?'; params.push(tipo) }
  if (dataInicio) { query += ' AND mb.data >= ?'; params.push(dataInicio) }
  if (dataFim) { query += ' AND mb.data <= ?'; params.push(dataFim) }

  query += ' ORDER BY mb.data DESC, mb.created_at DESC'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ movimentos: results })
})

// Movimento manual (lançamento direto sem título)
app.post('/movimentos', zValidator('json', z.object({
  conta_bancaria_id: z.string().uuid(),
  tipo: z.enum(['credito', 'debito']),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().optional(),
})), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Valida que a conta pertence ao tenant
  const conta = await c.env.DB_SHARED
    .prepare('SELECT id FROM contas_bancarias WHERE id = ? AND tenant_id = ? AND ativo = 1')
    .bind(data.conta_bancaria_id, tenant.tenantId).first()
  if (!conta) return c.json({ error: 'Conta bancária não encontrada.' }, 404)

  await c.env.DB_SHARED.prepare(`
    INSERT INTO movimentos_bancarios
      (id, tenant_id, conta_bancaria_id, tipo, valor, data, descricao, origem_tipo, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).bind(id, tenant.tenantId, data.conta_bancaria_id, data.tipo, data.valor, data.data, data.descricao ?? null, now, uid).run()

  return c.json({ id, message: 'Movimento lançado.' }, 201)
})

// ─── Conciliação Bancária ──────────────────────────────────────────

// POST /conciliacoes/sugestoes — recebe transações OFX, retorna possíveis matches
app.post('/conciliacoes/sugestoes', zValidator('json', z.object({
  conta_bancaria_id: z.string().uuid(),
  transacoes: z.array(z.object({
    fitid: z.string(),
    tipo: z.enum(['credito', 'debito']),
    valor: z.number().positive(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    descricao: z.string().optional(),
  })).min(1).max(500),
})), async (c) => {
  const tenant = c.get('tenant')
  const { conta_bancaria_id, transacoes } = c.req.valid('json')

  // Valida conta
  const conta = await c.env.DB_SHARED
    .prepare('SELECT id FROM contas_bancarias WHERE id = ? AND tenant_id = ? AND ativo = 1')
    .bind(conta_bancaria_id, tenant.tenantId).first()
  if (!conta) return c.json({ error: 'Conta bancária não encontrada.' }, 404)

  // FITIDs já importados para esta conta (evitar duplicatas)
  const { results: fitidsExist } = await c.env.DB_SHARED.prepare(`
    SELECT ci.ofx_fitid
    FROM conciliacao_itens ci
    JOIN conciliacao_bancaria cb ON cb.id = ci.conciliacao_id
    WHERE cb.conta_bancaria_id = ? AND cb.tenant_id = ? AND ci.ofx_fitid IS NOT NULL
  `).bind(conta_bancaria_id, tenant.tenantId).all()
  const fitidsDuplicados = new Set((fitidsExist as Array<{ofx_fitid: string}>).map(r => r.ofx_fitid))

  const sugestoes: Record<string, unknown[]> = {}

  for (const trn of transacoes) {
    const matches: unknown[] = []

    // Busca em contas_receber (para créditos) ou contas_pagar (para débitos)
    if (trn.tipo === 'credito') {
      const { results } = await c.env.DB_SHARED.prepare(`
        SELECT 'contas_receber' as tipo, cr.id, cr.descricao, cr.valor,
               cr.vencimento as data, cr.status, p.nome as pessoa_nome
        FROM contas_receber cr
        LEFT JOIN pessoas p ON p.id = cr.pessoa_id
        WHERE cr.tenant_id = ?
          AND cr.status IN ('pendente', 'parcial', 'pago')
          AND ABS(cr.valor - ?) < 0.02
          AND cr.vencimento >= DATE(?, '-10 days')
          AND cr.vencimento <= DATE(?, '+10 days')
        ORDER BY ABS(julianday(cr.vencimento) - julianday(?))
        LIMIT 5
      `).bind(tenant.tenantId, trn.valor, trn.data, trn.data, trn.data).all()

      for (const r of (results as Array<Record<string, unknown>>)) {
        const daysDiff = Math.abs(
          (new Date(r.data as string).getTime() - new Date(trn.data).getTime()) / 86400000
        )
        const score = 50 + (daysDiff === 0 ? 30 : daysDiff <= 2 ? 22 : daysDiff <= 5 ? 14 : 6)
        matches.push({ ...r, score })
      }
    } else {
      const { results } = await c.env.DB_SHARED.prepare(`
        SELECT 'contas_pagar' as tipo, cp.id, cp.descricao, cp.valor,
               cp.vencimento as data, cp.status, p.nome as pessoa_nome
        FROM contas_pagar cp
        LEFT JOIN pessoas p ON p.id = cp.pessoa_id
        WHERE cp.tenant_id = ?
          AND cp.status IN ('pendente', 'parcial', 'pago')
          AND ABS(cp.valor - ?) < 0.02
          AND cp.vencimento >= DATE(?, '-10 days')
          AND cp.vencimento <= DATE(?, '+10 days')
        ORDER BY ABS(julianday(cp.vencimento) - julianday(?))
        LIMIT 5
      `).bind(tenant.tenantId, trn.valor, trn.data, trn.data, trn.data).all()

      for (const r of (results as Array<Record<string, unknown>>)) {
        const daysDiff = Math.abs(
          (new Date(r.data as string).getTime() - new Date(trn.data).getTime()) / 86400000
        )
        const score = 50 + (daysDiff === 0 ? 30 : daysDiff <= 2 ? 22 : daysDiff <= 5 ? 14 : 6)
        matches.push({ ...r, score })
      }
    }

    sugestoes[trn.fitid] = matches
  }

  return c.json({ sugestoes, fitids_duplicados: [...fitidsDuplicados] })
})

// GET /conciliacoes — histórico de conciliações de uma conta
app.get('/conciliacoes', async (c) => {
  const tenant = c.get('tenant')
  const { contaId } = c.req.query()

  let query = `
    SELECT cb.*, cnt.nome as conta_nome, cnt.banco_nome
    FROM conciliacao_bancaria cb
    JOIN contas_bancarias cnt ON cnt.id = cb.conta_bancaria_id
    WHERE cb.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]
  if (contaId) { query += ' AND cb.conta_bancaria_id = ?'; params.push(contaId) }
  query += ' ORDER BY cb.created_at DESC LIMIT 50'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ conciliacoes: results })
})

// GET /conciliacoes/:id — detalhe de uma sessão de conciliação
app.get('/conciliacoes/:id', async (c) => {
  const tenant = c.get('tenant')
  const { id } = c.req.param()

  const session = await c.env.DB_SHARED.prepare(`
    SELECT cb.*, cnt.nome as conta_nome, cnt.banco_nome, cnt.agencia, cnt.conta as conta_num
    FROM conciliacao_bancaria cb
    JOIN contas_bancarias cnt ON cnt.id = cb.conta_bancaria_id
    WHERE cb.id = ? AND cb.tenant_id = ?
  `).bind(id, tenant.tenantId).first()
  if (!session) return c.json({ error: 'Conciliação não encontrada.' }, 404)

  const { results: itens } = await c.env.DB_SHARED.prepare(`
    SELECT * FROM conciliacao_itens WHERE conciliacao_id = ? AND tenant_id = ?
    ORDER BY data, created_at
  `).bind(id, tenant.tenantId).all()

  return c.json({ session, itens })
})

// POST /conciliacoes — finaliza e persiste uma conciliação
const conciliacaoItemSchema = z.object({
  ofx_fitid: z.string(),
  tipo: z.enum(['credito', 'debito']),
  valor: z.number().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().optional(),
  acao: z.enum(['conciliar', 'ignorar', 'manual']),
  origem_tipo: z.enum(['contas_receber', 'contas_pagar']).optional(),
  origem_id: z.string().uuid().optional(),
})

app.post('/conciliacoes', zValidator('json', z.object({
  conta_bancaria_id: z.string().uuid(),
  arquivo_nome: z.string().optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  saldo_inicial: z.number().optional(),
  saldo_final: z.number().optional(),
  itens: z.array(conciliacaoItemSchema).min(1).max(500),
})), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const uid = auditUserId(c)
  const now = new Date().toISOString()

  // Valida conta
  const conta = await c.env.DB_SHARED
    .prepare('SELECT id FROM contas_bancarias WHERE id = ? AND tenant_id = ? AND ativo = 1')
    .bind(data.conta_bancaria_id, tenant.tenantId).first()
  if (!conta) return c.json({ error: 'Conta bancária não encontrada.' }, 404)

  const conciliacaoId = crypto.randomUUID()
  const totalCreditos = data.itens.filter(i => i.tipo === 'credito').reduce((s, i) => s + i.valor, 0)
  const totalDebitos = data.itens.filter(i => i.tipo === 'debito').reduce((s, i) => s + i.valor, 0)
  const itensConc = data.itens.filter(i => i.acao === 'conciliar').length
  const itensIgn  = data.itens.filter(i => i.acao === 'ignorar').length
  const itensManu = data.itens.filter(i => i.acao === 'manual').length

  // Cria registro da sessão
  await c.env.DB_SHARED.prepare(`
    INSERT INTO conciliacao_bancaria
      (id, tenant_id, conta_bancaria_id, arquivo_nome, data_inicio, data_fim,
       saldo_inicial, saldo_final, total_creditos, total_debitos,
       total_itens, itens_conciliados, itens_ignorados, itens_manuais,
       status, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalizado', ?, ?)
  `).bind(
    conciliacaoId, tenant.tenantId, data.conta_bancaria_id,
    data.arquivo_nome ?? null, data.data_inicio ?? null, data.data_fim ?? null,
    data.saldo_inicial ?? null, data.saldo_final ?? null,
    totalCreditos, totalDebitos,
    data.itens.length, itensConc, itensIgn, itensManu,
    now, uid,
  ).run()

  // Processa cada item
  const stmts = []
  for (const item of data.itens) {
    const itemId = crypto.randomUUID()
    let movimentoId: string | null = null

    // Para itens manuais: cria movimento_bancario
    if (item.acao === 'manual') {
      movimentoId = crypto.randomUUID()
      stmts.push(c.env.DB_SHARED.prepare(`
        INSERT INTO movimentos_bancarios
          (id, tenant_id, conta_bancaria_id, tipo, valor, data, descricao, origem_tipo, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'conciliacao', ?, ?)
      `).bind(movimentoId, tenant.tenantId, data.conta_bancaria_id,
              item.tipo, item.valor, item.data, item.descricao ?? null, now, uid))
    }

    stmts.push(c.env.DB_SHARED.prepare(`
      INSERT INTO conciliacao_itens
        (id, tenant_id, conciliacao_id, ofx_fitid, tipo, valor, data, descricao,
         status, movimento_id, origem_tipo, origem_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId, tenant.tenantId, conciliacaoId,
      item.ofx_fitid, item.tipo, item.valor, item.data, item.descricao ?? null,
      item.acao === 'conciliar' ? 'conciliado' : item.acao === 'ignorar' ? 'ignorado' : 'manual',
      movimentoId,
      item.origem_tipo ?? null, item.origem_id ?? null,
      now,
    ))
  }

  await c.env.DB_SHARED.batch(stmts)

  return c.json({
    id: conciliacaoId,
    total_itens: data.itens.length,
    itens_conciliados: itensConc,
    itens_ignorados: itensIgn,
    itens_manuais: itensManu,
    message: 'Conciliação finalizada com sucesso.',
  }, 201)
})

// ─── Saldos consolidados (para dashboard) ─────────────────────────

app.get('/saldos', async (c) => {
  const tenant = c.get('tenant')

  const { results } = await c.env.DB_SHARED.prepare(`
    SELECT
      cb.id, cb.nome, cb.tipo, cb.banco_nome, cb.agencia, cb.conta,
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

  const totalDisponivel = (results as Array<{ saldo_atual: number }>)
    .filter(r => r.saldo_atual != null)
    .reduce((sum, r) => sum + (r.saldo_atual ?? 0), 0)

  return c.json({ contas: results, total_disponivel: totalDisponivel })
})

export default app
