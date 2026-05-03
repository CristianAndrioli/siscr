import { DOMParser } from '@xmldom/xmldom'
import type { DeteccaoFiscalXml, FiscalXmlFamily } from './types'

function walkHasLocalName(root: Node, local: string, maxDepth: number): boolean {
  if (maxDepth < 0) return false
  if (root.nodeType === 1) {
    const e = root as Element
    const ln = e.localName || e.nodeName.replace(/^.*:/, '')
    if (ln === local) return true
  }
  for (const c of Array.from(root.childNodes)) {
    if (walkHasLocalName(c, local, maxDepth - 1)) return true
  }
  return false
}

/**
 * Identifica a família do XML **sem** aplicar o parser completo de NF-e.
 * - NF-e / NFC-e (ICMS): presença de `infNFe` no documento (layout nacional).
 * - NFS-e: heurística em tags comuns (ABRASF / mensagens municipais / nacional); pode evoluir com XSD.
 */
export function detectarFamiliaXmlFiscal(xmlString: string): DeteccaoFiscalXml {
  const trimmed = xmlString.trim()
  if (!trimmed.startsWith('<')) {
    return { family: 'desconhecido', motivo: 'Conteúdo não parece XML.' }
  }

  const parser = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} } })
  const doc = parser.parseFromString(trimmed, 'application/xml')
  const root = doc.documentElement
  if (!root) {
    return { family: 'desconhecido', motivo: 'XML sem elemento raiz.' }
  }

  const ns = root.namespaceURI || ''
  const rootLn = root.localName || root.nodeName.replace(/^.*:/, '')

  // Layout NF-e / NFC-e (mesmo schema): sempre há infNFe dentro de NFe ou enviNFe etc.
  if (walkHasLocalName(root, 'infNFe', 24)) {
    return { family: 'nfe_icms' }
  }

  // Namespace oficial NF-e (às vezes só aparece em filhos)
  if (ns.includes('portalfiscal.inf.br/nfe') || trimmed.includes('portalfiscal.inf.br/nfe')) {
    return { family: 'nfe_icms' }
  }

  // NFS-e: raízes / tags frequentes (evolutivo; parser definitivo validará XSD)
  const nfseHints =
    /<(NFSe|ListaNfse|GerarNfseResposta|ConsultarNfse)[\s>]|<[^>]*nfse[\s>]|<[^>]*Nfse[\s>]/i.test(trimmed) ||
    ns.toLowerCase().includes('nfse')
  if (nfseHints || rootLn.toLowerCase().includes('nfse')) {
    return { family: 'nfse', observacao: 'Verificar variante municipal ou NFS-e nacional (XSD).' }
  }

  return {
    family: 'desconhecido',
    motivo:
      'Não foi possível classificar o XML. Esperado: NF-e/NFC-e (layout infNFe) ou arquivo NFS-e reconhecível.',
  }
}

/** Retorna mensagem de erro HTTP ou `null` se a família é `nfe_icms` (NF-e / NFC-e). */
export function erroSeFamiliaNaoSuportadaEntrada(det: DeteccaoFiscalXml): string | null {
  if (det.family === 'nfe_icms') return null
  if (det.family === 'nfse') {
    return (
      'Este XML parece ser NFS-e (serviços / ISS). A importação de NFS-e como entrada ainda não está disponível; ' +
      'utilize arquivos NF-e ou NFC-e do Portal Fiscal (ICMS), ou aguarde o módulo NFS-e.'
    )
  }
  return det.motivo
}

export function familyParaLabel(f: FiscalXmlFamily): string {
  switch (f) {
    case 'nfe_icms':
      return 'NF-e / NFC-e (ICMS)'
    case 'nfse':
      return 'NFS-e (ISS)'
    default:
      return 'Desconhecido'
  }
}
