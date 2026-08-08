/**
 * Casamento entre NF-e de entrada e pedido de compra.
 *
 * Segue o padrão dos ERPs brasileiros: o fornecedor informa o número do pedido
 * na tag `xPed` (e o item em `nItemPed`) de cada produto do XML, e o sistema
 * amarra a nota ao pedido sem intervenção manual. Quando o fornecedor não
 * preenche, sobra a busca pelos pedidos em aberto daquele fornecedor.
 */

import type { NfeEntradaItem } from '../nfe/parseNfeEntradaXml'

/** Situações em que um pedido ainda pode receber mercadoria. */
export const STATUS_PEDIDO_ABERTO = ['confirmado', 'recebido_parcial'] as const

/** Diferença de valor abaixo disso é ruído de arredondamento, não divergência. */
const EPSILON_VALOR = 0.01

export type ItemPedidoCompraSaldo = {
  id: string
  /** Posição do item no pedido (1-based), equivalente ao `nItemPed` do XML. */
  seq: number
  produto_id: string
  produto_codigo: string | null
  produto_descricao: string | null
  quantidade: number
  quantidade_recebida: number
  saldo: number
  preco_unitario: number
}

export type PedidoCompraResumo = {
  id: string
  numero: number
  status: string
  total: number
  fornecedor_id: string
  created_at: string
}

export type PedidoCompraComItens = PedidoCompraResumo & {
  itens: ItemPedidoCompraSaldo[]
}

export type OrigemVinculo = 'xped' | 'unico_aberto' | 'manual'

export type SugestaoItemPedido = {
  /** Índice do item dentro da nota. */
  indice: number
  itemPedidoId: string | null
  /** Como o item foi casado: pela tag do XML, pelo produto, pelo usuário, ou não casou. */
  origem: 'nItemPed' | 'produto' | 'manual' | 'none'
}

export type DivergenciaTipo = 'quantidade_acima_saldo' | 'quantidade_parcial' | 'preco' | 'sem_correspondencia'

export type Divergencia = {
  indice: number
  tipo: DivergenciaTipo
  /** `true` impede a importação com este vínculo; `false` é apenas aviso. */
  bloqueia: boolean
  mensagem: string
}

type ItemPedidoRow = {
  id: string
  produto_id: string
  quantidade: number
  quantidade_recebida: number
  preco_unitario: number
  produto_codigo: string | null
  produto_descricao: string | null
}

/** Carrega o pedido com os itens e o saldo pendente de cada um. */
export async function carregarPedidoComItens(
  db: D1Database,
  tenantId: string,
  pedidoId: string,
): Promise<PedidoCompraComItens | null> {
  const pedido = await db
    .prepare(
      `SELECT id, numero, status, total, fornecedor_id, created_at
       FROM pedidos_compra WHERE id = ? AND tenant_id = ?`,
    )
    .bind(pedidoId, tenantId)
    .first<PedidoCompraResumo>()
  if (!pedido) return null

  const { results } = await db
    .prepare(
      `SELECT i.id, i.produto_id, i.quantidade, i.quantidade_recebida, i.preco_unitario,
              p.codigo AS produto_codigo, p.descricao AS produto_descricao
       FROM itens_pedido_compra i
       LEFT JOIN produtos p ON p.id = i.produto_id
       WHERE i.pedido_id = ? AND i.tenant_id = ?
       ORDER BY i.created_at, i.id`,
    )
    .bind(pedidoId, tenantId)
    .all<ItemPedidoRow>()

  const itens: ItemPedidoCompraSaldo[] = (results ?? []).map((r, idx) => {
    const quantidade = Number(r.quantidade) || 0
    const recebida = Number(r.quantidade_recebida) || 0
    return {
      id: r.id,
      seq: idx + 1,
      produto_id: r.produto_id,
      produto_codigo: r.produto_codigo,
      produto_descricao: r.produto_descricao,
      quantidade,
      quantidade_recebida: recebida,
      saldo: Math.max(quantidade - recebida, 0),
      preco_unitario: Number(r.preco_unitario) || 0,
    }
  })

  return { ...pedido, itens }
}

