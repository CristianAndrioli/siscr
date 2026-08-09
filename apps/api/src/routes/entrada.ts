import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'
import {
  assertImportacaoEntradaPermitida,
  assertPreviewDestinatarioPermitido,
  cnpjDestinatarioParaGravacao,
  classificarNfeEntradaKind,
  detectarFamiliaXmlFiscal,
  erroSeFamiliaNaoSuportadaEntrada,
} from '../lib/fiscal-import'
import type { NfeEntradaItem, NfeEntradaParsed } from '../lib/nfe/parseNfeEntradaXml'
import { normalizarCnpj, parseNfeEntradaXml } from '../lib/nfe/parseNfeEntradaXml'
import type { PedidoCompraComItens } from '../lib/compras/pedidoCompraMatch'
import {
  STATUS_PEDIDO_ABERTO,
  apurarDivergencias,
  carregarPedidoComItens,
  casarItens,
  numeroPedidoDoXml,
  sugerirPedidoParaNota,
} from '../lib/compras/pedidoCompraMatch'
import { verificarAssinaturaNfeXml } from '../lib/nfe/verifyNfeSignature'
import { nextCodigo } from '../lib/nextCodigo'

const app = new Hono<{ Bindings: Env }>()

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Padrão comum: casar SKU/código do fornecedor (`cProd`) ou EAN com o cadastro. */
async function sugerirProdutoParaItem(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  item: NfeEntradaItem,
): Promise<{ produtoId: string | null; motivo: 'sku' | 'codigo' | 'ean' | 'none'; rotulo?: string }> {
  const cProd = item.cProd?.trim()
  const ean = onlyDigits(item.cEAN || '')

  if (cProd) {
    const r1 = await db
      .prepare(
        `SELECT id, descricao FROM produtos
         WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL) AND sku = ?
         LIMIT 1`,
      )
      .bind(tenantId, empresaId, cProd)
      .first<{ id: string; descricao: string }>()
    if (r1) return { produtoId: r1.id, motivo: 'sku', rotulo: r1.descricao }

    const r2 = await db
      .prepare(
        `SELECT id, descricao FROM produtos
         WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL) AND codigo = ?
         LIMIT 1`,
      )
      .bind(tenantId, empresaId, cProd)
      .first<{ id: string; descricao: string }>()
    if (r2) return { produtoId: r2.id, motivo: 'codigo', rotulo: r2.descricao }
  }

  if (ean.length >= 8) {
    const r3 = await db
      .prepare(`SELECT id, descricao FROM produtos WHERE tenant_id = ? AND sku = ? LIMIT 1`)
      .bind(tenantId, ean)
      .first<{ id: string; descricao: string }>()
    if (r3) return { produtoId: r3.id, motivo: 'ean', rotulo: r3.descricao }
  }

  return { produtoId: null, motivo: 'none' }
}

