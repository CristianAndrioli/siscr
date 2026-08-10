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

type PaulistanaIssue = { codigo: string; descricao: string }

/**
 * Coleta <Erro> e <Alerta> do RetornoEnvioLoteRPS (podem ser vários).
 * pickXmlTag sozinho pega só o primeiro <Codigo> e mascara o contexto.
 */
function collectPaulistanaIssues(xml: string): { erros: PaulistanaIssue[]; alertas: PaulistanaIssue[] } {
  const erros: PaulistanaIssue[] = []
  const alertas: PaulistanaIssue[] = []
  const blockRe = /<(?:[\w.-]+:)?(Erro|Alerta)\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(xml)) !== null) {
    const kind = m[1].toLowerCase()
    const body = m[2]
    const codigo = pickXmlTag(body, 'Codigo') || ''
    const descricao =
      pickXmlTag(body, 'Descricao') || pickXmlTag(body, 'Mensagem') || ''
    if (!codigo && !descricao) continue
    const issue = { codigo, descricao }
    if (kind === 'erro') erros.push(issue)
    else alertas.push(issue)
  }
  return { erros, alertas }
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
 *
 * Importante: TesteEnvioLoteRPS frequentemente devolve Cabecalho/Sucesso=true
 * mesmo com <Alerta> (ex.: 307 código não cadastrado no prestador). Isso NÃO
 * é autorização — só Sucesso sem Erro/Alerta (ou com NumeroNFe real) autoriza.
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
    const { erros, alertas } = collectPaulistanaIssues(decoded)
    const firstIssue = erros[0] || alertas[0]

    const sucessoOk = sucesso?.toLowerCase() === 'true'
    // Produção: precisa de NFS-e gerada. Homologação (teste): aceita Sucesso sem número,
    // mas nunca com Erro ou Alerta (307 etc. vinham como "autorizada" + protocolo TESTE).
    const autorizada =
      sucessoOk &&
      erros.length === 0 &&
      alertas.length === 0 &&
      (Boolean(numeroNfe) || teste)

    const cod =
      firstIssue?.codigo ||
      (autorizada ? (teste ? 'TESTE' : '100') : null) ||
      pickXmlTag(decoded, 'Codigo') ||
      pickXmlTag(text, 'Codigo') ||
      String(res.status)
    const desc =
      (firstIssue?.descricao || null) ||
      (autorizada
        ? teste
          ? 'Lote de teste aceito pela Prefeitura (TesteEnvioLoteRPS).'
          : 'RPS convertido / NFS-e autorizada pela Prefeitura.'
        : null) ||
      pickXmlTag(decoded, 'Descricao') ||
      pickXmlTag(decoded, 'Mensagem') ||
      (res.ok ? 'Retorno Paulistana' : extractPaulistanaErro(text, res.status))

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
