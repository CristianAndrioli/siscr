import { DOMParser } from '@xmldom/xmldom'

export type NfeEntradaItem = {
  /** Índice do item na NF-e (`@nItem` do `det`). */
  nItem: number
  /** Código do produto no fornecedor — usado em ERPs para "de/para" e SKU. */
  cProd?: string
  /** EAN/UPC quando informado (ou GTIN tributável). */
  cEAN?: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  cfop?: string
  ncm?: string
  unidade?: string
  /**
   * `prod/xPed` — número do pedido de compra informado pelo fornecedor.
   * É o campo que permite casar a nota com o pedido sem intervenção manual.
   */
  xPed?: string
  /** `prod/nItemPed` — item do pedido de compra correspondente a este item da nota. */
  nItemPed?: number
}

export type NfeEntradaDuplicata = {
  numero?: string
  vencimento: string
  valor: number
}

export type NfeEntradaParsed = {
  chaveAcesso: string
  emitenteCnpj: string
  emitenteNome: string
  destinatarioDoc: string
  destinatarioTipo: 'CNPJ' | 'CPF'
  /** Modelo fiscal (`ide/mod`): 55 NF-e, 65 NFC-e, etc. */
  modelo: number
  /**
   * True quando não há grupo `dest` no XML (comum em NFC-e de consumidor).
   * Nesse caso o CNPJ do destinatário deve ser inferido da empresa escolhida na importação.
   */
  destinatarioAusente: boolean
  dataEmissao: string
  numero: number
  serie: string
  naturezaOperacao: string
  valorTotal: number
  valorProdutos: number
  itens: NfeEntradaItem[]
  duplicatas: NfeEntradaDuplicata[]
  /** Dados extras do emitente (cadastro automático de fornecedor). */
  emitIe?: string
  emitTelefone?: string
  emitCep?: string
  emitLogradouro?: string
  emitNumero?: string
  emitBairro?: string
  emitCidade?: string
  emitUf?: string
  emitCodigoMunicipio?: string
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

function text(el: Element | null): string {
  if (!el) return ''
  return (el.textContent || '').trim()
}

function* elementsByLocalFrom(root: Node, local: string): Generator<Element> {
  const walk = function* (node: Node): Generator<Element> {
    if (node.nodeType === 1) {
      const e = node as Element
      const ln = e.localName || e.nodeName.replace(/^.*:/, '')
      if (ln === local) yield e
      for (const c of Array.from(node.childNodes)) yield* walk(c)
    }
  }
  yield* walk(root)
}

function firstByLocalFrom(root: Node, local: string): Element | null {
  for (const e of elementsByLocalFrom(root, local)) return e
  return null
}

function* elementsByLocal(doc: Document, local: string): Generator<Element> {
  if (doc.documentElement) yield* elementsByLocalFrom(doc.documentElement, local)
  else for (const c of Array.from(doc.childNodes)) yield* elementsByLocalFrom(c, local)
}

function firstByLocal(doc: Document, local: string): Element | null {
  for (const e of elementsByLocal(doc, local)) return e
  return null
}

function childrenByLocal(parent: Element, local: string): Element[] {
  const out: Element[] = []
  for (const c of Array.from(parent.childNodes)) {
    if (c.nodeType !== 1) continue
    const e = c as Element
    const ln = e.localName || e.nodeName.replace(/^.*:/, '')
    if (ln === local) out.push(e)
  }
  return out
}

/**
 * Extrai dados de NF-e de terceiros (arquivo autorizado) para importação como entrada.
 */
export function parseNfeEntradaXml(xmlString: string): NfeEntradaParsed {
  const parser = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} } })
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parseError = firstByLocal(doc, 'parsererror')
  if (parseError) {
    throw new Error('XML inválido ou malformado.')
  }

  const nfeRoot = firstByLocal(doc, 'NFe') || firstByLocal(doc, 'nfeProc')
  if (!nfeRoot) {
    throw new Error('Arquivo não contém NF-e (elemento NFe/nfeProc ausente).')
  }

  let nfeEl = nfeRoot
  if (nfeRoot.localName === 'nfeProc' || nfeRoot.nodeName.includes('nfeProc')) {
    const inner = firstByLocal(doc, 'NFe')
    if (inner) nfeEl = inner
  }

  const infNFe = firstByLocalFrom(nfeEl, 'infNFe')
  if (!infNFe) {
    throw new Error('infNFe não encontrado no XML.')
  }

  const idAttr = infNFe.getAttribute('Id') || ''
  let chave = ''
  if (idAttr.startsWith('NFe') && onlyDigits(idAttr.slice(3)).length === 44) {
    chave = onlyDigits(idAttr.slice(3))
  }
  if (!chave) {
    const prot = firstByLocal(doc, 'infProt')
    const ch = prot ? firstByLocalFrom(prot, 'chNFe') : null
    const t = text(ch)
    if (onlyDigits(t).length === 44) chave = onlyDigits(t)
  }
  if (!chave || chave.length !== 44) {
    throw new Error('Não foi possível obter a chave de acesso (44 dígitos) do XML.')
  }

  const emit = firstByLocalFrom(infNFe, 'emit')
  if (!emit) throw new Error('Grupo emit ausente.')
  const emitCnpj = onlyDigits(text(firstByLocalFrom(emit, 'CNPJ')))
  const emitNome = text(firstByLocalFrom(emit, 'xNome'))
  if (emitCnpj.length !== 14) {
    throw new Error('Emitente sem CNPJ válido (esperado para NF-e de mercadoria).')
  }

  const emitIeRaw = text(firstByLocalFrom(emit, 'IE'))
  const emitIe = emitIeRaw ? emitIeRaw.slice(0, 20) : undefined
  const enderEmit = firstByLocalFrom(emit, 'enderEmit')
  const emitCepRaw = enderEmit ? onlyDigits(text(firstByLocalFrom(enderEmit, 'CEP'))) : ''
  const emitCep = emitCepRaw.length >= 5 ? emitCepRaw.slice(0, 9) : undefined
  const emitLogradouro = enderEmit
    ? text(firstByLocalFrom(enderEmit, 'xLgr')).slice(0, 200) || undefined
    : undefined
  const emitNumero = enderEmit ? text(firstByLocalFrom(enderEmit, 'nro')).slice(0, 20) || undefined : undefined
  const emitBairro = enderEmit ? text(firstByLocalFrom(enderEmit, 'xBairro')).slice(0, 120) || undefined : undefined
  const cMunDig = enderEmit ? onlyDigits(text(firstByLocalFrom(enderEmit, 'cMun'))) : ''
  const emitCodigoMunicipio = cMunDig.length > 0 ? cMunDig.slice(0, 7) : undefined
  const emitCidade = enderEmit ? text(firstByLocalFrom(enderEmit, 'xMun')).slice(0, 120) || undefined : undefined
  const emitUf = enderEmit ? text(firstByLocalFrom(enderEmit, 'UF')).slice(0, 2).toUpperCase() || undefined : undefined
  const foneDigits = enderEmit ? onlyDigits(text(firstByLocalFrom(enderEmit, 'fone'))) : ''
  const emitTelefone = foneDigits.length >= 8 ? foneDigits.slice(0, 20) : undefined

  const ide = firstByLocalFrom(infNFe, 'ide')
  const dhEmi = ide ? text(firstByLocalFrom(ide, 'dhEmi')) : ''
  const dEmi = ide ? text(firstByLocalFrom(ide, 'dEmi')) : ''
  const dataEmissao = (dhEmi || dEmi).slice(0, 10) || new Date().toISOString().slice(0, 10)
  const nNF = ide ? parseInt(text(firstByLocalFrom(ide, 'nNF')) || '0', 10) : 0
  const serie = ide ? text(firstByLocalFrom(ide, 'serie')) : '1'
  const natOp = ide ? text(firstByLocalFrom(ide, 'natOp')) : ''
  const modRaw = ide ? text(firstByLocalFrom(ide, 'mod')) : ''
  const modParsed = parseInt(modRaw, 10)
  const modelo = Number.isFinite(modParsed) && modParsed > 0 ? modParsed : 55

  const dest = firstByLocalFrom(infNFe, 'dest')
  let destinatarioDoc = ''
  let destinatarioTipo: 'CNPJ' | 'CPF' = 'CNPJ'
  let destinatarioAusente = false

  if (dest) {
    const cnpjDest = onlyDigits(text(firstByLocalFrom(dest, 'CNPJ')))
    const cpfDest = onlyDigits(text(firstByLocalFrom(dest, 'CPF')))
    if (cnpjDest.length === 14) {
      destinatarioDoc = cnpjDest
      destinatarioTipo = 'CNPJ'
    } else if (cpfDest.length === 11) {
      destinatarioDoc = cpfDest
      destinatarioTipo = 'CPF'
    } else {
      throw new Error('Destinatário sem CNPJ/CPF reconhecível.')
    }
  } else {
    // Sem grupo <dest>: NFC-e (65) e NF-e ao consumidor (55 sem destinatário explícito).
    // Ambos permitem importação com confirmação manual do comprador.
    destinatarioAusente = true
    destinatarioDoc = ''
    destinatarioTipo = 'CNPJ'
  }

  const totalEl = firstByLocalFrom(infNFe, 'total')
  const icmsTot = totalEl ? firstByLocalFrom(totalEl, 'ICMSTot') : null
  const vNF = icmsTot ? parseFloat(text(firstByLocalFrom(icmsTot, 'vNF')).replace(',', '.')) || 0 : 0
  const vProd = icmsTot ? parseFloat(text(firstByLocalFrom(icmsTot, 'vProd')).replace(',', '.')) || 0 : 0

  const itens: NfeEntradaItem[] = []
  let detIdx = 0
  for (const det of elementsByLocalFrom(infNFe, 'det')) {
    const prod = firstByLocalFrom(det, 'prod')
    if (!prod) continue
    detIdx += 1
    const nItemAttr = det.getAttribute('nItem')
    const nItem = nItemAttr ? parseInt(nItemAttr, 10) || detIdx : detIdx
    const cProd = text(firstByLocalFrom(prod, 'cProd')) || undefined
    const cEANRaw = text(firstByLocalFrom(prod, 'cEAN')) || text(firstByLocalFrom(prod, 'cEANTrib')) || ''
    const cEAN = cEANRaw.replace(/\D/g, '').length >= 8 ? cEANRaw.trim() : undefined
    const xProd = text(firstByLocalFrom(prod, 'xProd'))
    const qCom = parseFloat(text(firstByLocalFrom(prod, 'qCom')).replace(',', '.')) || 0
    const vProdItem = parseFloat(text(firstByLocalFrom(prod, 'vProd')).replace(',', '.')) || 0
    const vUnCom = parseFloat(text(firstByLocalFrom(prod, 'vUnCom')).replace(',', '.')) || 0
    const CFOP = text(firstByLocalFrom(prod, 'CFOP'))
    const NCM = text(firstByLocalFrom(prod, 'NCM'))
    const uCom = text(firstByLocalFrom(prod, 'uCom'))
    const xPedRaw = text(firstByLocalFrom(prod, 'xPed'))
    const nItemPedRaw = parseInt(text(firstByLocalFrom(prod, 'nItemPed')), 10)
    const vu = vUnCom > 0 ? vUnCom : qCom > 0 ? vProdItem / qCom : 0
    itens.push({
      nItem,
      cProd,
      cEAN,
      descricao: xProd || 'Item',
      quantidade: qCom,
      valorUnitario: vu,
      valorTotal: vProdItem,
      cfop: CFOP || undefined,
      ncm: NCM || undefined,
      unidade: uCom || undefined,
      xPed: xPedRaw ? xPedRaw.slice(0, 15) : undefined,
      nItemPed: Number.isFinite(nItemPedRaw) && nItemPedRaw > 0 ? nItemPedRaw : undefined,
    })
  }

  const duplicatas: NfeEntradaDuplicata[] = []
  const cobr = firstByLocalFrom(infNFe, 'cobr')
  if (cobr) {
    const fat = firstByLocalFrom(cobr, 'fat')
    const dupParent = fat || cobr
    for (const dup of childrenByLocal(dupParent, 'dup')) {
      const nDup = text(firstByLocalFrom(dup, 'nDup'))
      const dVenc = text(firstByLocalFrom(dup, 'dVenc'))
      const vDup = parseFloat(text(firstByLocalFrom(dup, 'vDup')).replace(',', '.')) || 0
      if (dVenc && vDup > 0) {
        duplicatas.push({
          numero: nDup || undefined,
          vencimento: dVenc,
          valor: vDup,
        })
      }
    }
  }

  return {
    chaveAcesso: chave,
    emitenteCnpj: emitCnpj,
    emitenteNome: emitNome,
    destinatarioDoc,
    destinatarioTipo,
    modelo,
    destinatarioAusente,
    dataEmissao,
    numero: nNF,
    serie: serie || '1',
    naturezaOperacao: natOp,
    valorTotal: vNF,
    valorProdutos: vProd,
    itens,
    duplicatas,
    emitIe,
    emitTelefone,
    emitCep,
    emitLogradouro,
    emitNumero,
    emitBairro,
    emitCidade,
    emitUf,
    emitCodigoMunicipio,
  }
}

export function normalizarCnpj(cnpj: string): string {
  return onlyDigits(cnpj)
}
