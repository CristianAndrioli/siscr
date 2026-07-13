/**
 * routes/relatorios.ts
 *
 * Módulo Relatórios — construtor dinâmico (ver handoff de redesign).
 * `POST /query` roda uma consulta ad-hoc sobre uma das 4 fontes
 * (financeiro/estoque/vendas/compras); `CRUD /` persiste configurações
 * salvas (não os resultados).
 *
 * Segurança: fonte/colunas/agrupamento vêm do client como CHAVES
 * lógicas — nunca como nome de coluna/tabela SQL. Cada fonte tem um
 * whitelist fixo (`FONTES`) que mapeia chave → expressão SQL. Qualquer
 * chave fora do whitelist é ignorada (nunca interpolada).
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

type ColSpec = { label: string; expr: string; type: 'text' | 'number' | 'date' }

type FonteSpec = {
  label: string
  from: string          // FROM ... JOIN ... (sem WHERE)
  dateExpr: string       // expressão de data usada para filtrar período
  valorExpr: string | null // expressão numérica para SUM() no agrupamento (null = sem total)
  columns: Record<string, ColSpec>
  groupable: string[]    // subconjunto de columns que pode ser usado em "agrupar por"
}

const FONTES: Record<string, FonteSpec> = {
  financeiro: {
    label: 'Financeiro',
    from: `FROM (
      SELECT 'receber' as tipo, cr.vencimento as vencimento, cr.descricao as descricao, cr.valor as valor, cr.status as status,
             p.nome as pessoa_nome, cr.tenant_id as tenant_id, cr.created_at as created_at
      FROM contas_receber cr LEFT JOIN pessoas p ON p.id = cr.pessoa_id
      UNION ALL
      SELECT 'pagar' as tipo, cp.vencimento as vencimento, cp.descricao as descricao, cp.valor as valor, cp.status as status,
             p.nome as pessoa_nome, cp.tenant_id as tenant_id, cp.created_at as created_at
      FROM contas_pagar cp LEFT JOIN pessoas p ON p.id = cp.pessoa_id
    ) f`,
    dateExpr: 'f.vencimento',
    valorExpr: 'f.valor',
    columns: {
      vencimento: { label: 'Vencimento', expr: 'f.vencimento', type: 'date' },
      descricao: { label: 'Descrição', expr: 'f.descricao', type: 'text' },
      pessoa_nome: { label: 'Cliente/Fornecedor', expr: 'f.pessoa_nome', type: 'text' },
      tipo: { label: 'Tipo', expr: 'f.tipo', type: 'text' },
      status: { label: 'Status', expr: 'f.status', type: 'text' },
      valor: { label: 'Valor', expr: 'f.valor', type: 'number' },
    },
    groupable: ['tipo', 'status'],
  },

  estoque: {
    label: 'Estoque',
    from: `FROM movimentacoes_estoque m JOIN produtos p ON p.id = m.produto_id`,
    dateExpr: 'm.created_at',
    valorExpr: null,
    columns: {
      created_at: { label: 'Data', expr: 'm.created_at', type: 'date' },
      produto_descricao: { label: 'Produto', expr: 'p.descricao', type: 'text' },
      tipo: { label: 'Tipo', expr: 'm.tipo', type: 'text' },
      quantidade: { label: 'Quantidade', expr: 'm.quantidade', type: 'number' },
      motivo: { label: 'Motivo', expr: 'm.motivo', type: 'text' },
    },
    groupable: ['tipo', 'produto_descricao'],
  },

  vendas: {
    label: 'Vendas',
    from: `FROM notas_fiscais n LEFT JOIN pessoas p ON p.id = n.destinatario_id`,
    dateExpr: 'n.created_at',
    valorExpr: 'n.valor_total',
    columns: {
      created_at: { label: 'Data', expr: 'n.created_at', type: 'date' },
      numero: { label: 'Número', expr: 'n.numero', type: 'text' },
      pessoa_nome: { label: 'Cliente', expr: 'p.nome', type: 'text' },
      status: { label: 'Status', expr: 'n.status', type: 'text' },
      valor_total: { label: 'Valor total', expr: 'n.valor_total', type: 'number' },
    },
    groupable: ['status'],
  },

  compras: {
    label: 'Compras',
    from: `FROM nf_entradas e`,
    dateExpr: "COALESCE(e.data_emissao, e.created_at)",
    valorExpr: 'e.valor_total',
    columns: {
      data_emissao: { label: 'Data', expr: 'e.data_emissao', type: 'date' },
      numero: { label: 'Número', expr: 'e.numero', type: 'text' },
      emitente_nome: { label: 'Fornecedor', expr: 'e.emitente_nome', type: 'text' },
      status: { label: 'Status', expr: 'e.status', type: 'text' },
      valor_total: { label: 'Valor total', expr: 'e.valor_total', type: 'number' },
    },
    groupable: ['status', 'emitente_nome'],
  },
}

const PERIODO_DIAS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }

const querySchema = z.object({
  fonte: z.enum(['financeiro', 'estoque', 'vendas', 'compras']),
  colunas: z.array(z.string()).min(1).max(10),
  periodo: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
  agrupamento: z.string().optional(),
})

app.post('/query', zValidator('json', querySchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const fonte = FONTES[body.fonte]

  // Whitelist estrita — descarta silenciosamente qualquer chave desconhecida.
  const colunas = body.colunas.filter((k) => k in fonte.columns)
  if (colunas.length === 0) return c.json({ error: 'Nenhuma coluna válida selecionada para esta fonte.' }, 400)

  const agrupamento = body.agrupamento && body.agrupamento !== 'nenhum' && fonte.groupable.includes(body.agrupamento)
    ? body.agrupamento
    : null

  const dias = PERIODO_DIAS[body.periodo]

  // A expressão de tenant_id varia por alias de cada fonte.
  const tenantWhere = body.fonte === 'financeiro' ? 'f.tenant_id = ?'
    : body.fonte === 'estoque' ? 'm.tenant_id = ?'
    : body.fonte === 'vendas' ? 'n.tenant_id = ?'
    : 'e.tenant_id = ?'

  const sqlWhere = `WHERE ${tenantWhere} AND ${fonte.dateExpr} >= date('now', '-${dias} days')`

  if (agrupamento) {
    const groupExpr = fonte.columns[agrupamento].expr
    const totalSelect = fonte.valorExpr ? `, SUM(${fonte.valorExpr}) as total` : ''
    const sql = `
      SELECT ${groupExpr} as grupo, COUNT(*) as registros${totalSelect}
      ${fonte.from} ${sqlWhere}
      GROUP BY ${groupExpr}
      ORDER BY registros DESC
      LIMIT 200
    `
    const { results } = await c.env.DB_SHARED.prepare(sql).bind(tenant.tenantId).all()
    return c.json({
      linhas: results ?? [],
      agrupado: true,
      meta: { fonte: body.fonte, periodo: body.periodo, colunas, agrupamento, registros: results?.length ?? 0 },
    })
  }

  const selectCols = colunas.map((k) => `${fonte.columns[k].expr} as ${k}`).join(', ')
  const sql = `SELECT ${selectCols} ${fonte.from} ${sqlWhere} ORDER BY ${fonte.dateExpr} DESC LIMIT 500`
  const { results } = await c.env.DB_SHARED.prepare(sql).bind(tenant.tenantId).all()

  let total: number | null = null
  if (fonte.valorExpr && colunas.some(k => fonte.columns[k].type === 'number')) {
    const totalRow = await c.env.DB_SHARED
      .prepare(`SELECT SUM(${fonte.valorExpr}) as total ${fonte.from} ${sqlWhere}`)
      .bind(tenant.tenantId)
      .first<{ total: number | null }>()
    total = totalRow?.total ?? 0
  }

  return c.json({
    linhas: results ?? [],
    agrupado: false,
    total,
    meta: { fonte: body.fonte, periodo: body.periodo, colunas, agrupamento: null, registros: results?.length ?? 0 },
  })
})

// ─── Fontes disponíveis (para o frontend montar os chips) ──────────

app.get('/fontes', (c) => {
  const out = Object.fromEntries(
    Object.entries(FONTES).map(([key, f]) => [key, {
      label: f.label,
      colunas: Object.fromEntries(Object.entries(f.columns).map(([k, v]) => [k, { label: v.label, type: v.type }])),
      groupable: f.groupable,
    }]),
  )
  return c.json(out)
})

// ─── Relatórios salvos (CRUD) ───────────────────────────────────────

const salvoSchema = z.object({
  nome: z.string().min(2).max(120),
  config: z.object({
    fonte: z.enum(['financeiro', 'estoque', 'vendas', 'compras']),
    colunas: z.array(z.string()),
    periodo: z.enum(['7d', '30d', '90d', '12m']),
    agrupamento: z.string().nullable().optional(),
    visualizacao: z.enum(['tabela', 'barras', 'linha', 'pizza']).default('tabela'),
  }),
  empresaId: z.string().uuid().optional(),
})

app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT * FROM relatorios_salvos WHERE tenant_id = ? ORDER BY nome')
    .bind(tenant.tenantId)
    .all()
  return c.json({
    relatorios: (results ?? []).map((r) => ({ ...r, config: JSON.parse(String((r as { config: string }).config)) })),
  })
})

app.post('/', zValidator('json', salvoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB_SHARED.prepare(`
    INSERT INTO relatorios_salvos (id, tenant_id, empresa_id, nome, config, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, tenant.tenantId, body.empresaId ?? null, body.nome, JSON.stringify(body.config), now, auditUserId(c)).run()

  return c.json({ id, message: 'Relatório salvo.' }, 201)
})

app.delete('/:id', async (c) => {
  const tenant = c.get('tenant')
  const r = await c.env.DB_SHARED
    .prepare('DELETE FROM relatorios_salvos WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  if (!r.meta.changes) return c.json({ error: 'Relatório não encontrado.' }, 404)
  return c.json({ message: 'Relatório removido.' })
})

export default app
