import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { prepareNfeEnvio } from '../lib/nfe/prepareNfeEnvio'
import { buildDanfePreviewHtml } from '../lib/nfe/danfePreviewHtml'
import { verificarAssinaturaNfeXml } from '../lib/nfe/verifyNfeSignature'
import {
  fetchBrasilApiNcmJson,
  fetchClassifNcmJson,
  runNcmSync,
} from '../lib/ncm/syncNcmCatalog'

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
  origem: z.coerce.number().int().min(0).max(8).optional(),
  icmsCst: z.string().optional(),
  icmsCsosn: z.string().optional(),
  icmsModalidadeBc: z.coerce.number().int().optional(),
  icmsBaseCalculo: z.number().optional(),
  icmsAliquota: z.number().optional(),
  icmsValor: z.number().optional(),
  icmsCreditoAliquota: z.number().optional(),
  icmsCreditoValor: z.number().optional(),
  pisCst: z.string().optional(),
  pisBaseCalculo: z.number().optional(),
  pisAliquota: z.number().optional(),
  pisValor: z.number().optional(),
  cofinsCst: z.string().optional(),
  cofinsBaseCalculo: z.number().optional(),
  cofinsAliquota: z.number().optional(),
  cofinsValor: z.number().optional(),
  ipiCst: z.string().optional(),
  ipiBaseCalculo: z.number().optional(),
  ipiAliquota: z.number().optional(),
  ipiValor: z.number().optional(),
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
  formaPagamento: z.string().max(2).optional(),
  modFrete: z.coerce.number().int().min(0).max(9).optional(),
  ambiente: z.coerce.number().int().min(1).max(2).optional(),
  modelo: z.coerce.number().int().optional(),
  serie: z.string().max(3).optional(),
  valorTroco: z.number().min(0).optional(),
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

  let serieNf = data.serie ?? '1'
  let ambienteNf = data.ambiente ?? 2
  if (empresaId) {
    const em = await c.env.DB_SHARED
      .prepare('SELECT nfe_serie, nfe_ambiente FROM empresas WHERE id = ? AND tenant_id = ?')
      .bind(empresaId, tenant.tenantId)
      .first<{ nfe_serie: string | null; nfe_ambiente: number | null }>()
    if (em?.nfe_serie) serieNf = em.nfe_serie
    if (em?.nfe_ambiente != null) ambienteNf = em.nfe_ambiente
  }

  // Número sequencial por tipo
  const last = await c.env.DB_SHARED
    .prepare('SELECT numero FROM notas_fiscais WHERE tenant_id = ? AND tipo = ? ORDER BY created_at DESC LIMIT 1')
    .bind(tenant.tenantId, data.tipo).first<{ numero: number }>()
  const numero = (last?.numero ?? 0) + 1

  const valorProdutos = calcTotal(data.itens)
  const valorTotal = valorProdutos - (data.desconto ?? 0)
  const valorIss = data.aliquotaIss ? valorTotal * (data.aliquotaIss / 100) : null
  const modeloNf = data.modelo ?? 55
  const modFreteNf = data.modFrete ?? 9
  const valorTrocoNf = data.valorTroco ?? 0

  const stmts = [
    c.env.DB_SHARED.prepare(`
      INSERT INTO notas_fiscais
        (id, tenant_id, empresa_id, filial_id, pedido_id, tipo, numero, serie, destinatario_id, natureza_operacao,
         descricao_servico, aliquota_iss, valor_iss, codigo_servico,
         observacoes, valor_produtos, valor_desconto, valor_total, status,
         ambiente, modelo, forma_pagamento, mod_frete, valor_troco,
         created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      tenant.tenantId,
      empresaId,
      filialId,
      pedidoId,
      data.tipo,
      numero,
      serieNf,
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
      ambienteNf,
      modeloNf,
      data.formaPagamento ?? null,
      modFreteNf,
      valorTrocoNf,
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
          (id, nota_fiscal_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total,
           cfop, ncm, unidade, origem,
           icms_cst, icms_csosn, icms_modalidade_bc, icms_base_calculo, icms_aliquota, icms_valor, icms_credito_aliquota, icms_credito_valor,
           pis_cst, pis_base_calculo, pis_aliquota, pis_valor,
           cofins_cst, cofins_base_calculo, cofins_aliquota, cofins_valor,
           ipi_cst, ipi_base_calculo, ipi_aliquota, ipi_valor,
           created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
        item.descricao, item.quantidade, item.valorUnitario, item.desconto, itemTotal,
        item.cfop ?? null, item.ncm ?? null, item.unidade, item.origem ?? 0,
        item.icmsCst ?? null, item.icmsCsosn ?? null, item.icmsModalidadeBc ?? null,
        item.icmsBaseCalculo ?? null, item.icmsAliquota ?? null, item.icmsValor ?? null,
        item.icmsCreditoAliquota ?? null, item.icmsCreditoValor ?? null,
        item.pisCst ?? null, item.pisBaseCalculo ?? null, item.pisAliquota ?? null, item.pisValor ?? null,
        item.cofinsCst ?? null, item.cofinsBaseCalculo ?? null, item.cofinsAliquota ?? null, item.cofinsValor ?? null,
        item.ipiCst ?? null, item.ipiBaseCalculo ?? null, item.ipiAliquota ?? null, item.ipiValor ?? null,
        now, now, uid, uid,
      ),
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
            (id, nota_fiscal_id, tenant_id, produto_id, servico_id, descricao, quantidade, valor_unitario, desconto, valor_total,
             cfop, ncm, unidade, origem,
             icms_cst, icms_csosn, icms_modalidade_bc, icms_base_calculo, icms_aliquota, icms_valor, icms_credito_aliquota, icms_credito_valor,
             pis_cst, pis_base_calculo, pis_aliquota, pis_valor,
             cofins_cst, cofins_base_calculo, cofins_aliquota, cofins_valor,
             ipi_cst, ipi_base_calculo, ipi_aliquota, ipi_valor,
             created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(), id, tenant.tenantId, item.produtoId ?? null, item.servicoId ?? null,
          item.descricao!, item.quantidade!, item.valorUnitario!, item.desconto ?? 0, itemTotal,
          item.cfop ?? null, item.ncm ?? null, item.unidade ?? 'UN', item.origem ?? 0,
          item.icmsCst ?? null, item.icmsCsosn ?? null, item.icmsModalidadeBc ?? null,
          item.icmsBaseCalculo ?? null, item.icmsAliquota ?? null, item.icmsValor ?? null,
          item.icmsCreditoAliquota ?? null, item.icmsCreditoValor ?? null,
          item.pisCst ?? null, item.pisBaseCalculo ?? null, item.pisAliquota ?? null, item.pisValor ?? null,
          item.cofinsCst ?? null, item.cofinsBaseCalculo ?? null, item.cofinsAliquota ?? null, item.cofinsValor ?? null,
          item.ipiCst ?? null, item.ipiBaseCalculo ?? null, item.ipiAliquota ?? null, item.ipiValor ?? null,
          now, now, uid, uid,
        ),
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
  if (data.formaPagamento !== undefined) { fields.push('forma_pagamento = ?'); vals.push(data.formaPagamento) }
  if (data.modFrete !== undefined) { fields.push('mod_frete = ?'); vals.push(data.modFrete) }
  if (data.ambiente !== undefined) { fields.push('ambiente = ?'); vals.push(data.ambiente) }
  if (data.modelo !== undefined) { fields.push('modelo = ?'); vals.push(data.modelo) }
  if (data.serie !== undefined) { fields.push('serie = ?'); vals.push(data.serie) }
  if (data.valorTroco !== undefined) { fields.push('valor_troco = ?'); vals.push(data.valorTroco) }

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

// ─── Faturar nota (rascunho → emitida + baixa de estoque + parcelas) ─────────
app.post('/notas/:id/faturar', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  // Condição de pagamento enviada pelo frontend
  type BodyType = { parcelas?: number; vencimento?: string; intervalo_dias?: number }
  const body: BodyType = await c.req.json<BodyType>().catch(() => ({}))

  // Buscar a nota com todos os dados necessários
  const nota = await c.env.DB_SHARED
    .prepare(`SELECT id, tipo, status, empresa_id, destinatario_id,
                     valor_total, natureza_operacao, descricao_servico, numero
              FROM notas_fiscais WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenant.tenantId)
    .first<{
      id: string; tipo: string; status: string; empresa_id: string | null
      destinatario_id: string | null; valor_total: number
      natureza_operacao: string | null; descricao_servico: string | null
      numero: number | null
    }>()

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

  // Gerar parcelas em Contas a Receber (se houver destinatário e valor)
  let parcelasCriadas = 0
  if (nota.destinatario_id && (nota.valor_total ?? 0) > 0) {
    const totalParcelas = Math.max(1, Math.min(body.parcelas ?? 1, 36))
    const intervaloDias = Math.max(1, body.intervalo_dias ?? 30)
    const primeiroVenc = body.vencimento
      ?? new Date(Date.now() + intervaloDias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const numeroFormatado = nota.numero ? String(nota.numero).padStart(6, '0') : 'S/N'
    const descricaoBase = nota.tipo === 'nfse'
      ? `NFS-e ${numeroFormatado} — ${nota.descricao_servico ?? 'Serviço prestado'}`
      : `NF-e ${numeroFormatado} — ${nota.natureza_operacao ?? 'Venda de mercadorias'}`

    const valorTotal = nota.valor_total ?? 0
    // distribui o resto da divisão na última parcela
    const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100
    const valorUltima = Math.round((valorTotal - valorParcela * (totalParcelas - 1)) * 100) / 100

    const [baseYear, baseMonth, baseDay] = primeiroVenc.split('-').map(Number)

    for (let p = 1; p <= totalParcelas; p++) {
      // calcular vencimento de cada parcela
      const daysOffset = (p - 1) * intervaloDias
      const vencDate = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay + daysOffset))
      const vencimento = vencDate.toISOString().slice(0, 10)
      const valor = p === totalParcelas ? valorUltima : valorParcela
      const descricao = totalParcelas > 1
        ? `${descricaoBase} (${p}/${totalParcelas})`
        : descricaoBase

      // nota_fiscal_id + parcela garante unicidade (INSERT OR IGNORE evita duplicatas)
      const crId = crypto.randomUUID()
      stmts.push(
        c.env.DB_SHARED.prepare(`
          INSERT OR IGNORE INTO contas_receber
            (id, tenant_id, empresa_id, pessoa_id, descricao, valor, vencimento,
             status, categoria, nota_fiscal_id, parcela, total_parcelas,
             created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', 'Faturamento', ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crId, tenant.tenantId, nota.empresa_id ?? null,
          nota.destinatario_id, descricao, valor, vencimento,
          id, p, totalParcelas,
          now, now, uid, uid,
        )
      )
    }
    parcelasCriadas = totalParcelas
  }

  await c.env.DB_SHARED.batch(stmts)

  return c.json({
    message: 'Nota faturada com sucesso.',
    itens_baixados: nota.tipo === 'nfe' ? itens.length : 0,
    conta_receber_criada: parcelasCriadas > 0,
    parcelas_criadas: parcelasCriadas,
  })
})

async function jsonPrepareNfeXml(c: Context<{ Bindings: Env }>) {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  if (!id) return c.json({ error: 'ID da nota inválido.' }, 400)
  const force = c.req.query('force') === '1'
  const devMode = c.env.NFE_DEV_MODE === '1'
  try {
    const r = await prepareNfeEnvio(c.env, tenant.tenantId, id, { devMode, force })
    return c.json({
      chaveAcesso: r.chaveAcesso,
      xmlPath: r.xmlPath,
      devMode: r.devMode,
      signed: r.signed,
      message: r.message,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao gerar XML.'
    return c.json({ error: msg }, 400)
  }
}

/**
 * Gera chave de acesso, monta XML NF-e 4.00, assina com A1 (se configurado) e grava no R2.
 * Fora de `NFE_DEV_MODE`, exige certificado A1 da empresa ou da filial da nota.
 * Não envia à SEFAZ nesta versão — próximo passo: client SOAP (nfeAutorizacao).
 *
 * Query: force=1 para regerar quando já existir chave/xml.
 * `NFE_DEV_MODE=1`: permite XML sem A1; com A1, assina normalmente.
 */
app.post('/notas/:id/preparar-xml', jsonPrepareNfeXml)

/** Alias até existir envio SOAP real à SEFAZ. */
app.post('/notas/:id/transmitir', jsonPrepareNfeXml)

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

/** JSON: valida digest + RSA da assinatura XML-DSig contra o XML armazenado. */
app.get('/notas/:id/verificacao-assinatura', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const nota = await c.env.DB_SHARED
    .prepare('SELECT xml_path, tipo FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ xml_path: string | null; tipo: string }>()

  if (!nota?.xml_path) return c.json({ error: 'XML não disponível. Gere o XML primeiro.' }, 404)
  if (nota.tipo !== 'nfe') return c.json({ error: 'Verificação disponível apenas para NF-e.' }, 400)

  if (!c.env.R2_STORAGE) return c.json({ error: 'Armazenamento não configurado.' }, 503)
  const object = await c.env.R2_STORAGE.get(nota.xml_path)
  if (!object) return c.json({ error: 'Arquivo XML não encontrado.' }, 404)

  const xml = await object.text()
  const r = await verificarAssinaturaNfeXml(xml)
  return c.json(r)
})

/** HTML imprimível — prévia estilo DANFE para testes (não é o leiaute oficial em PDF). */
app.get('/notas/:id/danfe-preview', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const nota = await c.env.DB_SHARED
    .prepare(
      `SELECT nf.*,
        p.nome as destinatario_nome, p.cpf_cnpj as destinatario_doc,
        p.logradouro as dest_logradouro, p.numero as dest_numero, p.bairro as dest_bairro,
        p.cidade as dest_cidade, p.uf as dest_uf, p.cep as dest_cep
       FROM notas_fiscais nf
       LEFT JOIN pessoas p ON p.id = nf.destinatario_id
       WHERE nf.id = ? AND nf.tenant_id = ?`,
    )
    .bind(id, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!nota) return c.json({ error: 'Nota não encontrada.' }, 404)
  if (String(nota.tipo) !== 'nfe') return c.json({ error: 'Prévia disponível apenas para NF-e.' }, 400)

  const chave = nota.chave_acesso == null ? '' : String(nota.chave_acesso)
  if (!chave) return c.json({ error: 'Gere o XML primeiro para obter a chave de acesso.' }, 400)

  const empresaId = nota.empresa_id == null ? '' : String(nota.empresa_id)
  if (!empresaId) return c.json({ error: 'Nota sem empresa.' }, 400)

  const empresa = await c.env.DB_SHARED
    .prepare('SELECT * FROM empresas WHERE id = ? AND tenant_id = ?')
    .bind(empresaId, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!empresa) return c.json({ error: 'Empresa não encontrada.' }, 404)

  const filialId = nota.filial_id == null ? '' : String(nota.filial_id)
  let filial: Record<string, unknown> | null = null
  if (filialId) {
    filial = await c.env.DB_SHARED
      .prepare('SELECT * FROM filiais WHERE id = ? AND tenant_id = ?')
      .bind(filialId, tenant.tenantId)
      .first<Record<string, unknown>>()
  }

  const { results: itensRows } = await c.env.DB_SHARED
    .prepare(
      `SELECT ni.*, pr.codigo as produto_codigo
       FROM nota_fiscal_itens ni
       LEFT JOIN produtos pr ON pr.id = ni.produto_id
       WHERE ni.nota_fiscal_id = ?`,
    )
    .bind(id)
    .all()

  const itensList = (itensRows ?? []) as Record<string, unknown>[]

  const str = (v: unknown) => (v == null ? '' : String(v))
  const num = (v: unknown, d = 0) => {
    if (v == null) return d
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }

  const emitente = {
    razaoSocial: str(empresa.razao_social) || 'Emitente',
    cnpj: str(empresa.cnpj),
    ie: str(empresa.inscricao_estadual),
    logradouro: filial ? str(filial.logradouro) || str(empresa.logradouro) : str(empresa.logradouro),
    numero: filial ? str(filial.numero) || str(empresa.numero) : str(empresa.numero),
    bairro: filial ? str(filial.bairro) || str(empresa.bairro) : str(empresa.bairro),
    cidade: filial ? str(filial.cidade) || str(empresa.cidade) : str(empresa.cidade),
    uf: filial ? str(filial.uf) || str(empresa.uf) : str(empresa.uf),
    cep: filial ? str(filial.cep) || str(empresa.cep) : str(empresa.cep),
  }

  const destNome = str(nota.destinatario_nome)
  const dest = destNome
    ? {
        nome: destNome,
        doc: str(nota.destinatario_doc),
        logradouro: str(nota.dest_logradouro),
        numero: str(nota.dest_numero),
        bairro: str(nota.dest_bairro),
        cidade: str(nota.dest_cidade),
        uf: str(nota.dest_uf),
        cep: str(nota.dest_cep),
      }
    : null

  const itens = itensList.map((ni) => ({
    descricao: str(ni.descricao) || 'Item',
    quantidade: num(ni.quantidade, 1),
    unidade: str(ni.unidade) || 'UN',
    valorUnitario: num(ni.valor_unitario, 0),
    valorTotal: num(ni.valor_total, 0),
    ncm: str(ni.ncm),
    cfop: str(ni.cfop),
  }))

  const html = buildDanfePreviewHtml({
    numero: String(num(nota.numero, 0)),
    serie: str(nota.serie) || '1',
    naturezaOperacao: str(nota.natureza_operacao) || '—',
    ambiente: String(num(nota.ambiente, 2)),
    chaveAcesso: chave,
    dataEmissao: str(nota.data_emissao) || null,
    emitente,
    destinatario: dest,
    itens,
    valorTotal: num(nota.valor_total, 0),
  })

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  })
})

// ─── Tabela NCM (catálogo global DB_SHARED; leitura para utilizadores autenticados) ─

app.get('/ncm/items', async (c) => {
  const db = c.env.DB_SHARED
  const qRaw = (c.req.query('q') || '').trim().slice(0, 120)
  const q = qRaw.replace(/[%_]/g, '')
  const full = c.req.query('full') === '1'
  const limitCap = full ? 120_000 : 200
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || (full ? limitCap : 50), 1), limitCap)
  const offset = full ? 0 : Math.max(Number(c.req.query('offset')) || 0, 0)

  const active = await db
    .prepare(`SELECT value FROM ncm_meta WHERE key = 'active_batch_id'`)
    .first<{ value: string }>()
  if (!active?.value) {
    return c.json({ items: [], total: 0 })
  }
  const batchId = active.value

  /** Exibição dd-MM-yyyy; ordenação continua a usar vigencia_inicio / vigencia_fim (ISO) no ORDER BY. */
  const dateBr = (col: string) =>
    `COALESCE(strftime('%d-%m-%Y', date(${col})), ${col})`

  let countSql = `SELECT COUNT(*) as c FROM ncm_items WHERE batch_id = ?`
  let listSql = `
    SELECT
      codigo_8,
      codigo_raw,
      descricao,
      vigencia_inicio,
      vigencia_fim,
      ${dateBr('vigencia_inicio')} AS vigencia_inicio_br,
      ${dateBr('vigencia_fim')} AS vigencia_fim_br
    FROM ncm_items WHERE batch_id = ?
  `
  const bindCount: unknown[] = [batchId]
  const bindList: unknown[] = [batchId]

  if (q) {
    const clause = ` AND (
      COALESCE(codigo_8, '') LIKE ? OR COALESCE(codigo_raw, '') LIKE ? OR descricao LIKE ?
    )`
    const p = `%${q}%`
    countSql += clause
    listSql += clause
    bindCount.push(p, p, p)
    bindList.push(p, p, p)
  }

  listSql += `
    ORDER BY COALESCE(codigo_8, codigo_raw) COLLATE NOCASE, vigencia_inicio DESC
  `
  if (full) {
    listSql += ` LIMIT ?`
    bindList.push(limit)
  } else {
    listSql += ` LIMIT ? OFFSET ?`
    bindList.push(limit, offset)
  }

  const countRow = await db.prepare(countSql).bind(...bindCount).first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)
  const { results } = await db.prepare(listSql).bind(...bindList).all<{
    codigo_8: string | null
    codigo_raw: string
    descricao: string
    vigencia_inicio: string
    vigencia_fim: string
    vigencia_inicio_br: string | null
    vigencia_fim_br: string | null
  }>()

  return c.json({
    total,
    items: (results ?? []).map((row) => ({
      codigo: row.codigo_8?.trim() || row.codigo_raw,
      descricao: row.descricao,
      vigenciaInicio: row.vigencia_inicio,
      vigenciaFim: row.vigencia_fim,
      vigenciaInicioBr: row.vigencia_inicio_br ?? row.vigencia_inicio,
      vigenciaFimBr: row.vigencia_fim_br ?? row.vigencia_fim,
    })),
  })
})

app.get('/ncm/status', async (c) => {
  const db = c.env.DB_SHARED
  const active = await db
    .prepare(`SELECT value FROM ncm_meta WHERE key = 'active_batch_id'`)
    .first<{ value: string }>()
  let itemCount = 0
  if (active?.value) {
    const r = await db
      .prepare(`SELECT COUNT(*) as c FROM ncm_items WHERE batch_id = ?`)
      .bind(active.value)
      .first<{ c: number }>()
    itemCount = Number(r?.c ?? 0)
  }
  const { results: recentSyncs } = await db
    .prepare(
      `SELECT id, source, status, message, row_count, content_sha256, payload_meta, started_at, finished_at
       FROM ncm_sync_runs ORDER BY started_at DESC LIMIT 8`,
    )
    .all()
  return c.json({
    activeBatchId: active?.value ?? null,
    itemCount,
    recentSyncs: recentSyncs ?? [],
  })
})

app.post('/ncm/sync/classif', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem atualizar a tabela NCM.' }, 403)
  }
  const force = c.req.query('force') === '1'
  const res = await fetchClassifNcmJson()
  if (!res.ok) {
    return c.json(
      {
        error: `Download do Classif/Siscomex falhou (HTTP ${res.status}). Use a atualização pela Brasil API ou tente mais tarde.`,
      },
      502,
    )
  }
  const text = await res.text()
  const out = await runNcmSync(c.env.DB_SHARED, 'classif', text, { force })
  if (!out.ok) return c.json({ error: out.message }, 400)
  return c.json(out)
})

app.post('/ncm/sync/brasilapi', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem atualizar a tabela NCM.' }, 403)
  }
  const force = c.req.query('force') === '1'
  const res = await fetchBrasilApiNcmJson()
  if (!res.ok) {
    return c.json({ error: `Download da Brasil API falhou (HTTP ${res.status}).` }, 502)
  }
  const text = await res.text()
  const out = await runNcmSync(c.env.DB_SHARED, 'brasilapi', text, { force })
  if (!out.ok) return c.json({ error: out.message }, 400)
  return c.json(out)
})

export default app