/** Pedidos do fornecedor que ainda podem receber mercadoria, mais recentes primeiro. */
export async function listarPedidosAbertosDoFornecedor(
  db: D1Database,
  tenantId: string,
  fornecedorId: string,
): Promise<PedidoCompraResumo[]> {
  const placeholders = STATUS_PEDIDO_ABERTO.map(() => '?').join(', ')
  const { results } = await db
    .prepare(
      `SELECT id, numero, status, total, fornecedor_id, created_at
       FROM pedidos_compra
       WHERE tenant_id = ? AND fornecedor_id = ? AND status IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .bind(tenantId, fornecedorId, ...STATUS_PEDIDO_ABERTO)
    .all<PedidoCompraResumo>()
  return results ?? []
}

/** Primeiro `xPed` não vazio da nota — os fornecedores repetem o mesmo número em todos os itens. */
export function numeroPedidoDoXml(itens: NfeEntradaItem[]): number | null {
  for (const item of itens) {
    const digits = (item.xPed ?? '').replace(/\D/g, '')
    if (digits) {
      const n = parseInt(digits, 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

/**
 * Escolhe o pedido a sugerir para a nota.
 *
 * Prioriza o número vindo do XML. Sem ele, só sugere quando há exatamente um
 * pedido em aberto para o fornecedor — com vários, adivinhar geraria vínculo
 * errado silencioso, então a escolha fica com o usuário.
 */
export async function sugerirPedidoParaNota(
  db: D1Database,
  tenantId: string,
  fornecedorId: string | null,
  itens: NfeEntradaItem[],
): Promise<{ pedido: PedidoCompraComItens | null; origem: OrigemVinculo | null; abertos: PedidoCompraResumo[] }> {
  if (!fornecedorId) return { pedido: null, origem: null, abertos: [] }

  const abertos = await listarPedidosAbertosDoFornecedor(db, tenantId, fornecedorId)

  const numeroXml = numeroPedidoDoXml(itens)
  if (numeroXml !== null) {
    const alvo = abertos.find((p) => p.numero === numeroXml)
    if (alvo) {
      const pedido = await carregarPedidoComItens(db, tenantId, alvo.id)
      if (pedido) return { pedido, origem: 'xped', abertos }
    }
  }

  if (abertos.length === 1) {
    const pedido = await carregarPedidoComItens(db, tenantId, abertos[0]!.id)
    if (pedido) return { pedido, origem: 'unico_aberto', abertos }
  }

  return { pedido: null, origem: null, abertos }
}

/**
 * Casa cada item da nota com um item do pedido.
 *
 * `nItemPed` tem precedência por vir do documento fiscal; o produto vinculado é
 * o fallback. Um item do pedido só é usado uma vez, para que duas linhas da nota
 * do mesmo produto não deem baixa no mesmo saldo.
 */
export function casarItens(
  pedido: PedidoCompraComItens,
  itensNota: NfeEntradaItem[],
  produtoIdPorIndice: (string | null)[],
  /** Escolhas explícitas do usuário; `null` desvincula o item. Vencem o automático. */
  overrides?: Map<number, string | null>,
): SugestaoItemPedido[] {
  const usados = new Set<string>()
  const saida: SugestaoItemPedido[] = []

  const porSeq = new Map(pedido.itens.map((i) => [i.seq, i]))
  const porId = new Map(pedido.itens.map((i) => [i.id, i]))

  for (const [, itemPedidoId] of overrides ?? []) {
    if (itemPedidoId && porId.has(itemPedidoId)) usados.add(itemPedidoId)
  }

  // Quem tem nItemPed reivindica seu item antes de quem casaria só pelo produto.
  const preliminar: (ItemPedidoCompraSaldo | null)[] = itensNota.map((item, i) => {
    if (overrides?.has(i)) return null
    if (item.nItemPed === undefined) return null
    const alvo = porSeq.get(item.nItemPed)
    if (!alvo || usados.has(alvo.id)) return null
    usados.add(alvo.id)
    return alvo
  })

  for (let i = 0; i < itensNota.length; i++) {
    if (overrides?.has(i)) {
      const escolhido = overrides.get(i) ?? null
      saida.push({
        indice: i,
        itemPedidoId: escolhido && porId.has(escolhido) ? escolhido : null,
        origem: 'manual',
      })
      continue
    }

    const jaCasado = preliminar[i]
    if (jaCasado) {
      saida.push({ indice: i, itemPedidoId: jaCasado.id, origem: 'nItemPed' })
      continue
    }

    const produtoId = produtoIdPorIndice[i] ?? null
    if (produtoId) {
      const porProduto = pedido.itens.find((it) => it.produto_id === produtoId && !usados.has(it.id))
      if (porProduto) {
        usados.add(porProduto.id)
        saida.push({ indice: i, itemPedidoId: porProduto.id, origem: 'produto' })
        continue
      }
    }

    saida.push({ indice: i, itemPedidoId: null, origem: 'none' })
  }

  return saida
}

/**
 * Compara quantidade e preço de cada item casado contra o pedido.
 *
 * Receber menos que o pedido é normal (entrega parcial) e vira aviso. Receber
 * mais que o saldo bloqueia, porque estouraria a quantidade contratada — é o
 * mesmo critério do recebimento manual em `routes/compras.ts`.
 */
export function apurarDivergencias(
  pedido: PedidoCompraComItens,
  itensNota: NfeEntradaItem[],
  vinculos: { indice: number; itemPedidoId: string | null }[],
): Divergencia[] {
  const porId = new Map(pedido.itens.map((i) => [i.id, i]))
  const divergencias: Divergencia[] = []

  for (const v of vinculos) {
    const item = itensNota[v.indice]
    if (!item) continue

    if (!v.itemPedidoId) {
      divergencias.push({
        indice: v.indice,
        tipo: 'sem_correspondencia',
        bloqueia: false,
        mensagem: `“${item.descricao}” não corresponde a nenhum item do pedido ${pedido.numero}. Entra em estoque sem dar baixa no pedido.`,
      })
      continue
    }

    const alvo = porId.get(v.itemPedidoId)
    if (!alvo) continue

    if (item.quantidade > alvo.saldo + EPSILON_VALOR) {
      divergencias.push({
        indice: v.indice,
        tipo: 'quantidade_acima_saldo',
        bloqueia: true,
        mensagem: `“${item.descricao}”: a nota traz ${item.quantidade} e o pedido tem saldo de ${alvo.saldo}. Desvincule este item ou ajuste o pedido.`,
      })
    } else if (item.quantidade < alvo.saldo - EPSILON_VALOR) {
      divergencias.push({
        indice: v.indice,
        tipo: 'quantidade_parcial',
        bloqueia: false,
        mensagem: `“${item.descricao}”: entrega parcial de ${item.quantidade} de um saldo de ${alvo.saldo}. O restante segue pendente no pedido.`,
      })
    }

    const difPreco = item.valorUnitario - alvo.preco_unitario
    if (Math.abs(difPreco) > EPSILON_VALOR) {
      const pct = alvo.preco_unitario > 0 ? (difPreco / alvo.preco_unitario) * 100 : 0
      const sentido = difPreco > 0 ? 'acima' : 'abaixo'
      divergencias.push({
        indice: v.indice,
        tipo: 'preco',
        bloqueia: false,
        mensagem: `“${item.descricao}”: preço da nota ${item.valorUnitario.toFixed(2)} está ${sentido} do pedido ${alvo.preco_unitario.toFixed(2)}${pct !== 0 ? ` (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}.`,
      })
    }
  }

  return divergencias
}
