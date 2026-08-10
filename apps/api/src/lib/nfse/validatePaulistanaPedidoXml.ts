/**
 * Confrontação estrutural do PedidoEnvioLoteRPS Paulistana (v1) antes da transmissão.
 * Não baixa XSD em runtime — regras versionadas no produto (espelha rejeições 1001 comuns).
 */

import { DOMParser } from '@xmldom/xmldom'
import { normalizePaulistanaCodigoServico } from './paulistanaCodigoServico'

export type NfseXmlValidationError = {
  path: string
  message: string
}

export type NfseXmlValidationResult = {
  ok: boolean
  errors: NfseXmlValidationError[]
}

function push(errors: NfseXmlValidationError[], path: string, message: string) {
  errors.push({ path, message })
}

function firstChild(parent: Element, local: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]
    if (n.nodeType === 1 && (n as Element).localName === local) return n as Element
  }
  return null
}

function childrenByLocal(parent: Element, local: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]
    if (n.nodeType === 1 && (n as Element).localName === local) out.push(n as Element)
  }
  return out
}

function text(el: Element | null): string {
  return (el?.textContent ?? '').trim()
}

/**
 * Valida PedidoEnvioLoteRPS assinado (ou não) contra regras estruturais Paulistana v1.
 */
export function validatePaulistanaPedidoXml(xml: string): NfseXmlValidationResult {
  const errors: NfseXmlValidationError[] = []
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const root = doc.documentElement
  if (!root) {
    push(errors, '/', 'XML sem elemento raiz.')
    return { ok: false, errors }
  }

  if (root.localName !== 'PedidoEnvioLoteRPS') {
    push(errors, '/', `Raiz esperada PedidoEnvioLoteRPS; encontrado ${root.localName}.`)
    return { ok: false, errors }
  }

  // Erro 1001 explícito da Prefeitura: atributo Id não declarado no XSD v1.
  if (root.hasAttribute('Id') || root.hasAttribute('id')) {
    push(
      errors,
      'PedidoEnvioLoteRPS/@Id',
      'Atributo Id não é declarado no schema Paulistana v1 (rejeição 1001). Remova e assine com Reference URI="".',
    )
  }

  const cab = firstChild(root, 'Cabecalho')
  if (!cab) {
    push(errors, 'PedidoEnvioLoteRPS', 'Cabecalho obrigatório ausente.')
  } else {
    if (!text(firstChild(firstChild(cab, 'CPFCNPJRemetente'), 'CNPJ'))) {
      push(errors, 'Cabecalho/CPFCNPJRemetente/CNPJ', 'CNPJ do remetente obrigatório.')
    }
    for (const tag of ['dtInicio', 'dtFim', 'QtdRPS', 'ValorTotalServicos', 'ValorTotalDeducoes'] as const) {
      if (!text(firstChild(cab, tag))) {
        push(errors, `Cabecalho/${tag}`, `${tag} obrigatório no layout v1.`)
      }
    }
  }

  const lote = firstChild(root, 'Lote')
  if (lote) {
    push(
      errors,
      'PedidoEnvioLoteRPS/Lote',
      'Wrapper Lote não faz parte do PedidoEnvioLoteRPS v1 síncrono — RPS deve ser filho direto do Pedido.',
    )
  }

  const rpsList = childrenByLocal(root, 'RPS')
  if (rpsList.length < 1) {
    push(errors, 'PedidoEnvioLoteRPS', 'Pelo menos um RPS é obrigatório.')
  }

  for (let i = 0; i < rpsList.length; i++) {
    const rps = rpsList[i]!
    const base = `RPS[${i}]`
    const assinatura = text(firstChild(rps, 'Assinatura'))
    if (!assinatura) {
      push(errors, `${base}/Assinatura`, 'Assinatura posicional do RPS obrigatória (Base64).')
    }
    const chave = firstChild(rps, 'ChaveRPS')
    if (!chave) {
      push(errors, `${base}/ChaveRPS`, 'ChaveRPS obrigatória.')
    } else {
      for (const tag of ['InscricaoPrestador', 'SerieRPS', 'NumeroRPS'] as const) {
        if (!text(firstChild(chave, tag))) {
          push(errors, `${base}/ChaveRPS/${tag}`, `${tag} obrigatório.`)
        }
      }
    }
    for (const tag of [
      'TipoRPS',
      'DataEmissao',
      'StatusRPS',
      'TributacaoRPS',
      'ValorServicos',
      'CodigoServico',
      'Discriminacao',
    ] as const) {
      if (!text(firstChild(rps, tag))) {
        push(errors, `${base}/${tag}`, `${tag} obrigatório.`)
      }
    }
    const codServTxt = text(firstChild(rps, 'CodigoServico'))
    if (codServTxt) {
      const cod = normalizePaulistanaCodigoServico(codServTxt)
      if (!cod.ok) {
        push(errors, `${base}/CodigoServico`, cod.message)
      } else if (cod.codigo !== codServTxt) {
        push(
          errors,
          `${base}/CodigoServico`,
          `CodigoServico deve ter 5 dígitos municipais (encontrado "${codServTxt}", esperado "${cod.codigo}").`,
        )
      }
    }
    const aliq = firstChild(rps, 'AliquotaServicos') || firstChild(rps, 'Aliquota')
    if (!text(aliq)) {
      push(errors, `${base}/AliquotaServicos`, 'AliquotaServicos obrigatória (fração, ex.: 0.05).')
    } else if (aliq!.localName === 'Aliquota') {
      push(
        errors,
        `${base}/Aliquota`,
        'Use AliquotaServicos (nome do schema Paulistana), não Aliquota.',
      )
    }
    if (firstChild(rps, 'IBSCBS') || firstChild(rps, 'cLocPrestacao')) {
      push(
        errors,
        `${base}`,
        'Campos de reforma/IBSCBS ou cLocPrestacao não pertencem ao layout v1 síncrono usado aqui.',
      )
    }
  }

  const sig = firstChild(root, 'Signature')
  if (sig) {
    const signedInfo = firstChild(sig, 'SignedInfo')
    const ref = signedInfo ? firstChild(signedInfo, 'Reference') : null
    if (ref) {
      const uri = ref.getAttribute('URI')
      if (uri && uri.startsWith('#')) {
        push(
          errors,
          'Signature/SignedInfo/Reference/@URI',
          'Paulistana v1 deve usar Reference URI="" (sem Id no Pedido). URI com # indica layout antigo — regenere o XML.',
        )
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export function formatNfseXmlValidationErrors(errors: NfseXmlValidationError[]): string {
  return errors.map((e) => `${e.path}: ${e.message}`).join(' | ')
}
