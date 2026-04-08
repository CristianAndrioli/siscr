import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

// ─── Helpers ──────────────────────────────────────────────────────

function calcTotal(itens: { quantidade: number; valorUnitario: number; desconto: number }[]) {
  return itens.reduce((s, i) => s + (i.quantidade * i.valorUnitario - (i.desconto ?? 0)), 0)
}

// ─── Cotações ─────────────────────────────────────────────────────

app.get('/cotacoes', async (c) => {
  const tenant = c.get('tenant')
  const { status, busca } = c.req.query()

  let query = `
    SELECT co.id, co.numero, co.status, co.validade, co.valor_total, co.created_at,
           p.nome as cliente
    FROM cotacoes co
    LEFT JOIN pessoas p ON p.id = co.pessoa_id
    WHERE co.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]
  if (status) { query += ' AND co.status = ?'; params.push(status) }
  if (busca) { query += ' AND (p.nome LIKE ? OR co.numero LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }
  query += ' ORDER BY co.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ cotacoes: results })
})

app.get('/cotacoes/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const cotacao = await c.env.DB_SHARED.prepare(`
    SELECT co.*, p.nome as cliente, p.cpf_cnpj, p.email, p.telefone
    FROM cotacoes co
    LEFT JOIN pessoas p ON p.id = co.pessoa_id
    WHERE co.id = ? AND co.tenant_id = ?
  `).bind(id, tenant.tenantId).first()

  if (!cotacao) return c.json({ error: 'Cotação não encontrada.' }, 404)

  const { results: itens } = await c.env.DB_SHARED.prepare(`
    SELECT ci.*, pr.descricao as produto_nome, pr.codigo as produto_codigo,
           sv.descricao as servico_nome
    FROM cotacao_itens ci
    LEFT JOIN produtos pr ON pr.id = ci.produto_id
    LEFT JOIN servicos sv ON sv.id = ci.servico_id
    WHERE ci.cotacao_id = ?
  `).bind(id).all()

  return c.json({ cotacao: { ...cotacao, itens } })
})

const itemSchema = z.object({
  produtoId: z.string().uuid().optional(),
  servicoId: z.string().uuid().optional(),
  descricao: z.string().min(1),
  quantidade: z.number().positive(),
  valorUnitario: z.number().min(0),
  desconto: z.number().min(0).default(0),
  unidade: z.string().default('UN'),
})

const cotacaoSchema = z.object({
  pessoaId: z.string().uuid().optional(),
  validade: z.string().optional(),
  observacoes: z.string().optional(),
  desconto: z.number().min(0).default(0),
  status: z.enum(['rascunho', 'enviada', 'aprovada', 'recusada', 'expirada']).default('rascunho'),
  itens: z.array(itemSchema).default([]),
})

app.post('/cotacoes', zValidator('json', cotacaoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Gerar número sequencial simples
  const last = await c.env.DB_SHARED
    .prepare('SELECT numero FROM cotacoes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(tenant.tenantId).first<{ numero: string }>()
  const seq = last?.numero ? parseInt(last.numero.replace(/\D/g, '') || '0') + 1 : 1
  const numero = `COT-${String(seq).padStart(4, '0')}`

  const valorTotal = calcTotal(data.itens) - (data.desconto ?? 0)

  const stmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO cotacoes (id, tenant_id, numero, pessoa_id, validade, observacoes, desconto, valor_total, status, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, tenant.tenantId, numero, data.pessoaId ?? null, data.validade ?? null,
        data.observacoes ?? null, data.desconto, valorTotal, data.status, now, now, uid, uid),
  ]

  for (const item of data.itens) {
    const itemTotal = item.quantidade * item.valorUnitario - item.desconto
    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO cotacao_itens (id, cotacao_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, unidade, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
          item.descricao, item.quantidade, item.valorUnitario, item.desconto, itemTotal, item.unidade, now, now, uid, uid)
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ id, numero, message: 'Cotação criada.' }, 201)
})

app.put('/cotacoes/:id', zValidator('json', cotacaoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []

  if (data.itens !== undefined) {
    stmts.push(
      c.env.DB_SHARED.prepare('DELETE FROM cotacao_itens WHERE cotacao_id = ? AND tenant_id = ?')
        .bind(id, tenant.tenantId)
    )
    for (const item of data.itens) {
      const itemTotal = item.quantidade! * item.valorUnitario! - (item.desconto ?? 0)
      stmts.push(
        c.env.DB_SHARED.prepare(`
          INSERT INTO cotacao_itens (id, cotacao_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, unidade, created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
            item.descricao!, item.quantidade!, item.valorUnitario!, item.desconto ?? 0, itemTotal, item.unidade ?? 'UN', now, now, uid, uid)
      )
    }
  }

  const valorTotal = data.itens ? calcTotal(data.itens as typeof data.itens) - (data.desconto ?? 0) : undefined

  const fields: string[] = ['updated_at = ?', 'updated_by = ?']
  const vals: unknown[] = [now, uid]
  if (data.pessoaId !== undefined) { fields.push('pessoa_id = ?'); vals.push(data.pessoaId) }
  if (data.validade !== undefined) { fields.push('validade = ?'); vals.push(data.validade) }
  if (data.observacoes !== undefined) { fields.push('observacoes = ?'); vals.push(data.observacoes) }
  if (data.desconto !== undefined) { fields.push('desconto = ?'); vals.push(data.desconto) }
  if (valorTotal !== undefined) { fields.push('valor_total = ?'); vals.push(valorTotal) }
  if (data.status !== undefined) { fields.push('status = ?'); vals.push(data.status) }

  stmts.push(
    c.env.DB_SHARED.prepare(`UPDATE cotacoes SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
      .bind(...vals, id, tenant.tenantId)
  )

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: 'Cotação atualizada.' })
})

app.delete('/cotacoes/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED.prepare('DELETE FROM cotacoes WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Cotação removida.' })
})

// ─── Notas Fiscais ────────────────────────────────────────────────

app.get('/notas', async (c) => {
  const tenant = c.get('tenant')
  const { tipo, status, busca, pedidoId } = c.req.query()

  let query = `
    SELECT nf.id, nf.numero, nf.serie, nf.tipo, nf.status, nf.valor_total,
           nf.data_emissao, nf.chave_acesso, nf.created_at, nf.pedido_id,
           p.nome as destinatario
    FROM notas_fiscais nf
    LEFT JOIN pessoas p ON p.id = nf.destinatario_id
    WHERE nf.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]
  if (tipo) { query += ' AND nf.tipo = ?'; params.push(tipo) }
  if (status) { query += ' AND nf.status = ?'; params.push(status) }
  if (pedidoId) { query += ' AND nf.pedido_id = ?'; params.push(pedidoId) }
  if (busca) { query += ' AND (p.nome LIKE ? OR CAST(nf.numero AS TEXT) LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }
  query += ' ORDER BY nf.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ notas: results })
})

