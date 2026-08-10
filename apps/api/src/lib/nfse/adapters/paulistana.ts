import type { Env } from '../../../index'
import { postViaSefazBridge } from '../nfseBridgeTransport'
import type { NfseMunicipalAdapter, NfseTransmitInput, NfseTransmitResult } from '../types'
import {
  wrapPaulistanaSoap,
  PAULISTANA_LOTE_URL,
  paulistanaSoapAction,
} from '../buildPaulistanaRps'

function pickXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w.-]+:)?${tag}>`, 'i')
  const m = xml.match(re)
  return m?.[1]?.trim() || null
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Extrai mensagem útil de SOAP Fault / HTML ASP.NET / corpo bruto. */
function extractPaulistanaErro(text: string, httpStatus: number): string {
  const fault =
    pickXmlTag(text, 'faultstring') ||
    pickXmlTag(text, 'FaultString') ||
    pickXmlTag(text, 'faultstring')
  if (fault) return fault.slice(0, 400)

  const desc = pickXmlTag(text, 'Descricao') || pickXmlTag(text, 'Mensagem')
  if (desc) return desc.slice(0, 400)

  const retornoXml = pickXmlTag(text, 'RetornoXML')
  if (retornoXml) {
    const inner = decodeXmlEntities(retornoXml)
    const innerDesc = pickXmlTag(inner, 'Descricao') || pickXmlTag(inner, 'Mensagem')
    if (innerDesc) return innerDesc.slice(0, 400)
  }

  const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  if (title) return title.slice(0, 300)

  const h1 = text.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
  if (h1) return h1.slice(0, 300)

  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact) return `HTTP ${httpStatus}: ${compact.slice(0, 280)}`
  return `HTTP ${httpStatus}`
}

/**
 * Adapter São Paulo capital — Nota Fiscal Paulistana (SOAP LoteNFe).
 * Homologação: mesmo endpoint + TesteEnvioLoteRPS (não há URL separada).
 */
export const paulistanaAdapter: NfseMunicipalAdapter = {
  kind: 'paulistana',

  async transmitir(env: Env, tenantId: string, input: NfseTransmitInput): Promise<NfseTransmitResult> {
    const teste = input.ambiente === 2
    const soap = wrapPaulistanaSoap(input.xmlAssinado, teste)

    const res = await postViaSefazBridge(env, tenantId, {
      targetUrl: PAULISTANA_LOTE_URL,
      body: soap,
      cert: input.cert,
      contentType: 'text/xml; charset=utf-8',
      soapAction: paulistanaSoapAction(teste),
    })

    const text = res.text
    // Resposta Paulistana costuma vir com RetornoXML escapado
    const decoded = (() => {
      const retorno = pickXmlTag(text, 'RetornoXML')
      return retorno ? decodeXmlEntities(retorno) : text
    })()

    const sucesso = pickXmlTag(decoded, 'Sucesso') || pickXmlTag(text, 'Sucesso')
    const numeroNfe =
      pickXmlTag(decoded, 'NumeroNFe') ||
      pickXmlTag(decoded, 'NumeroNfe') ||
      pickXmlTag(text, 'NumeroNFe')
    const cod = pickXmlTag(decoded, 'Codigo') || pickXmlTag(text, 'Codigo') || String(res.status)
    const desc =
      pickXmlTag(decoded, 'Descricao') ||
      pickXmlTag(decoded, 'Mensagem') ||
      (res.ok ? 'Retorno Paulistana' : extractPaulistanaErro(text, res.status))

    // TesteEnvioLoteRPS: Sucesso=true sem NFS-e real — tratamos como ok operacional em homologação
    const autorizada =
      sucesso?.toLowerCase() === 'true' ||
      Boolean(numeroNfe) ||
      (teste && res.ok && !/false/i.test(sucesso || ''))

    return {
      autorizada,
      protocolo: numeroNfe || (teste && autorizada ? 'TESTE' : null),
      chaveAcesso: null,
      cStat: cod,
      xMotivo: desc,
      xmlRetorno: text,
      dhRecbto: new Date().toISOString(),
    }
  },
}
