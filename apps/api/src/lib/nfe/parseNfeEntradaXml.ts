import { DOMParser } from '@xmldom/xmldom'

export type NfeEntradaItem = {
  descricao: string
  quantidade: number
  valorTotal: number
  cfop?: string
  ncm?: string
  unidade?: string
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
  dataEmissao: string
  numero: number
  serie: string
  naturezaOperacao: string
  valorTotal: number
  valorProdutos: number
  itens: NfeEntradaItem[]
  duplicatas: NfeEntradaDuplicata[]
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

  const dest = firstByLocalFrom(infNFe, 'dest')
  if (!dest) throw new Error('Grupo dest ausente.')
  const cnpjDest = onlyDigits(text(firstByLocalFrom(dest, 'CNPJ')))
  const cpfDest = onlyDigits(text(firstByLocalFrom(dest, 'CPF')))
  let destinatarioDoc = ''
  let destinatarioTipo: 'CNPJ' | 'CPF' = 'CNPJ'
  if (cnpjDest.length === 14) {
    destinatarioDoc = cnpjDest
    destinatarioTipo = 'CNPJ'
  } else if (cpfDest.length === 11) {
    destinatarioDoc = cpfDest
    destinatarioTipo = 'CPF'
  } else {
    throw new Error('Destinatário sem CNPJ/CPF reconhecível.')
  }

  const ide = firstByLocalFrom(infNFe, 'ide')
  const dhEmi = ide ? text(firstByLocalFrom(ide, 'dhEmi')) : ''
  const dEmi = ide ? text(firstByLocalFrom(ide, 'dEmi')) : ''
  const dataEmissao = (dhEmi || dEmi).slice(0, 10) || new Date().toISOString().slice(0, 10)
  const nNF = ide ? parseInt(text(firstByLocalFrom(ide, 'nNF')) || '0', 10) : 0
  const serie = ide ? text(firstByLocalFrom(ide, 'serie')) : '1'
  const natOp = ide ? text(firstByLocalFrom(ide, 'natOp')) : ''

  const totalEl = firstByLocalFrom(infNFe, 'total')
  const icmsTot = totalEl ? firstByLocalFrom(totalEl, 'ICMSTot') : null
  const vNF = icmsTot ? parseFloat(text(firstByLocalFrom(icmsTot, 'vNF')).replace(',', '.')) || 0 : 0
  const vProd = icmsTot ? parseFloat(text(firstByLocalFrom(icmsTot, 'vProd')).replace(',', '.')) || 0 : 0

  const itens: NfeEntradaItem[] = []
  for (const det of elementsByLocalFrom(infNFe, 'det')) {
    const prod = firstByLocalFrom(det, 'prod')
    if (!prod) continue
    const xProd = text(firstByLocalFrom(prod, 'xProd'))
    const qCom = parseFloat(text(firstByLocalFrom(prod, 'qCom')).replace(',', '.')) || 0
    const vProdItem = parseFloat(text(firstByLocalFrom(prod, 'vProd')).replace(',', '.')) || 0
    const CFOP = text(firstByLocalFrom(prod, 'CFOP'))
    const NCM = text(firstByLocalFrom(prod, 'NCM'))
    const uCom = text(firstByLocalFrom(prod, 'uCom'))
    itens.push({
      descricao: xProd || 'Item',
      quantidade: qCom,
      valorTotal: vProdItem,
      cfop: CFOP || undefined,
      ncm: NCM || undefined,
      unidade: uCom || undefined,
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
    dataEmissao,
    numero: nNF,
    serie: serie || '1',
    naturezaOperacao: natOp,
    valorTotal: vNF,
    valorProdutos: vProd,
    itens,
    duplicatas,
  }
}

export function normalizarCnpj(cnpj: string): string {
  return onlyDigits(cnpj)
}