app.get('/notas/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const nota = await c.env.DB_SHARED.prepare(`
    SELECT nf.*, p.nome as destinatario, p.cpf_cnpj, p.email
    FROM notas_fiscais nf
    LEFT JOIN pessoas p ON p.id = nf.destinatario_id
    WHERE nf.id = ? AND nf.tenant_id = ?
  `).bind(id, tenant.tenantId).first()

  if (!nota) return c.json({ error: 'Nota fiscal não encontrada.' }, 404)

  const { results: itens } = await c.env.DB_SHARED.prepare(`
    SELECT ni.*, pr.codigo as produto_codigo
    FROM nota_fiscal_itens ni
    LEFT JOIN produtos pr ON pr.id = ni.produto_id
    WHERE ni.nota_fiscal_id = ?
  `).bind(id).all()

  return c.json({ nota: { ...nota, itens } })
})

const nfItemSchema = z.object({
  produtoId: z.string().uuid().optional(),
  servicoId: z.string().uuid().optional(),
  descricao: z.string().min(1),
  quantidade: z.number().positive(),
  valorUnitario: z.number().min(0),
  desconto: z.number().min(0).default(0),
  unidade: z.string().default('UN'),
  cfop: z.string().optional(),
  ncm: z.string().optional(),
})

const nfSchema = z.object({
  tipo: z.enum(['nfe', 'nfse']).default('nfe'),
  destinatarioId: z.string().uuid().optional(),
  /** Preenche empresa, filial e destinatário (se omitidos) a partir do pedido. */
  pedidoId: z.string().uuid().optional(),
  empresaId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
  naturezaOperacao: z.string().optional(),
  descricaoServico: z.string().optional(),
  aliquotaIss: z.number().min(0).max(100).optional(),
  codigoServico: z.string().optional(),
  observacoes: z.string().optional(),
  desconto: z.number().min(0).default(0),
  itens: z.array(nfItemSchema).default([]),
})

app.post('/notas', zValidator('json', nfSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  let empresaId: string | null = data.empresaId ?? null
  let filialId: string | null = data.filialId ?? null
  let pedidoId: string | null = data.pedidoId ?? null
  let destinatarioId: string | null = data.destinatarioId ?? null

  if (data.pedidoId) {
    const ped = await c.env.DB_SHARED
      .prepare(
        'SELECT empresa_id, filial_id, cliente_id FROM pedidos_venda WHERE id = ? AND tenant_id = ?',
      )
      .bind(data.pedidoId, tenant.tenantId)
      .first<{ empresa_id: string; filial_id: string; cliente_id: string }>()
    if (!ped) return c.json({ error: 'Pedido não encontrado.' }, 404)
    if (!empresaId) empresaId = ped.empresa_id
    if (!filialId) filialId = ped.filial_id
    if (!destinatarioId) destinatarioId = ped.cliente_id
  }

  // Número sequencial por tipo
  const last = await c.env.DB_SHARED
    .prepare('SELECT numero FROM notas_fiscais WHERE tenant_id = ? AND tipo = ? ORDER BY created_at DESC LIMIT 1')
    .bind(tenant.tenantId, data.tipo).first<{ numero: number }>()
  const numero = (last?.numero ?? 0) + 1

  const valorProdutos = calcTotal(data.itens)
  const valorTotal = valorProdutos - (data.desconto ?? 0)
  const valorIss = data.aliquotaIss ? valorTotal * (data.aliquotaIss / 100) : null

  const stmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO notas_fiscais
        (id, tenant_id, empresa_id, filial_id, pedido_id, tipo, numero, serie, destinatario_id, natureza_operacao,
         descricao_servico, aliquota_iss, valor_iss, codigo_servico,
         observacoes, valor_produtos, valor_desconto, valor_total, status, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, '1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?)
    `).bind(
      id,
      tenant.tenantId,
      empresaId,
      filialId,
      pedidoId,
      data.tipo,
      numero,
      destinatarioId,
      data.naturezaOperacao ?? null,
      data.descricaoServico ?? null,
      data.aliquotaIss ?? null,
      valorIss,
      data.codigoServico ?? null,
      data.observacoes ?? null,
      valorProdutos,
      data.desconto,
      valorTotal,
      now,
      now,
      uid,
      uid,
    ),
  ]

  for (const item of data.itens) {
    const itemTotal = item.quantidade * item.valorUnitario - (item.desconto ?? 0)
    stmts.push(
      c.env.DB_SHARED.prepare(`
        INSERT INTO nota_fiscal_itens
          (id, nota_fiscal_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, cfop, ncm, unidade, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
          item.descricao, item.quantidade, item.valorUnitario, item.desconto, itemTotal,
          item.cfop ?? null, item.ncm ?? null, item.unidade, now, now, uid, uid)
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ id, numero, message: 'Nota fiscal criada.' }, 201)
})

app.put('/notas/:id', zValidator('json', nfSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const nota = await c.env.DB_SHARED
    .prepare('SELECT status FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId).first<{ status: string }>()

  if (!nota) return c.json({ error: 'Nota não encontrada.' }, 404)
  if (nota.status === 'emitida') return c.json({ error: 'Não é possível editar uma nota já emitida.' }, 400)

  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []

  if (data.itens !== undefined) {
    stmts.push(
      c.env.DB_SHARED.prepare('DELETE FROM nota_fiscal_itens WHERE nota_fiscal_id = ? AND tenant_id = ?')
        .bind(id, tenant.tenantId)
    )
    for (const item of data.itens) {
      const itemTotal = item.quantidade! * item.valorUnitario! - (item.desconto ?? 0)
      stmts.push(
        c.env.DB_SHARED.prepare(`
          INSERT INTO nota_fiscal_itens
            (id, nota_fiscal_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total, cfop, ncm, unidade, created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
            item.descricao!, item.quantidade!, item.valorUnitario!, item.desconto ?? 0, itemTotal,
            item.cfop ?? null, item.ncm ?? null, item.unidade ?? 'UN', now, now, uid, uid)
      )
    }
  }

  const fields = ['updated_at = ?', 'updated_by = ?']
  const vals: unknown[] = [now, uid]
  if (data.pedidoId !== undefined) { fields.push('pedido_id = ?'); vals.push(data.pedidoId) }
  if (data.empresaId !== undefined) { fields.push('empresa_id = ?'); vals.push(data.empresaId) }
  if (data.filialId !== undefined) { fields.push('filial_id = ?'); vals.push(data.filialId) }
  if (data.destinatarioId !== undefined) { fields.push('destinatario_id = ?'); vals.push(data.destinatarioId) }
  if (data.naturezaOperacao !== undefined) { fields.push('natureza_operacao = ?'); vals.push(data.naturezaOperacao) }
  if (data.descricaoServico !== undefined) { fields.push('descricao_servico = ?'); vals.push(data.descricaoServico) }
  if (data.aliquotaIss !== undefined) { fields.push('aliquota_iss = ?'); vals.push(data.aliquotaIss) }
  if (data.observacoes !== undefined) { fields.push('observacoes = ?'); vals.push(data.observacoes) }
  if (data.desconto !== undefined) { fields.push('valor_desconto = ?'); vals.push(data.desconto) }

  stmts.push(
    c.env.DB_SHARED.prepare(`UPDATE notas_fiscais SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
      .bind(...vals, id, tenant.tenantId)
  )

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ message: 'Nota atualizada.' })
})

app.delete('/notas/:id', async (c) => {
  const tenant = c.get('tenant')
  const nota = await c.env.DB_SHARED
    .prepare('SELECT status FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).first<{ status: string }>()

  if (nota?.status === 'emitida') return c.json({ error: 'Não é possível excluir uma nota emitida. Cancele-a primeiro.' }, 400)

  await c.env.DB_SHARED.prepare('DELETE FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()

  return c.json({ message: 'Nota removida.' })
})

app.post('/notas/:id/cancelar', async (c) => {
  const tenant = c.get('tenant')
  const { motivo } = await c.req.json<{ motivo?: string }>()

  await c.env.DB_SHARED
    .prepare('UPDATE notas_fiscais SET status = ?, motivo_cancelamento = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
    .bind('cancelada', motivo ?? null, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Nota cancelada.' })
})

// ─── Faturar nota (rascunho → emitida + baixa de estoque) ────────
app.post('/notas/:id/faturar', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Buscar a nota com seus itens
  const nota = await c.env.DB_SHARED
    .prepare('SELECT id, tipo, status FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ id: string; tipo: string; status: string }>()

  if (!nota) return c.json({ error: 'Nota fiscal não encontrada.' }, 404)
  if (nota.status === 'emitida') return c.json({ error: 'Nota já foi faturada.' }, 400)
  if (nota.status === 'cancelada') return c.json({ error: 'Não é possível faturar uma nota cancelada.' }, 400)

  const { results: itens } = await c.env.DB_SHARED
    .prepare('SELECT produto_id, quantidade, descricao FROM nota_fiscal_itens WHERE nota_fiscal_id = ? AND produto_id IS NOT NULL')
    .bind(id)
    .all<{ produto_id: string; quantidade: number; descricao: string }>()

  // Montar batch: atualizar nota + movimentações de saída (apenas NF-e com produto_id)
  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []

  stmts.push(
    c.env.DB_SHARED
      .prepare('UPDATE notas_fiscais SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?')
      .bind('emitida', now, uid, id, tenant.tenantId)
  )

  // Baixa de estoque apenas para NF-e com produtos vinculados
  if (nota.tipo === 'nfe' && itens.length > 0) {
    for (const item of itens) {
      const movId = crypto.randomUUID()
      stmts.push(
        c.env.DB_SHARED
          .prepare(`
            INSERT INTO movimentacoes_estoque
              (id, tenant_id, empresa_id, tipo, produto_id, quantidade, motivo, referencia_id, created_at, updated_at, created_by, updated_by)
            SELECT ?, ?, empresa_id, 'saida', ?, ?, ?, ?, ?, ?, ?, ?
            FROM notas_fiscais WHERE id = ?
          `)
          .bind(
            movId, tenant.tenantId,
            item.produto_id, item.quantidade,
            `Faturamento NF-e — ${item.descricao}`,
            id,
            now, now, uid, uid,
            id,
          )
      )
    }
  }

  await c.env.DB_SHARED.batch(stmts)

  return c.json({ message: 'Nota faturada com sucesso.', itens_baixados: nota.tipo === 'nfe' ? itens.length : 0 })
})

// GET XML (mantido para futura integração)
app.get('/notas/:id/xml', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const nota = await c.env.DB_SHARED
    .prepare('SELECT xml_path, chave_acesso FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ xml_path: string; chave_acesso: string }>()

  if (!nota?.xml_path) return c.json({ error: 'XML não disponível.' }, 404)

  if (!c.env.R2_STORAGE) return c.json({ error: 'Armazenamento não configurado.' }, 503)
  const object = await c.env.R2_STORAGE.get(nota.xml_path)
  if (!object) return c.json({ error: 'Arquivo XML não encontrado.' }, 404)

  const xml = await object.text()
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${nota.chave_acesso}.xml"`,
    },
  })
})

export default app
