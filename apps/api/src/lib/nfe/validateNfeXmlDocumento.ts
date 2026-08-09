/**
 * Confrontação local do XML NF-e contra regras do leiaute 4.00 (MOC / NTs).
 * Não baixa XSD em runtime — regras versionadas no produto.
 * Objetivo: listar todos os problemas estruturais antes da SEFAZ (rejeição 225 etc.).
 */

import { DOMParser } from '@xmldom/xmldom'

export const NFE_LAYOUT_VERSION = '4.00'

export type NfeXmlValidationError = {
  path: string
  message: string
}

export type NfeXmlValidationResult = {
  ok: boolean
  layoutVersion: string
  errors: NfeXmlValidationError[]
}

const NS_NFE = 'http://www.portalfiscal.inf.br/nfe'
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#'
const SERIE_RE = /^(0|[1-9][0-9]{0,2})$/
const ICMSSN_RE = /^ICMSSN(101|102|103|201|202|203|300|400|500|900)$/
const ICMS_REGIME_NORMAL_RE = /^ICMS(00|10|20|30|40|41|50|51|60|70|90)$/

function push(errors: NfeXmlValidationError[], path: string, message: string) {
  errors.push({ path, message })
}

function textContent(el: Element | null): string {
  return (el?.textContent ?? '').trim()
}

function firstChild(parent: Element, local: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]
    if (n.nodeType === 1) {
      const e = n as Element
      if (e.localName === local) return e
    }
  }
  return null
}

function childrenByLocal(parent: Element, local: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]
    if (n.nodeType === 1) {
      const e = n as Element
      if (e.localName === local) out.push(e)
    }
  }
  return out
}

function maxLen(errors: NfeXmlValidationError[], path: string, value: string, max: number) {
  if (value.length > max) {
    push(errors, path, `Máximo ${max} caracteres (leiaute ${NFE_LAYOUT_VERSION}); atual: ${value.length}.`)
  }
}

/** Padrão XSD TString: não pode começar/terminar com espaço (rejeição 225). */
const TSTRING_RE = /^[!-ÿ](?:[ -ÿ]*[!-ÿ])?$/

function checkTString(errors: NfeXmlValidationError[], path: string, value: string, max: number) {
  if (!value) return
  maxLen(errors, path, value, max)
  if (!TSTRING_RE.test(value)) {
    push(
      errors,
      path,
      'Texto inválido no leiaute (TString): não pode começar/terminar com espaço nem conter caracteres de controle.',
    )
  }
}

/**
 * Valida o documento NFe (assinado ou não) contra regras do leiaute 4.00.
 * Acumula todos os erros — não para no primeiro.
 */