async function criarProdutoDoItem(
  env: Env,
  tenantId: string,
  empresaId: string,
  item: NfeEntradaItem,
  uid: string | null,
): Promise<string> {
  const db = env.DB_SHARED
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const codigo = await nextCodigo(db, 'produtos', tenantId)
  const descricao = (item.descricao || 'Produto importado NF-e').slice(0, 500)
  const unidade = (item.unidade || 'UN').slice(0, 6)
  const preco =
    item.valorUnitario > 0
      ? item.valorUnitario
      : item.quantidade > 0
        ? item.valorTotal / item.quantidade
        : 0
  let sku: string | null = item.cProd?.trim().slice(0, 60) || null
  if (sku) {
    const clash = await db
      .prepare(`SELECT id FROM produtos WHERE tenant_id = ? AND sku = ?`)
      .bind(tenantId, sku)
      .first()
    if (clash) sku = null
  }
  const ncm = item.ncm ? onlyDigits(item.ncm).slice(0, 8) : null

  await db
    .prepare(
      `INSERT INTO produtos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
        origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, '07', '07', 1, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      empresaId,
      codigo,
      sku,
      descricao,
      unidade,
      preco,
      preco,
      ncm || null,
      now,
      now,
      uid ?? null,
      uid ?? null,
    )
    .run()
  return id
}

async function findFornecedorPorCnpj(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  cnpj: string,
): Promise<string | null> {
  const c = normalizarCnpj(cnpj)
  const row = await db
    .prepare(
      `SELECT id FROM pessoas
       WHERE tenant_id = ? AND empresa_id = ? AND tipo_cadastro = 'fornecedor'
         AND replace(replace(replace(replace(cpf_cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
    )
    .bind(tenantId, empresaId, c)
    .first<{ id: string }>()
  return row?.id ?? null
}

async function garantirFornecedorDoEmitente(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  filialId: string | null,
  parsed: NfeEntradaParsed,
  uid: string | null,
): Promise<{ id: string; criado: boolean }> {
  const existente = await findFornecedorPorCnpj(db, tenantId, empresaId, parsed.emitenteCnpj)
  if (existente) return { id: existente, criado: false }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const nome = (parsed.emitenteNome || `Fornecedor ${parsed.emitenteCnpj}`).slice(0, 500)
  const doc = normalizarCnpj(parsed.emitenteCnpj)

  await db
    .prepare(
      `INSERT INTO pessoas (id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone,
         cep, logradouro, numero, complemento, bairro, cidade, uf,
         inscricao_estadual, ind_ie_dest, codigo_municipio, codigo_pais,
         ativo, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, 'PJ', 'fornecedor', ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, '9', ?, '1058', 1, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      empresaId,
      filialId,
      nome,
      doc,
      parsed.emitTelefone ?? null,
      parsed.emitCep ?? null,
      parsed.emitLogradouro ?? null,
      parsed.emitNumero ?? null,
      parsed.emitBairro ?? null,
      parsed.emitCidade ?? null,
      parsed.emitUf ?? null,
      parsed.emitIe ?? null,
      parsed.emitCodigoMunicipio ?? null,
      now,
      now,
      uid,
      uid,
    )
    .run()

  return { id, criado: true }
}

type DupParcela = { numero?: string; vencimento: string; valor: number }

function duplicatasParaCp(ne: {
  cobranca_json: string | null
  data_emissao: string | null
  valor_total: number
}): DupParcela[] {
  let duplicatas: DupParcela[] = []
  try {
    duplicatas = JSON.parse(ne.cobranca_json || '[]') as DupParcela[]
  } catch {
    duplicatas = []
  }
  if (!duplicatas.length) {
    const venc = ne.data_emissao?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    duplicatas = [{ vencimento: venc, valor: Number(ne.valor_total) || 0 }]
  }
  return duplicatas
}

function appendStmtContasPagarNfEntrada(
  db: D1Database,
  stmts: ReturnType<D1Database['prepare']>[],
  idsCriados: string[],
  tenantId: string,
  uid: string | null,
  now: string,
  ne: {
    id: string
    empresa_id: string
    filial_id: string | null
    fornecedor_id: string | null
    cobranca_json: string | null
    data_emissao: string | null
    valor_total: number
    numero: number | null
    serie: string | null
    emitente_nome: string | null
    emitente_cnpj: string
    chave_acesso: string
  },
  categoria: string,
): void {
  if (!ne.fornecedor_id) return
  if ((Number(ne.valor_total) || 0) <= 0) return

  const duplicatas = duplicatasParaCp(ne)
  const nrDoc = `NFe ${ne.numero}/${ne.serie || '1'}`
  const descBase = `NF-e entrada ${ne.emitente_nome || ne.emitente_cnpj} — chave ${ne.chave_acesso}`

  for (let i = 0; i < duplicatas.length; i++) {
    const dup = duplicatas[i]!
    const cid = crypto.randomUUID()
    idsCriados.push(cid)
    stmts.push(
      db
        .prepare(
          `INSERT INTO contas_pagar
          (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status,
           categoria, observacoes, nr_documento, especie, data_emissao, data_lancamento, moeda, nf_entrada_id,
           created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, 'DM', ?, ?, 'BRL', ?, ?, ?, ?, ?)`,
        )
        .bind(
          cid,
          tenantId,
          ne.empresa_id,
          ne.filial_id,
          ne.fornecedor_id,
          duplicatas.length > 1 ? `${descBase} — parcela ${i + 1}` : descBase,
          dup.valor,
          dup.vencimento,
          categoria,
          `Gerado automaticamente a partir da NF-e de entrada.`,
          nrDoc,
          ne.data_emissao?.slice(0, 10) || null,
          now.slice(0, 10),
          ne.id,
          now,
          now,
          uid,
          uid,
        ),
    )
  }
}

function appendStmtEntradaEstoquePorItens(
  db: D1Database,
  stmts: ReturnType<D1Database['prepare']>[],
  tenantId: string,
  nfEntradaId: string,
  itensOut: Record<string, unknown>[],
  usuarioId: string | null,
  uid: string | null,
  now: string,
): void {
  for (const row of itensOut) {
    const produtoId = typeof row.produto_id === 'string' ? row.produto_id : ''
    const qtd = Number(row.quantidade) || 0
    if (!produtoId || qtd <= 0) continue

    const movId = crypto.randomUUID()
    const desc = String(row.descricao ?? 'Item').slice(0, 120)
    stmts.push(
      db
        .prepare(
          `INSERT INTO movimentacoes_estoque
        (id, tenant_id, produto_id, tipo, quantidade, location, motivo, referencia_id, usuario_id, created_at, created_by, updated_by, updated_at)
       VALUES (?, ?, ?, 'entrada', ?, 'GERAL', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          movId,
          tenantId,
          produtoId,
          qtd,
          `NF-e entrada — ${desc}`,
          nfEntradaId,
          usuarioId,
          now,
          uid,
          uid,
          now,
        ),
    )

    stmts.push(
      db
        .prepare(
          `INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
       VALUES (?, ?, ?, 'GERAL', ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
         quantidade = quantidade + ?,
         updated_at = ?,
         updated_by = ?`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          produtoId,
          qtd,
          now,
          now,
          uid,
          uid,
          qtd,
          now,
          uid,
        ),
    )
  }
}

/**
 * Registra o recebimento do pedido de compra a partir da NF-e de entrada.
 *
 * Faz o que o recebimento manual faz — baixa o saldo, movimenta estoque e
 * recalcula o status do pedido — mas guardando de qual nota veio, para que o
 * pedido e o documento fiscal fiquem rastreáveis um a partir do outro.
 * Retorna o novo status do pedido.
 */
function appendStmtRecebimentoDaNfEntrada(
  db: D1Database,
  stmts: ReturnType<D1Database['prepare']>[],
  args: {
    tenantId: string
    recebimentoId: string
    nfEntradaId: string
    pedido: PedidoCompraComItens
    itensOut: Record<string, unknown>[]
    itemPedidoPorIndice: Map<number, string>
    usuarioMov: string | null
    uid: string | null
    now: string
    numeroNota: number
  },
): string {
  const { tenantId, recebimentoId, nfEntradaId, pedido, itensOut, itemPedidoPorIndice, usuarioMov, uid, now } = args

  stmts.push(
    db
      .prepare(
        `INSERT INTO recebimentos_compra
        (id, tenant_id, pedido_id, location, observacoes, created_at, created_by, nf_entrada_id)
       VALUES (?, ?, ?, 'GERAL', ?, ?, ?, ?)`,
      )
      .bind(
        recebimentoId,
        tenantId,
        pedido.id,
        `Recebimento gerado pela NF-e de entrada nº ${args.numeroNota}.`,
        now,
        uid,
        nfEntradaId,
      ),
  )

  const recebidoAgoraPorItem = new Map<string, number>()

  for (const [indice, itemPedidoId] of itemPedidoPorIndice) {
    const row = itensOut[indice]
    if (!row) continue
    const produtoId = typeof row.produto_id === 'string' ? row.produto_id : ''
    const qtd = Number(row.quantidade) || 0
    if (!produtoId || qtd <= 0) continue

    recebidoAgoraPorItem.set(itemPedidoId, (recebidoAgoraPorItem.get(itemPedidoId) ?? 0) + qtd)

    stmts.push(
      db
        .prepare(
          `INSERT INTO recebimento_itens (id, tenant_id, recebimento_id, item_pedido_id, quantidade, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), tenantId, recebimentoId, itemPedidoId, qtd, now),
    )

    stmts.push(
      db
        .prepare(
          `UPDATE itens_pedido_compra SET quantidade_recebida = quantidade_recebida + ?, updated_at = ?, updated_by = ?
         WHERE id = ? AND tenant_id = ?`,
        )
        .bind(qtd, now, uid, itemPedidoId, tenantId),
    )

    const desc = String(row.descricao ?? 'Item').slice(0, 120)
    stmts.push(
      db
        .prepare(
          `INSERT INTO movimentacoes_estoque
          (id, tenant_id, produto_id, tipo, quantidade, location, motivo, referencia_id, usuario_id, created_at, created_by, updated_by, updated_at)
         VALUES (?, ?, ?, 'entrada', ?, 'GERAL', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          tenantId,
          produtoId,
          qtd,
          `Recebimento do pedido ${pedido.numero} via NF-e — ${desc}`,
          nfEntradaId,
          usuarioMov,
          now,
          uid,
          uid,
          now,
        ),
    )

    stmts.push(
      db
        .prepare(
          `INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
         VALUES (?, ?, ?, 'GERAL', ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
           quantidade = quantidade + ?,
           updated_at = ?,
           updated_by = ?`,
        )
        .bind(crypto.randomUUID(), tenantId, produtoId, qtd, now, now, uid, uid, qtd, now, uid),
    )
  }

  const tudoRecebido = pedido.itens.every((item) => {
    const total = item.quantidade_recebida + (recebidoAgoraPorItem.get(item.id) ?? 0)
    return total >= item.quantidade - 0.01
  })
  const novoStatus = tudoRecebido ? 'recebido' : 'recebido_parcial'

  stmts.push(
    db
      .prepare(`UPDATE pedidos_compra SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
      .bind(novoStatus, now, uid, pedido.id, tenantId),
  )

  return novoStatus
}

// GET /nf-entradas
app.get('/nf-entradas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = `FROM nf_entradas n
    LEFT JOIN pessoas p ON p.id = n.fornecedor_id
    WHERE n.tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]
  if (empresaId) {
    where += ' AND n.empresa_id = ?'
    params.push(empresaId)
  }
  if (filialId) {
    where += ' AND n.filial_id = ?'
    params.push(filialId)
  }

  const countRow = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c ${where}`)
    .bind(...params)
    .first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)

  const { results } = await c.env.DB_SHARED
    .prepare(
      `SELECT n.id, n.chave_acesso, n.emitente_cnpj, n.emitente_nome, n.data_emissao,
              n.numero, n.serie, n.valor_total, n.status, n.fornecedor_id, n.origem,
              n.empresa_id, n.filial_id, n.pedido_compra_id,
              n.created_at, p.nome as fornecedor_nome
       ${where}
       ORDER BY n.data_emissao DESC, n.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all()

  return c.json({ entradas: results, total, page, limit })
})

const uuidOpcionalEntrada = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().uuid().optional(),
)

const filialOpcionalEntrada = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid().nullish(),
)

const itemManualSchema = z.object({
  produtoId: z.string().uuid(),
  descricao: z.string().min(1).max(500),
  quantidade: z.number().positive(),
  valorUnitario: z.number().min(0),
  desconto: z.number().min(0).default(0),
  unidade: z.string().max(6).default('UN'),
  ncm: z.string().optional(),
  cfop: z.string().optional(),
  itemPedidoId: z.string().uuid().nullable().optional(),
})

const cobrancaManualSchema = z.object({
  numero: z.string().optional(),
  vencimento: z.string().min(8),
  valor: z.number().positive(),
})

/**
 * Lançamento manual de nota de compra — espelho do confirmar via XML,
 * sem R2/assinatura. Relacionamentos: empresa (obrig.), filial (opcional =
 * matriz), fornecedor, itens→produtos, pedido de compra opcional.
 */
const manualCreateSchema = z.object({
  empresaId: z.string().uuid(),
  filialId: filialOpcionalEntrada,
  fornecedorId: z.string().uuid(),
  numero: z.number().int().positive(),
  serie: z.string().min(1).max(10).default('1'),
  dataEmissao: z.string().min(8),
  naturezaOperacao: z.string().max(120).optional(),
  desconto: z.number().min(0).default(0),
  itens: z.array(itemManualSchema).min(1),
  cobranca: z.array(cobrancaManualSchema).optional(),
  pedidoCompraId: uuidOpcionalEntrada,
  gerarEstoque: z.boolean().default(true),
  gerarContasPagar: z.boolean().default(true),
})

app.post('/nf-entradas', zValidator('json', manualCreateSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const uid = auditUserId(c)
  const usuarioMov = (c.get('user') as { userId?: string } | undefined)?.userId ?? null
  const db = c.env.DB_SHARED

  const empresa = await db
    .prepare(`SELECT id, cnpj, razao_social FROM empresas WHERE id = ? AND tenant_id = ?`)
    .bind(data.empresaId, tenant.tenantId)
    .first<{ id: string; cnpj: string | null; razao_social: string }>()
  if (!empresa) return c.json({ error: 'Empresa não encontrada.' }, 400)
  const destCnpj = onlyDigits(empresa.cnpj || '')
  if (destCnpj.length !== 14) {
    return c.json({ error: 'Cadastre o CNPJ da empresa antes de lançar nota de entrada.' }, 400)
  }

  if (data.filialId) {
    const fil = await db
      .prepare(`SELECT id FROM filiais WHERE id = ? AND empresa_id = ? AND tenant_id = ?`)
      .bind(data.filialId, data.empresaId, tenant.tenantId)
      .first()
    if (!fil) return c.json({ error: 'Filial não pertence à empresa selecionada.' }, 400)
  }

  const fornecedor = await db
    .prepare(
      `SELECT id, nome, cpf_cnpj FROM pessoas
       WHERE id = ? AND tenant_id = ? AND tipo_cadastro = 'fornecedor'`,
    )
    .bind(data.fornecedorId, tenant.tenantId)
    .first<{ id: string; nome: string; cpf_cnpj: string | null }>()
  if (!fornecedor) return c.json({ error: 'Fornecedor não encontrado.' }, 400)
  const emitCnpj = onlyDigits(fornecedor.cpf_cnpj || '')
  if (emitCnpj.length < 11) {
    return c.json({ error: 'Fornecedor sem CPF/CNPJ válido.' }, 400)
  }

  // Duplicidade documental (mesmo emitente + número + série na empresa).
  const dup = await db
    .prepare(
      `SELECT id FROM nf_entradas
       WHERE tenant_id = ? AND empresa_id = ? AND emitente_cnpj = ?
         AND numero = ? AND serie = ?
       LIMIT 1`,
    )
    .bind(tenant.tenantId, data.empresaId, emitCnpj, data.numero, data.serie || '1')
    .first<{ id: string }>()
  if (dup) {
    return c.json({ error: 'Já existe nota de entrada com este número/série para o fornecedor.', id: dup.id }, 409)
  }

  const itensOut: Record<string, unknown>[] = []
  let valorProdutos = 0
  for (const it of data.itens) {
    const prod = await db
      .prepare(`SELECT id, descricao, unidade, ncm FROM produtos WHERE id = ? AND tenant_id = ?`)
      .bind(it.produtoId, tenant.tenantId)
      .first<{ id: string; descricao: string; unidade: string | null; ncm: string | null }>()
    if (!prod) return c.json({ error: `Produto ${it.produtoId} não encontrado.` }, 400)
    const valorTotal = it.quantidade * it.valorUnitario - (it.desconto ?? 0)
    if (valorTotal < 0) return c.json({ error: `Item “${it.descricao}”: desconto maior que o total.` }, 400)
    valorProdutos += valorTotal
    itensOut.push({
      descricao: it.descricao || prod.descricao,
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      desconto: it.desconto ?? 0,
      valorTotal,
      unidade: it.unidade || prod.unidade || 'UN',
      ncm: it.ncm || prod.ncm || undefined,
      cfop: it.cfop || undefined,
      produto_id: it.produtoId,
      criado_no_import: false,
      item_pedido_id: it.itemPedidoId ?? null,
    })
  }
  const valorTotalNota = Math.max(valorProdutos - (data.desconto ?? 0), 0)

  let pedido = null as Awaited<ReturnType<typeof carregarPedidoComItens>>
  const itemPedidoPorIndice = new Map<number, string>()
  if (data.pedidoCompraId) {
    pedido = await carregarPedidoComItens(db, tenant.tenantId, data.pedidoCompraId)
    if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)
    if (pedido.fornecedor_id !== data.fornecedorId) {
      return c.json({ error: `O pedido ${pedido.numero} é de outro fornecedor.` }, 400)
    }
    if (!STATUS_PEDIDO_ABERTO.includes(pedido.status as (typeof STATUS_PEDIDO_ABERTO)[number])) {
      return c.json({ error: `O pedido ${pedido.numero} não pode receber mercadoria.` }, 400)
    }
    const porId = new Map(pedido.itens.map((i) => [i.id, i]))
    const usados = new Set<string>()
    for (let indice = 0; indice < data.itens.length; indice++) {
      const it = data.itens[indice]!
      if (!it.itemPedidoId) continue
      const alvo = porId.get(it.itemPedidoId)
      if (!alvo) return c.json({ error: `Item ${indice + 1}: não pertence ao pedido.` }, 400)
      if (usados.has(alvo.id)) return c.json({ error: `Item ${indice + 1}: item do pedido repetido.` }, 400)
      if (it.quantidade > alvo.saldo + 0.01) {
        return c.json(
          { error: `Item ${indice + 1}: quantidade acima do saldo do pedido (${alvo.saldo}).` },
          400,
        )
      }
      usados.add(alvo.id)
      itemPedidoPorIndice.set(indice, alvo.id)
      itensOut[indice]!.item_pedido_id = alvo.id
    }
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const chaveManual = `MANUAL-${id.replace(/-/g, '')}`
  const xmlPath = `manual/${id}`
  const duplicatas =
    data.cobranca && data.cobranca.length > 0
      ? data.cobranca
      : [{ vencimento: data.dataEmissao.slice(0, 10), valor: valorTotalNota }]

  const neRow = {
    id,
    empresa_id: data.empresaId,
    filial_id: data.filialId ?? null,
    fornecedor_id: data.fornecedorId,
    cobranca_json: JSON.stringify(duplicatas),
    data_emissao: data.dataEmissao.slice(0, 10),
    valor_total: valorTotalNota,
    numero: data.numero,
    serie: data.serie || '1',
    emitente_nome: fornecedor.nome,
    emitente_cnpj: emitCnpj,
    chave_acesso: chaveManual,
  }

  const stmts: ReturnType<typeof db.prepare>[] = []
  const contasPagarCriadas: string[] = []

  stmts.push(
    db
      .prepare(
        `INSERT INTO nf_entradas
        (id, tenant_id, empresa_id, filial_id, chave_acesso, xml_path, emitente_cnpj, emitente_nome,
         destinatario_cnpj, data_emissao, numero, serie, natureza_operacao, valor_total, valor_produtos,
         fornecedor_id, pedido_compra_id, itens_json, cobranca_json, assinatura_valida, status, origem,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'lancada', 'manual', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        tenant.tenantId,
        data.empresaId,
        data.filialId ?? null,
        chaveManual,
        xmlPath,
        emitCnpj,
        fornecedor.nome,
        destCnpj,
        data.dataEmissao.slice(0, 10),
        data.numero,
        data.serie || '1',
        data.naturezaOperacao || 'Compra de mercadorias',
        valorTotalNota,
        valorProdutos,
        data.fornecedorId,
        pedido ? pedido.id : null,
        JSON.stringify(itensOut),
        JSON.stringify(duplicatas),
        now,
        now,
        uid,
        uid,
      ),
  )

  if (data.gerarEstoque !== false) {
    appendStmtEntradaEstoquePorItens(
      db,
      stmts,
      tenant.tenantId,
      id,
      itensOut.filter((_, i) => !itemPedidoPorIndice.has(i)),
      usuarioMov,
      uid,
      now,
    )
  }

  let recebimentoId: string | null = null
  let statusPedido: string | null = null
  if (pedido && itemPedidoPorIndice.size > 0 && data.gerarEstoque !== false) {
    recebimentoId = crypto.randomUUID()
    statusPedido = appendStmtRecebimentoDaNfEntrada(db, stmts, {
      tenantId: tenant.tenantId,
      recebimentoId,
      nfEntradaId: id,
      pedido,
      itensOut,
      itemPedidoPorIndice,
      usuarioMov,
      uid,
      now,
      numeroNota: data.numero,
    })
  }

  if (data.gerarContasPagar !== false) {
    appendStmtContasPagarNfEntrada(
      db,
      stmts,
      contasPagarCriadas,
      tenant.tenantId,
      uid,
      now,
      neRow,
      'Fornecedores',
    )
  }

  try {
    await db.batch(stmts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Item ')) return c.json({ error: msg }, 400)
    throw e
  }

  return c.json(
    {
      id,
      message: 'Nota de entrada lançada manualmente.',
      origem: 'manual',
      status: 'lancada',
      pedido_compra_id: pedido?.id ?? null,
      pedido_compra_status: statusPedido,
      recebimento_id: recebimentoId,
      contas_pagar_criadas: contasPagarCriadas,
    },
    201,
  )
})

// POST /nf-entradas/preview-xml — análise sem gravar (assistente)
app.post('/nf-entradas/preview-xml', async (c) => {
  const tenant = c.get('tenant')
  let body: Record<string, unknown>
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Envie multipart com file e empresaId.' }, 400)
  }
  const file = body.file
  const empresaId = typeof body.empresaId === 'string' ? body.empresaId : ''
  if (!empresaId) return c.json({ error: 'Informe empresaId.' }, 400)
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'Envie o campo file (XML).' }, 400)
  }
  const ab = await (file as File).arrayBuffer()
  const xml = new TextDecoder('utf-8').decode(ab)
  const detPv = detectarFamiliaXmlFiscal(xml)
  const errFamPv = erroSeFamiliaNaoSuportadaEntrada(detPv)
  if (errFamPv) return c.json({ error: errFamPv }, 400)

  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }
  try {
    await assertPreviewDestinatarioPermitido(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  let assinaturaValida = false
  try {
    const v = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(v.valida && v.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const sugestoes: {
    indice: number
    produtoId: string | null
    motivo: string
    rotulo?: string
  }[] = []
  for (let i = 0; i < parsed.itens.length; i++) {
    const s = await sugerirProdutoParaItem(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.itens[i]!)
    sugestoes.push({
      indice: i,
      produtoId: s.produtoId,
      motivo: s.motivo,
      rotulo: s.rotulo,
    })
  }

  const fornecedorId = await findFornecedorPorCnpj(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.emitenteCnpj)
  const nfceSemDest = parsed.destinatarioAusente && parsed.modelo === 65
  const importKind = classificarNfeEntradaKind(parsed)

  const { pedido, origem, abertos } = await sugerirPedidoParaNota(
    c.env.DB_SHARED,
    tenant.tenantId,
    fornecedorId,
    parsed.itens,
  )
  const produtoIds = sugestoes.map((s) => s.produtoId)
  const vinculosPedido = pedido ? casarItens(pedido, parsed.itens, produtoIds) : []
  const divergencias = pedido ? apurarDivergencias(pedido, parsed.itens, vinculosPedido) : []

  return c.json({
    parsed,
    sugestoes,
    assinatura_valida: assinaturaValida,
    fornecedor_id: fornecedorId,
    fornecedor_sera_cadastrado: !fornecedorId,
    xml_tamanho_bytes: ab.byteLength,
    nfce_sem_dest: nfceSemDest,
    import_kind: importKind,
    modelo_fiscal: parsed.modelo,
    fiscal_xml_family: 'nfe_icms',
    numero_pedido_xml: numeroPedidoDoXml(parsed.itens),
    pedido_sugerido: pedido,
    pedido_origem: origem,
    pedidos_abertos: abertos,
    vinculos_pedido: vinculosPedido,
    divergencias,
  })
})

const avaliarVinculoSchema = z.object({
  pedidoCompraId: z.string().uuid(),
  itens: z
    .array(
      z.object({
        descricao: z.string(),
        quantidade: z.number(),
        valorUnitario: z.number(),
        nItemPed: z.number().int().positive().optional(),
        produtoId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
  /** Escolhas do usuário que vencem o casamento automático. */
  overrides: z
    .array(z.object({ indice: z.number().int().min(0), itemPedidoId: z.string().uuid().nullable() }))
    .optional(),
})

/**
 * Recalcula o casamento e as divergências quando o usuário troca o pedido no
 * assistente. Mantém a regra do lado da API para não duplicar a lógica no front.
 */
app.post('/nf-entradas/avaliar-vinculo', zValidator('json', avaliarVinculoSchema), async (c) => {
  const tenant = c.get('tenant')
  const { pedidoCompraId, itens, overrides } = c.req.valid('json')

  const pedido = await carregarPedidoComItens(c.env.DB_SHARED, tenant.tenantId, pedidoCompraId)
  if (!pedido) return c.json({ error: 'Pedido de compra não encontrado.' }, 404)

  const itensNota: NfeEntradaItem[] = itens.map((it, idx) => ({
    nItem: idx + 1,
    descricao: it.descricao,
    quantidade: it.quantidade,
    valorUnitario: it.valorUnitario,
    valorTotal: it.quantidade * it.valorUnitario,
    nItemPed: it.nItemPed,
  }))
  const produtoIds = itens.map((it) => it.produtoId ?? null)
  const mapaOverrides = overrides?.length ? new Map(overrides.map((o) => [o.indice, o.itemPedidoId])) : undefined

  const vinculos = casarItens(pedido, itensNota, produtoIds, mapaOverrides)
  const divergencias = apurarDivergencias(pedido, itensNota, vinculos)

  return c.json({ pedido, vinculos_pedido: vinculos, divergencias })
})

const vinculoConfirmSchema = z.object({
  indice: z.number().int().min(0),
  produtoId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
  /** Item do pedido de compra que este item da nota atende. */
  itemPedidoId: z.string().uuid().nullable().optional(),
})

const confirmImportSchema = z.object({
  xmlBase64: z.string().min(20),
  empresaId: z.string().uuid(),
  filialId: z.string().uuid().nullable().optional(),
  vinculos: z.array(vinculoConfirmSchema).min(1),
  /** Quando informado, a nota gera o recebimento deste pedido. */
  pedidoCompraId: z.string().uuid().nullable().optional(),
  /** Obrigatório quando o XML é NFC-e (65) sem grupo `dest`. */
  confirmarDestinoEmpresa: z.boolean().optional(),
})

// POST /nf-entradas/confirmar — grava NF-e com itens vinculados a produtos (e cria produtos quando solicitado)
app.post('/nf-entradas/confirmar', zValidator('json', confirmImportSchema), async (c) => {
  const tenant = c.get('tenant')
  if (!c.env.R2_STORAGE) {
    return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)
  }
  const { xmlBase64, empresaId, filialId, confirmarDestinoEmpresa, pedidoCompraId } = c.req.valid('json')
  const vinculosIn = c.req.valid('json').vinculos
  const uid = auditUserId(c)

  let xml: string
  try {
    const bytes = Uint8Array.from(atob(xmlBase64), (ch) => ch.charCodeAt(0))
    xml = new TextDecoder('utf-8').decode(bytes)
  } catch {
    return c.json({ error: 'xmlBase64 inválido.' }, 400)
  }

  const det = detectarFamiliaXmlFiscal(xml)
  const errFam = erroSeFamiliaNaoSuportadaEntrada(det)
  if (errFam) return c.json({ error: errFam }, 400)

  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  try {
    await assertImportacaoEntradaPermitida(
      c.env.DB_SHARED,
      tenant.tenantId,
      empresaId,
      parsed,
      confirmarDestinoEmpresa === true,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  let destCnpjGravacao: string
  try {
    destCnpjGravacao = await cnpjDestinatarioParaGravacao(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  const nItens = parsed.itens.length
  if (nItens === 0) {
    return c.json({ error: 'NF-e sem itens de produto.' }, 400)
  }

  const byIdx = new Map(vinculosIn.map((v) => [v.indice, v]))
  for (let i = 0; i < nItens; i++) {
    if (!byIdx.has(i)) {
      return c.json({ error: `Falta vínculo para o item índice ${i}.` }, 400)
    }
  }
  for (const v of vinculosIn) {
    const hasPid = Boolean(v.produtoId)
    const criar = v.criar === true
    if (hasPid && criar) {
      return c.json({ error: `Item ${v.indice}: use produtoId ou criar=true, não ambos.` }, 400)
    }
    if (!hasPid && !criar) {
      return c.json({ error: `Item ${v.indice}: vincule um produto ou marque criação automática.` }, 400)
    }
  }

  const dup = await c.env.DB_SHARED
    .prepare(`SELECT id FROM nf_entradas WHERE tenant_id = ? AND chave_acesso = ?`)
    .bind(tenant.tenantId, parsed.chaveAcesso)
    .first<{ id: string }>()
  if (dup) {
    return c.json({ error: 'Esta NF-e já foi importada.', id: dup.id }, 409)
  }

  const itensOut: Record<string, unknown>[] = []
  for (let i = 0; i < nItens; i++) {
    const v = byIdx.get(i)!
    const base = parsed.itens[i]!
    let produtoId: string
    if (v.criar) {
      produtoId = await criarProdutoDoItem(c.env, tenant.tenantId, empresaId, base, uid)
      itensOut.push({
        ...base,
        produto_id: produtoId,
        criado_no_import: true,
      })
    } else {
      const chk = await c.env.DB_SHARED
        .prepare(`SELECT id FROM produtos WHERE id = ? AND tenant_id = ?`)
        .bind(v.produtoId!, tenant.tenantId)
        .first<{ id: string }>()
      if (!chk) {
        return c.json({ error: `Produto ${v.produtoId} não encontrado.` }, 400)
      }
      produtoId = v.produtoId!
      itensOut.push({
        ...base,
        produto_id: produtoId,
        criado_no_import: false,
      })
    }
  }

  let assinaturaValida = false
  try {
    const ver = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(ver.valida && ver.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const usuarioMov = (c.get('user') as { userId?: string } | undefined)?.userId ?? null

  const fornecedorRes = await garantirFornecedorDoEmitente(
    c.env.DB_SHARED,
    tenant.tenantId,
    empresaId,
    filialId ?? null,
    parsed,
    uid,
  )
  const fornecedorId = fornecedorRes.id

  // ─── Vínculo com pedido de compra ───────────────────────────────
  // Cada item entra no estoque por um caminho só: os vinculados ao pedido pelo
  // recebimento, os demais pela própria nota. É o que evita a entrada em dobro.
  let pedido = null as Awaited<ReturnType<typeof carregarPedidoComItens>>
  const itemPedidoPorIndice = new Map<number, string>()

  if (pedidoCompraId) {
    pedido = await carregarPedidoComItens(c.env.DB_SHARED, tenant.tenantId, pedidoCompraId)
    if (!pedido) {
      return c.json({ error: 'Pedido de compra não encontrado.' }, 404)
    }
    if (pedido.fornecedor_id !== fornecedorId) {
      return c.json(
        { error: `O pedido ${pedido.numero} é de outro fornecedor. O emitente da nota precisa ser o mesmo do pedido.` },
        400,
      )
    }
    if (!STATUS_PEDIDO_ABERTO.includes(pedido.status as (typeof STATUS_PEDIDO_ABERTO)[number])) {
      return c.json(
        { error: `O pedido ${pedido.numero} está como "${pedido.status}" e não pode receber mercadoria.` },
        400,
      )
    }

    const itensPedidoPorId = new Map(pedido.itens.map((i) => [i.id, i]))
    const usados = new Set<string>()
    for (const v of vinculosIn) {
      if (!v.itemPedidoId) continue
      const alvo = itensPedidoPorId.get(v.itemPedidoId)
      if (!alvo) {
        return c.json({ error: `Item ${v.indice}: item informado não pertence ao pedido ${pedido.numero}.` }, 400)
      }
      if (usados.has(alvo.id)) {
        return c.json({ error: `Item ${v.indice}: o mesmo item do pedido foi vinculado a duas linhas da nota.` }, 400)
      }
      const qtd = parsed.itens[v.indice]?.quantidade ?? 0
      if (qtd > alvo.saldo + 0.01) {
        return c.json(
          {
            error: `Item ${v.indice}: a nota traz ${qtd} e o pedido tem saldo de ${alvo.saldo}. Desvincule o item ou ajuste o pedido.`,
          },
          400,
        )
      }
      usados.add(alvo.id)
      itemPedidoPorIndice.set(v.indice, alvo.id)
    }

    for (const [indice, itemPedidoId] of itemPedidoPorIndice) {
      const row = itensOut[indice]
      if (row) row.item_pedido_id = itemPedidoId
    }
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const xmlPath = `tenants/${tenant.tenantId}/nfe_entrada/${parsed.chaveAcesso}.xml`
  const ab = new TextEncoder().encode(xml)

  await c.env.R2_STORAGE.put(xmlPath, ab, {
    httpMetadata: { contentType: 'application/xml' },
  })

  const neRow = {
    id,
    empresa_id: empresaId,
    filial_id: filialId ?? null,
    fornecedor_id: fornecedorId,
    cobranca_json: JSON.stringify(parsed.duplicatas),
    data_emissao: parsed.dataEmissao,
    valor_total: parsed.valorTotal,
    numero: parsed.numero,
    serie: parsed.serie,
    emitente_nome: parsed.emitenteNome || null,
    emitente_cnpj: parsed.emitenteCnpj,
    chave_acesso: parsed.chaveAcesso,
  }

  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []
  const contasPagarCriadas: string[] = []

  stmts.push(
    c.env.DB_SHARED
      .prepare(
        `INSERT INTO nf_entradas
        (id, tenant_id, empresa_id, filial_id, chave_acesso, xml_path, emitente_cnpj, emitente_nome,
         destinatario_cnpj, data_emissao, numero, serie, natureza_operacao, valor_total, valor_produtos,
         fornecedor_id, pedido_compra_id, itens_json, cobranca_json, assinatura_valida, status, origem,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importada', 'xml', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        tenant.tenantId,
        empresaId,
        filialId ?? null,
        parsed.chaveAcesso,
        xmlPath,
        parsed.emitenteCnpj,
        parsed.emitenteNome || null,
        destCnpjGravacao,
        parsed.dataEmissao,
        parsed.numero,
        parsed.serie,
        parsed.naturezaOperacao || null,
        parsed.valorTotal,
        parsed.valorProdutos,
        fornecedorId,
        pedido ? pedido.id : null,
        JSON.stringify(itensOut),
        JSON.stringify(parsed.duplicatas),
        assinaturaValida ? 1 : 0,
        now,
        now,
        uid,
        uid,
      ),
  )

  // Estoque dos itens que não deram baixa em pedido — os demais entram pelo recebimento.
  appendStmtEntradaEstoquePorItens(
    c.env.DB_SHARED,
    stmts,
    tenant.tenantId,
    id,
    itensOut.filter((_, i) => !itemPedidoPorIndice.has(i)),
    usuarioMov,
    uid,
    now,
  )

  let recebimentoId: string | null = null
  let statusPedido: string | null = null
  if (pedido && itemPedidoPorIndice.size > 0) {
    recebimentoId = crypto.randomUUID()
    statusPedido = appendStmtRecebimentoDaNfEntrada(c.env.DB_SHARED, stmts, {
      tenantId: tenant.tenantId,
      recebimentoId,
      nfEntradaId: id,
      pedido,
      itensOut,
      itemPedidoPorIndice,
      usuarioMov,
      uid,
      now,
      numeroNota: parsed.numero,
    })
  }

  appendStmtContasPagarNfEntrada(
    c.env.DB_SHARED,
    stmts,
    contasPagarCriadas,
    tenant.tenantId,
    uid,
    now,
    neRow,
    'Fornecedores',
  )

  await c.env.DB_SHARED.batch(stmts)

  return c.json(
    {
      id,
      message: pedido
        ? `NF-e importada e vinculada ao pedido de compra ${pedido.numero}.`
        : 'NF-e importada com vínculo de produtos.',
      import_kind: classificarNfeEntradaKind(parsed),
      modelo_fiscal: parsed.modelo,
      fornecedor_vinculado: true,
      fornecedor_criado: fornecedorRes.criado,
      assinatura_valida: assinaturaValida,
      contas_pagar_criadas: contasPagarCriadas,
      estoque_itens_movimentados: itensOut.filter((it) => {
        const pid = typeof it.produto_id === 'string' ? it.produto_id : ''
        const q = Number(it.quantidade) || 0
        return Boolean(pid && q > 0)
      }).length,
      pedido_compra_id: pedido ? pedido.id : null,
      pedido_compra_numero: pedido ? pedido.numero : null,
      pedido_compra_status: statusPedido,
      recebimento_id: recebimentoId,
      itens_baixados_no_pedido: itemPedidoPorIndice.size,
    },
    201,
  )
})

// GET /nf-entradas/:id
app.get('/nf-entradas/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const row = await c.env.DB_SHARED
    .prepare(
      `SELECT n.*, p.nome as fornecedor_nome, p.cpf_cnpj as fornecedor_doc,
              pc.numero as pedido_compra_numero, pc.status as pedido_compra_status
       FROM nf_entradas n
       LEFT JOIN pessoas p ON p.id = n.fornecedor_id
       LEFT JOIN pedidos_compra pc ON pc.id = n.pedido_compra_id
       WHERE n.id = ? AND n.tenant_id = ?`,
    )
    .bind(id, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!row) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)

  const contas = await c.env.DB_SHARED
    .prepare(
      `SELECT id, codigo, descricao, valor, vencimento, status, nf_entrada_id
       FROM contas_pagar WHERE tenant_id = ? AND nf_entrada_id = ? ORDER BY vencimento`,
    )
    .bind(tenant.tenantId, id)
    .all()

  let itens: unknown[] = []
  try {
    if (row.itens_json && typeof row.itens_json === 'string') {
      itens = JSON.parse(row.itens_json as string) as unknown[]
    }
  } catch {
    itens = []
  }

  let cobranca: unknown = null
  try {
    if (row.cobranca_json && typeof row.cobranca_json === 'string') {
      cobranca = JSON.parse(row.cobranca_json as string)
    }
  } catch {
    cobranca = null
  }

  return c.json({ ...row, itens, cobranca, contas_pagar: contas.results ?? [] })
})

// POST /nf-entradas/importar-xml  (multipart: file + empresaId + filialId opcional)
app.post('/nf-entradas/importar-xml', async (c) => {
  const tenant = c.get('tenant')
  if (!c.env.R2_STORAGE) {
    return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Corpo inválido. Envie multipart com arquivo XML.' }, 400)
  }

  const file = body.file
  const empresaId = typeof body.empresaId === 'string' ? body.empresaId : ''
  const filialId = typeof body.filialId === 'string' && body.filialId ? body.filialId : null
  const rawConfirm = body.confirmarDestinoEmpresa
  const confirmarDestinoEmpresa =
    rawConfirm === true ||
    rawConfirm === 'true' ||
    rawConfirm === '1' ||
    rawConfirm === 'on'

  if (!empresaId) return c.json({ error: 'Informe empresaId.' }, 400)
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'Envie o campo file (XML da NF-e).' }, 400)
  }

  const ab = await (file as File).arrayBuffer()
  const xml = new TextDecoder('utf-8').decode(ab)

  const detImp = detectarFamiliaXmlFiscal(xml)
  const errFamImp = erroSeFamiliaNaoSuportadaEntrada(detImp)
  if (errFamImp) return c.json({ error: errFamImp }, 400)

  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  try {
    await assertImportacaoEntradaPermitida(
      c.env.DB_SHARED,
      tenant.tenantId,
      empresaId,
      parsed,
      confirmarDestinoEmpresa,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  let destCnpjGravacao: string
  try {
    destCnpjGravacao = await cnpjDestinatarioParaGravacao(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  const dup = await c.env.DB_SHARED
    .prepare(`SELECT id FROM nf_entradas WHERE tenant_id = ? AND chave_acesso = ?`)
    .bind(tenant.tenantId, parsed.chaveAcesso)
    .first<{ id: string }>()
  if (dup) {
    return c.json({ error: 'Esta NF-e já foi importada (chave duplicada).', id: dup.id }, 409)
  }

  let assinaturaValida = false
  try {
    const v = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(v.valida && v.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const uid = auditUserId(c)
  const fornecedorRes = await garantirFornecedorDoEmitente(
    c.env.DB_SHARED,
    tenant.tenantId,
    empresaId,
    filialId,
    parsed,
    uid,
  )
  const fornecedorId = fornecedorRes.id

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const xmlPath = `tenants/${tenant.tenantId}/nfe_entrada/${parsed.chaveAcesso}.xml`

  await c.env.R2_STORAGE.put(xmlPath, ab, {
    httpMetadata: { contentType: 'application/xml' },
  })

  const cobrancaJson = JSON.stringify(parsed.duplicatas)

  const neRow = {
    id,
    empresa_id: empresaId,
    filial_id: filialId,
    fornecedor_id: fornecedorId,
    cobranca_json: cobrancaJson,
    data_emissao: parsed.dataEmissao,
    valor_total: parsed.valorTotal,
    numero: parsed.numero,
    serie: parsed.serie,
    emitente_nome: parsed.emitenteNome || null,
    emitente_cnpj: parsed.emitenteCnpj,
    chave_acesso: parsed.chaveAcesso,
  }

  const stmtsImp: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []
  const contasPagarCriadasImp: string[] = []

  stmtsImp.push(
    c.env.DB_SHARED
      .prepare(
        `INSERT INTO nf_entradas
        (id, tenant_id, empresa_id, filial_id, chave_acesso, xml_path, emitente_cnpj, emitente_nome,
         destinatario_cnpj, data_emissao, numero, serie, natureza_operacao, valor_total, valor_produtos,
         fornecedor_id, itens_json, cobranca_json, assinatura_valida, status, origem,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importada', 'xml', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        tenant.tenantId,
        empresaId,
        filialId,
        parsed.chaveAcesso,
        xmlPath,
        parsed.emitenteCnpj,
        parsed.emitenteNome || null,
        destCnpjGravacao,
        parsed.dataEmissao,
        parsed.numero,
        parsed.serie,
        parsed.naturezaOperacao || null,
        parsed.valorTotal,
        parsed.valorProdutos,
        fornecedorId,
        JSON.stringify(parsed.itens),
        cobrancaJson,
        assinaturaValida ? 1 : 0,
        now,
        now,
        uid,
        uid,
      ),
  )

  appendStmtContasPagarNfEntrada(
    c.env.DB_SHARED,
    stmtsImp,
    contasPagarCriadasImp,
    tenant.tenantId,
    uid,
    now,
    neRow,
    'Fornecedores',
  )

  await c.env.DB_SHARED.batch(stmtsImp)

  return c.json(
    {
      id,
      message: 'NF-e importada com sucesso.',
      import_kind: classificarNfeEntradaKind(parsed),
      modelo_fiscal: parsed.modelo,
      fornecedor_vinculado: true,
      fornecedor_criado: fornecedorRes.criado,
      assinatura_valida: assinaturaValida,
      contas_pagar_criadas: contasPagarCriadasImp,
    },
    201,
  )
})

const gerarCpSchema = z.object({
  categoria: z.string().optional(),
})

// POST /nf-entradas/:id/gerar-contas-pagar
app.post('/nf-entradas/:id/gerar-contas-pagar', zValidator('json', gerarCpSchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const { categoria } = c.req.valid('json')

  const ne = await c.env.DB_SHARED
    .prepare(`SELECT * FROM nf_entradas WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!ne) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)

  if (!ne.fornecedor_id) {
    return c.json(
      {
        error:
          'Cadastre o fornecedor com o mesmo CNPJ do emitente ou associe manualmente antes de gerar títulos.',
      },
      400,
    )
  }

  const existentes = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c FROM contas_pagar WHERE tenant_id = ? AND nf_entrada_id = ?`)
    .bind(tenant.tenantId, id)
    .first<{ c: number }>()
  if (Number(existentes?.c ?? 0) > 0) {
    return c.json({ error: 'Já existem contas a pagar vinculadas a esta NF-e.' }, 409)
  }

  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const neRow = {
    id,
    empresa_id: ne.empresa_id as string,
    filial_id: (ne.filial_id as string) || null,
    fornecedor_id: ne.fornecedor_id as string,
    cobranca_json: (ne.cobranca_json as string) || null,
    data_emissao: (ne.data_emissao as string) || null,
    valor_total: Number(ne.valor_total) || 0,
    numero: ne.numero as number | null,
    serie: (ne.serie as string) || null,
    emitente_nome: (ne.emitente_nome as string) || null,
    emitente_cnpj: String(ne.emitente_cnpj ?? ''),
    chave_acesso: String(ne.chave_acesso ?? ''),
  }

  const criadas: string[] = []
  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []

  appendStmtContasPagarNfEntrada(
    c.env.DB_SHARED,
    stmts,
    criadas,
    tenant.tenantId,
    uid,
    now,
    neRow,
    categoria ?? 'Fornecedores',
  )

  if (criadas.length === 0) {
    return c.json(
      { error: 'Valor da nota é zero ou não há dados para gerar parcelas. Verifique o XML ou use outra NF-e.' },
      400,
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ ids: criadas, message: `${criadas.length} título(s) a pagar criado(s).` }, 201)
})

const patchFornecedorSchema = z.object({
  fornecedorId: z.string().uuid(),
})

// PATCH /nf-entradas/:id — vincular fornecedor (cadastro) manualmente
app.patch('/nf-entradas/:id', zValidator('json', patchFornecedorSchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const { fornecedorId } = c.req.valid('json')

  const pessoa = await c.env.DB_SHARED
    .prepare(
      `SELECT id FROM pessoas WHERE id = ? AND tenant_id = ? AND tipo_cadastro = 'fornecedor'`,
    )
    .bind(fornecedorId, tenant.tenantId)
    .first<{ id: string }>()
  if (!pessoa) {
    return c.json({ error: 'Fornecedor não encontrado ou não é cadastro de fornecedor.' }, 400)
  }

  const r = await c.env.DB_SHARED
    .prepare(
      `UPDATE nf_entradas SET fornecedor_id = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(fornecedorId, new Date().toISOString(), auditUserId(c), id, tenant.tenantId)
    .run()

  const changes = (r as { meta?: { changes?: number } }).meta?.changes ?? 0
  if (changes === 0) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)
  return c.json({ message: 'Fornecedor vinculado.' })
})

// ═══════════════════════════════════════════════════════════════════════════
// Distribuição DFe — busca automática de NF-e destinadas ao CNPJ da empresa
// Ver doc/integracoes-contabilidade.md §2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /dfe/consultar { empresaId }
 * Executa um lote de consulta no Ambiente Nacional (≤50 docs por chamada),
 * grava XMLs no R2 e metadados em dfe_documentos, avança o NSU em dfe_sync.
 */
app.post('/dfe/consultar', zValidator('json', z.object({ empresaId: z.string().min(1) })), async (c) => {
  const tenant = c.get('tenant')
  const { empresaId } = c.req.valid('json')

  if (!c.env.R2_STORAGE) return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)

  const empresa = await c.env.DB_SHARED
    .prepare(
      'SELECT id, cnpj, uf, nfe_ambiente, a1_r2_object_key FROM empresas WHERE id = ? AND tenant_id = ?',
    )
    .bind(empresaId, tenant.tenantId)
    .first<{
      id: string
      cnpj: string | null
      uf: string | null
      nfe_ambiente: number | null
      a1_r2_object_key: string | null
    }>()

  if (!empresa) return c.json({ error: 'Empresa não encontrada.' }, 404)
  const cnpj = (empresa.cnpj ?? '').replace(/\D/g, '')
  if (cnpj.length !== 14) return c.json({ error: 'Empresa sem CNPJ válido cadastrado.' }, 400)
  if (!empresa.a1_r2_object_key) {
    return c.json({ error: 'Envie o certificado A1 da empresa antes de consultar a Distribuição DFe.' }, 400)
  }

  const now = new Date().toISOString()

  // Estado de sincronização (cria se não existir)
  let sync = await c.env.DB_SHARED
    .prepare('SELECT * FROM dfe_sync WHERE tenant_id = ? AND empresa_id = ?')
    .bind(tenant.tenantId, empresaId)
    .first<{ id: string; ult_nsu: string }>()

  if (!sync) {
    const id = crypto.randomUUID()
    await c.env.DB_SHARED
      .prepare('INSERT INTO dfe_sync (id, tenant_id, empresa_id, ult_nsu, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, tenant.tenantId, empresaId, '0', now)
      .run()
    sync = { id, ult_nsu: '0' }
  }

  const { consultarDistribuicaoDfe, extractDocMeta } = await import('../lib/dfe/distribuicaoDfe')
  const { cUfFromSigla } = await import('../lib/nfe/ufIbge')

  try {
    const resultado = await consultarDistribuicaoDfe(c.env, tenant.tenantId, {
      tpAmb: empresa.nfe_ambiente === 1 ? 1 : 2,
      cUfAutor: Number(cUfFromSigla(empresa.uf)) || 91,
      cnpj,
      ultNsu: sync.ult_nsu,
      certScopeKey: empresaId,
      a1ObjectKey: empresa.a1_r2_object_key,
    })

    // 137 = nenhum documento; 138 = documentos localizados; demais = rejeição
    if (resultado.cStat !== '137' && resultado.cStat !== '138') {
      throw new Error(`SEFAZ rejeitou a consulta: cStat=${resultado.cStat} — ${resultado.xMotivo}`)
    }

    let novos = 0
    for (const doc of resultado.documentos) {
      const existe = await c.env.DB_SHARED
        .prepare('SELECT id FROM dfe_documentos WHERE tenant_id = ? AND empresa_id = ? AND nsu = ?')
        .bind(tenant.tenantId, empresaId, doc.nsu)
        .first()
      if (existe) continue

      const meta = extractDocMeta(doc.schema, doc.xml)
      const xmlPath = `tenants/${tenant.tenantId}/dfe/${empresaId}/${doc.nsu}.xml`
      await c.env.R2_STORAGE.put(xmlPath, doc.xml)

      await c.env.DB_SHARED
        .prepare(`
          INSERT INTO dfe_documentos
            (id, tenant_id, empresa_id, nsu, schema_doc, tipo, chave_acesso,
             emitente_cnpj, emitente_nome, valor_total, dh_emissao, xml_path, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo', ?)
        `)
        .bind(
          crypto.randomUUID(), tenant.tenantId, empresaId, doc.nsu, doc.schema, meta.tipo,
          meta.chaveAcesso, meta.emitenteCnpj, meta.emitenteNome, meta.valorTotal,
          meta.dhEmissao, xmlPath, now,
        )
        .run()
      novos++
    }

    await c.env.DB_SHARED
      .prepare(`
        UPDATE dfe_sync SET ult_nsu = ?, max_nsu = ?, ultima_consulta_em = ?,
                            ultimo_status = 'ok', ultimo_erro = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(resultado.ultNsu, resultado.maxNsu, now, now, sync.id)
      .run()

    const pendentes = BigInt(resultado.maxNsu || '0') > BigInt(resultado.ultNsu || '0')
    return c.json({
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      documentos_novos: novos,
      ult_nsu: resultado.ultNsu,
      max_nsu: resultado.maxNsu,
      ha_mais: pendentes,
      message: resultado.cStat === '137'
        ? 'Nenhum documento novo na SEFAZ.'
        : `${novos} documento(s) novo(s) baixado(s).${pendentes ? ' Há mais documentos — consulte novamente.' : ''}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na consulta DFe.'
    await c.env.DB_SHARED
      .prepare(`
        UPDATE dfe_sync SET ultima_consulta_em = ?, ultimo_status = 'erro', ultimo_erro = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, msg.slice(0, 500), now, sync.id)
      .run()
    return c.json({ error: msg }, 502)
  }
})

/** GET /dfe/status?empresaId= — estado da sincronização. */
app.get('/dfe/status', async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.query('empresaId')
  if (!empresaId) return c.json({ error: 'empresaId é obrigatório.' }, 400)

  const sync = await c.env.DB_SHARED
    .prepare('SELECT ult_nsu, max_nsu, ultima_consulta_em, ultimo_status, ultimo_erro FROM dfe_sync WHERE tenant_id = ? AND empresa_id = ?')
    .bind(tenant.tenantId, empresaId)
    .first()
  return c.json({ sync: sync ?? null })
})

/** GET /dfe/documentos?empresaId=&status= — lista documentos distribuídos. */
app.get('/dfe/documentos', async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.query('empresaId')
  const status = c.req.query('status')
  if (!empresaId) return c.json({ error: 'empresaId é obrigatório.' }, 400)

  const { results } = await c.env.DB_SHARED
    .prepare(`
      SELECT id, nsu, schema_doc, tipo, chave_acesso, emitente_cnpj, emitente_nome,
             valor_total, dh_emissao, status, created_at
      FROM dfe_documentos
      WHERE tenant_id = ? AND empresa_id = ? ${status ? 'AND status = ?' : ''}
      ORDER BY CAST(nsu AS INTEGER) DESC
      LIMIT 200
    `)
    .bind(tenant.tenantId, empresaId, ...(status ? [status] : []))
    .all()
  return c.json({ documentos: results })
})

/** GET /dfe/documentos/:id/xml — baixa o XML armazenado. */
app.get('/dfe/documentos/:id/xml', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const doc = await c.env.DB_SHARED
    .prepare('SELECT xml_path, chave_acesso, nsu FROM dfe_documentos WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ xml_path: string; chave_acesso: string | null; nsu: string }>()
  if (!doc) return c.json({ error: 'Documento não encontrado.' }, 404)

  if (!c.env.R2_STORAGE) return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)
  const obj = await c.env.R2_STORAGE.get(doc.xml_path)
  if (!obj) return c.json({ error: 'XML não encontrado no storage.' }, 404)

  return new Response(await obj.text(), {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${doc.chave_acesso ?? doc.nsu}.xml"`,
    },
  })
})

/** POST /dfe/documentos/:id/status { status } — marcar importada/ignorada/novo. */
app.post(
  '/dfe/documentos/:id/status',
  zValidator('json', z.object({ status: z.enum(['novo', 'importada', 'ignorada']) })),
  async (c) => {
    const tenant = c.get('tenant')
    const id = c.req.param('id')
    const { status } = c.req.valid('json')

    const { meta } = await c.env.DB_SHARED
      .prepare('UPDATE dfe_documentos SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
      .bind(status, new Date().toISOString(), id, tenant.tenantId)
      .run()
    if (!meta.changes) return c.json({ error: 'Documento não encontrado.' }, 404)
    return c.json({ message: 'Status atualizado.' })
  },
)

export default app