export function validateNfeXmlDocumento(xml: string): NfeXmlValidationResult {
  const errors: NfeXmlValidationError[] = []
  const raw = (xml || '').replace(/^\uFEFF/, '').trim()
  if (!raw) {
    return { ok: false, layoutVersion: NFE_LAYOUT_VERSION, errors: [{ path: '/', message: 'XML vazio.' }] }
  }

  let doc: Document
  try {
    const parser = new DOMParser({
      errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
    })
    doc = parser.parseFromString(raw, 'application/xml')
  } catch {
    return {
      ok: false,
      layoutVersion: NFE_LAYOUT_VERSION,
      errors: [{ path: '/', message: 'XML não pôde ser interpretado (parser).' }],
    }
  }

  const parseErr = doc.getElementsByTagName('parsererror')[0]
  if (parseErr) {
    push(errors, '/', `XML malformado: ${textContent(parseErr as Element).slice(0, 200)}`)
    return { ok: false, layoutVersion: NFE_LAYOUT_VERSION, errors }
  }

  const root = doc.documentElement
  if (!root || root.localName !== 'NFe') {
    push(errors, '/', 'Raiz do documento deve ser <NFe>.')
    return { ok: false, layoutVersion: NFE_LAYOUT_VERSION, errors }
  }
  const ns = root.namespaceURI || ''
  if (ns && ns !== NS_NFE) {
    push(errors, '/NFe', `Namespace inválido (esperado ${NS_NFE}).`)
  }

  // XML antigo / gerador incorreto: ICMS102 em vez de ICMSSN102
  if (/<ICMS\d{3}\b/.test(raw) && !/<ICMSSN\d{3}\b/.test(raw)) {
    push(
      errors,
      '/NFe/infNFe/det/imposto/ICMS',
      'Grupo ICMS inválido para Simples (ex.: ICMS102). Use ICMSSN* — regenere o XML (Preparar XML).',
    )
  }

  const infNFe = firstChild(root, 'infNFe')
  if (!infNFe) {
    push(errors, '/NFe', 'Elemento infNFe ausente.')
    return { ok: false, layoutVersion: NFE_LAYOUT_VERSION, errors }
  }

  const versao = infNFe.getAttribute('versao') || ''
  if (versao !== NFE_LAYOUT_VERSION) {
    push(errors, '/NFe/infNFe/@versao', `Versão do leiaute deve ser ${NFE_LAYOUT_VERSION} (atual: "${versao}").`)
  }

  const idAttr = infNFe.getAttribute('Id') || ''
  if (!/^NFe\d{44}$/.test(idAttr)) {
    push(errors, '/NFe/infNFe/@Id', 'Id deve ser NFe + chave de 44 dígitos.')
  }

  const ide = firstChild(infNFe, 'ide')
  if (!ide) {
    push(errors, '/NFe/infNFe', 'ide ausente.')
  } else {
    const serie = textContent(firstChild(ide, 'serie'))
    if (!SERIE_RE.test(serie)) {
      push(
        errors,
        '/NFe/infNFe/ide/serie',
        `Série inválida ("${serie}"). Use 0 ou 1–999 sem zeros à esquerda (ex.: 1, não 001).`,
      )
    }
    const cNF = textContent(firstChild(ide, 'cNF'))
    if (!/^\d{8}$/.test(cNF)) {
      push(errors, '/NFe/infNFe/ide/cNF', 'cNF deve ter exatamente 8 dígitos.')
    }
    const mod = textContent(firstChild(ide, 'mod'))
    if (mod !== '55' && mod !== '65') {
      push(errors, '/NFe/infNFe/ide/mod', `mod deve ser 55 ou 65 (atual: "${mod}").`)
    }
    const tpAmb = textContent(firstChild(ide, 'tpAmb'))
    if (tpAmb !== '1' && tpAmb !== '2') {
      push(errors, '/NFe/infNFe/ide/tpAmb', 'tpAmb deve ser 1 (produção) ou 2 (homologação).')
    }
    checkTString(errors, '/NFe/infNFe/ide/natOp', textContent(firstChild(ide, 'natOp')), 60)
    checkTString(errors, '/NFe/infNFe/ide/verProc', textContent(firstChild(ide, 'verProc')), 20)
  }

  const emit = firstChild(infNFe, 'emit')
  let crt = '1'
  if (!emit) {
    push(errors, '/NFe/infNFe', 'emit ausente.')
  } else {
    const cnpj = textContent(firstChild(emit, 'CNPJ'))
    if (!/^\d{14}$/.test(cnpj)) {
      push(errors, '/NFe/infNFe/emit/CNPJ', 'CNPJ do emitente deve ter 14 dígitos.')
    }
    checkTString(errors, '/NFe/infNFe/emit/xNome', textContent(firstChild(emit, 'xNome')), 60)
    const xFant = firstChild(emit, 'xFant')
    if (xFant) checkTString(errors, '/NFe/infNFe/emit/xFant', textContent(xFant), 60)
    crt = textContent(firstChild(emit, 'CRT')) || '1'
    if (!/^[123]$/.test(crt)) {
      push(errors, '/NFe/infNFe/emit/CRT', 'CRT deve ser 1, 2 ou 3.')
    }
    const ender = firstChild(emit, 'enderEmit')
    if (!ender) {
      push(errors, '/NFe/infNFe/emit', 'enderEmit ausente.')
    } else {
      checkTString(errors, '/NFe/infNFe/emit/enderEmit/xLgr', textContent(firstChild(ender, 'xLgr')), 60)
      checkTString(errors, '/NFe/infNFe/emit/enderEmit/nro', textContent(firstChild(ender, 'nro')), 60)
      const xCpl = firstChild(ender, 'xCpl')
      if (xCpl) checkTString(errors, '/NFe/infNFe/emit/enderEmit/xCpl', textContent(xCpl), 60)
      checkTString(errors, '/NFe/infNFe/emit/enderEmit/xBairro', textContent(firstChild(ender, 'xBairro')), 60)
      checkTString(errors, '/NFe/infNFe/emit/enderEmit/xMun', textContent(firstChild(ender, 'xMun')), 60)
      const cMun = textContent(firstChild(ender, 'cMun'))
      if (!/^\d{7}$/.test(cMun)) {
        push(errors, '/NFe/infNFe/emit/enderEmit/cMun', 'cMun (IBGE) deve ter 7 dígitos.')
      }
      const cep = textContent(firstChild(ender, 'CEP'))
      if (!/^\d{8}$/.test(cep)) {
        push(errors, '/NFe/infNFe/emit/enderEmit/CEP', 'CEP deve ter 8 dígitos.')
      }
    }
  }

  const dest = firstChild(infNFe, 'dest')
  if (dest) {
    checkTString(errors, '/NFe/infNFe/dest/xNome', textContent(firstChild(dest, 'xNome')), 60)
    const ender = firstChild(dest, 'enderDest')
    if (ender) {
      checkTString(errors, '/NFe/infNFe/dest/enderDest/xLgr', textContent(firstChild(ender, 'xLgr')), 60)
      checkTString(errors, '/NFe/infNFe/dest/enderDest/nro', textContent(firstChild(ender, 'nro')), 60)
      const xCpl = firstChild(ender, 'xCpl')
      if (xCpl) checkTString(errors, '/NFe/infNFe/dest/enderDest/xCpl', textContent(xCpl), 60)
      checkTString(errors, '/NFe/infNFe/dest/enderDest/xBairro', textContent(firstChild(ender, 'xBairro')), 60)
      checkTString(errors, '/NFe/infNFe/dest/enderDest/xMun', textContent(firstChild(ender, 'xMun')), 60)
      const cMun = textContent(firstChild(ender, 'cMun'))
      if (cMun && !/^\d{7}$/.test(cMun)) {
        push(errors, '/NFe/infNFe/dest/enderDest/cMun', 'cMun (IBGE) deve ter 7 dígitos.')
      }
    }
  }

  const dets = childrenByLocal(infNFe, 'det')
  if (dets.length === 0) {
    push(errors, '/NFe/infNFe', 'Nenhum item (det) encontrado.')
  }
  const isSimples = crt === '1' || crt === '2'
  dets.forEach((det, idx) => {
    const nItem = det.getAttribute('nItem') || String(idx + 1)
    const base = `/NFe/infNFe/det[${nItem}]`
    const prod = firstChild(det, 'prod')
    if (!prod) {
      push(errors, base, 'prod ausente.')
      return
    }
    checkTString(errors, `${base}/prod/cProd`, textContent(firstChild(prod, 'cProd')), 60)
    checkTString(errors, `${base}/prod/xProd`, textContent(firstChild(prod, 'xProd')), 120)
    const ncm = textContent(firstChild(prod, 'NCM'))
    if (!/^\d{8}$/.test(ncm)) {
      push(errors, `${base}/prod/NCM`, 'NCM deve ter 8 dígitos.')
    }
    const cfop = textContent(firstChild(prod, 'CFOP'))
    if (!/^\d{4}$/.test(cfop)) {
      push(errors, `${base}/prod/CFOP`, 'CFOP deve ter 4 dígitos.')
    }
    if (!firstChild(prod, 'cEAN')) {
      push(errors, `${base}/prod/cEAN`, 'cEAN ausente (use SEM GTIN se não houver).')
    }
    if (!firstChild(prod, 'cEANTrib')) {
      push(errors, `${base}/prod/cEANTrib`, 'cEANTrib ausente.')
    }

    const imposto = firstChild(det, 'imposto')
    const icmsParent = imposto ? firstChild(imposto, 'ICMS') : null
    if (!icmsParent) {
      push(errors, `${base}/imposto/ICMS`, 'Grupo ICMS ausente.')
    } else {
      let icmsChild: Element | null = null
      for (let i = 0; i < icmsParent.childNodes.length; i++) {
        const n = icmsParent.childNodes[i]
        if (n.nodeType === 1) {
          icmsChild = n as Element
          break
        }
      }
      if (!icmsChild) {
        push(errors, `${base}/imposto/ICMS`, 'Subgrupo de ICMS/CSOSN ausente.')
      } else {
        const tag = icmsChild.localName
        if (isSimples) {
          if (!ICMSSN_RE.test(tag)) {
            push(
              errors,
              `${base}/imposto/ICMS/${tag}`,
              `CRT ${crt} (Simples) exige grupo ICMSSN* (ex.: ICMSSN102), não "${tag}".`,
            )
          }
        } else if (!ICMS_REGIME_NORMAL_RE.test(tag) && !ICMSSN_RE.test(tag)) {
          push(errors, `${base}/imposto/ICMS/${tag}`, `Grupo ICMS "${tag}" não reconhecido no leiaute.`)
        }
      }
    }
  })

  const pag = firstChild(infNFe, 'pag')
  if (pag) {
    for (const detPag of childrenByLocal(pag, 'detPag')) {
      const tPag = textContent(firstChild(detPag, 'tPag'))
      const xPag = firstChild(detPag, 'xPag')
      if (tPag === '99') {
        const desc = textContent(xPag)
        if (!desc) {
          push(errors, '/NFe/infNFe/pag/detPag/xPag', 'tPag=99 (Outros) exige xPag com a descrição do pagamento.')
        } else {
          checkTString(errors, '/NFe/infNFe/pag/detPag/xPag', desc, 60)
        }
      } else if (xPag && textContent(xPag)) {
        push(errors, '/NFe/infNFe/pag/detPag/xPag', 'xPag só é permitido quando tPag=99.')
      }
    }
  }

  const resp = firstChild(infNFe, 'infRespTec')
  if (!resp) {
    push(errors, '/NFe/infNFe/infRespTec', 'infRespTec é obrigatório (NT 2018.005).')
  } else {
    const cnpj = textContent(firstChild(resp, 'CNPJ'))
    if (!/^\d{14}$/.test(cnpj)) {
      push(errors, '/NFe/infNFe/infRespTec/CNPJ', 'CNPJ do responsável técnico deve ter 14 dígitos.')
    }
    checkTString(errors, '/NFe/infNFe/infRespTec/xContato', textContent(firstChild(resp, 'xContato')), 60)
    const email = textContent(firstChild(resp, 'email'))
    if (!email || !email.includes('@')) {
      push(errors, '/NFe/infNFe/infRespTec/email', 'email do responsável técnico inválido.')
    }
    const fone = textContent(firstChild(resp, 'fone'))
    if (!/^\d{6,14}$/.test(fone)) {
      push(errors, '/NFe/infNFe/infRespTec/fone', 'fone deve ter 6 a 14 dígitos.')
    }
  }

  // Signature (opcional no unsigned; obrigatória antes de transmitir — checada pelo caller)
  const sigList = root.getElementsByTagNameNS(NS_DS, 'Signature')
  const sigFallback = root.getElementsByTagName('Signature')
  const sig =
    sigList.length > 0 ? sigList[0]! : sigFallback.length > 0 ? (sigFallback[0] as Element) : null
  if (sig) {
    const refs = sig.getElementsByTagNameNS(NS_DS, 'Reference')
    const refs2 = refs.length ? refs : sig.getElementsByTagName('Reference')
    const ref = refs2[0] as Element | undefined
    const uri = ref?.getAttribute('URI') || ''
    if (idAttr && uri !== `#${idAttr}`) {
      push(
        errors,
        '/NFe/Signature/SignedInfo/Reference/@URI',
        `URI da assinatura ("${uri}") deve referenciar #${idAttr}.`,
      )
    }
    const certs = sig.getElementsByTagNameNS(NS_DS, 'X509Certificate')
    const certs2 = certs.length ? certs : sig.getElementsByTagName('X509Certificate')
    if (certs2.length === 0) {
      push(errors, '/NFe/Signature/KeyInfo', 'X509Certificate ausente na assinatura.')
    }
  }

  return {
    ok: errors.length === 0,
    layoutVersion: NFE_LAYOUT_VERSION,
    errors,
  }
}

/** Formata lista de erros para mensagem agregada (API / logs). */
export function formatNfeXmlValidationErrors(errors: NfeXmlValidationError[]): string {
  return errors.map((e) => `${e.path}: ${e.message}`).join(' | ')
}
