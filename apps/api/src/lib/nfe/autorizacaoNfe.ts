/**
 * Cliente SOAP NFeAutorizacao4 (envio síncrono indSinc=1).
 *
 * Transporte: mesma ponte mTLS do DFe (Conexão "sefaz-dfe" + header X-Sefaz-Url).
 * Workers não fazem mTLS dinâmico por tenant — ver doc/integracoes-contabilidade.md §2.3.
 */

import type { Env } from '../../index'
import { DFE_CONEXAO_NOME } from '../dfe/distribuicaoDfe'
import { postSoapViaSefazBridge, type SefazBridgeCert } from './sefazBridgeTransport'

/** URLs NFeAutorizacao4 por UF (homologação / produção). Expandir conforme necessidade. */
const URLS_AUTORIZACAO: Record<string, { prod: string; hom: string }> = {
  SP: {
    prod: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    hom: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
  },
}

export type AutorizacaoNfeResult = {
  cStat: string
  xMotivo: string
  /** Protocolo de autorização (nProt), se autorizado */
  nProt: string | null
  dhRecbto: string | null
  /** true quando cStat do protocolo é 100 ou 150 */
  autorizada: boolean
  /** XML nfeProc (NFe + protNFe) quando disponível */
  procNfeXml: string | null
  rawSoap: string
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1]!.trim() : null
}

function stripXmlDecl(xml: string): string {
  return xml.replace(/^\uFEFF?<\?xml[^?]*\?>\s*/i, '').trim()
}

/** Extrai o elemento <NFe>...</NFe> (com assinatura) do XML armazenado. */
export function extractNfeElement(xmlAssinado: string): string {
  const m = xmlAssinado.match(/<NFe\b[\s\S]*<\/NFe>/i)
  if (!m) throw new Error('XML assinado sem elemento <NFe> — regenere o XML.')
  return m[0]
}

export function resolveAutorizacaoUrl(uf: string, tpAmb: 1 | 2): string {
  const u = (uf || 'SP').trim().toUpperCase()
  const entry = URLS_AUTORIZACAO[u]
  if (!entry) {
    throw new Error(
      `UF ${u} ainda não tem URL de autorização NF-e mapeada neste sistema. Use emitente SP ou amplie o mapa de webservices.`,
    )
  }
  return tpAmb === 1 ? entry.prod : entry.hom
}

/**
 * Envelope SOAP 1.2 + enviNFe 4.00 (lote síncrono).
 * idLote: até 15 dígitos.
 */
export function buildNfeAutorizacaoSoapEnvelope(xmlAssinado: string, idLote: string): string {
  const nfe = extractNfeElement(xmlAssinado)
  const lote = idLote.replace(/\D/g, '').padStart(15, '0').slice(-15)
  const envi =
    `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<idLote>${lote}</idLote>` +
    `<indSinc>1</indSinc>` +
    `${nfe}` +
    `</enviNFe>`

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">` +
    `${envi}` +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  )
}

/** Monta nfeProc a partir do NFe assinado + bloco protNFe da resposta. */
export function buildProcNfeXml(xmlAssinado: string, protNfeXml: string): string {
  const nfe = extractNfeElement(xmlAssinado)
  const prot = stripXmlDecl(protNfeXml).match(/<protNFe\b[\s\S]*<\/protNFe>/i)?.[0]
  if (!prot) throw new Error('Resposta SEFAZ sem protNFe.')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `${nfe}${prot}` +
    `</nfeProc>`
  )
}

export function parseRetEnviNFe(soapXml: string, xmlAssinado: string): AutorizacaoNfeResult {
  // Preferir cStat do protocolo (infProt); senão do retEnviNFe
  const infProt = soapXml.match(/<infProt\b[\s\S]*?<\/infProt>/i)?.[0] ?? ''
  const cStatProt = tag(infProt, 'cStat')
  const xMotivoProt = tag(infProt, 'xMotivo')
  const cStatLote = tag(soapXml, 'cStat')
  const xMotivoLote = tag(soapXml, 'xMotivo')

  const cStat = cStatProt || cStatLote || ''
  const xMotivo = xMotivoProt || xMotivoLote || ''
  if (!cStat) {
    throw new Error('Resposta da SEFAZ sem cStat — envelope inesperado.')
  }

  const nProt = tag(infProt, 'nProt')
  const dhRecbto = tag(infProt, 'dhRecbto')
  const autorizada = cStat === '100' || cStat === '150'

  let procNfeXml: string | null = null
  if (autorizada) {
    const protBlock = soapXml.match(/<protNFe\b[\s\S]*?<\/protNFe>/i)?.[0]
    if (protBlock) {
      try {
        procNfeXml = buildProcNfeXml(xmlAssinado, protBlock)
      } catch {
        procNfeXml = null
      }
    }
  }

  return {
    cStat,
    xMotivo,
    nProt: nProt || null,
    dhRecbto: dhRecbto || null,
    autorizada,
    procNfeXml,
    rawSoap: soapXml,
  }
}

export async function enviarNfeAutorizacao(
  env: Env,
  tenantId: string,
  params: {
    tpAmb: 1 | 2
    ufEmitente: string
    xmlAssinado: string
    idLote?: string
    /** A1 do emitente — obrigatório para a ponte mTLS. */
    cert: SefazBridgeCert
  },
): Promise<AutorizacaoNfeResult> {
  const idLote = params.idLote ?? String(Date.now()).slice(-15)
  const envelope = buildNfeAutorizacaoSoapEnvelope(params.xmlAssinado, idLote)
  const sefazUrl = resolveAutorizacaoUrl(params.ufEmitente, params.tpAmb)

  const res = await postSoapViaSefazBridge(env, tenantId, {
    sefazUrl,
    soapBody: envelope,
    cert: params.cert,
  })

  if (!res.ok) {
    throw new Error(
      `Falha na autorização NF-e: ponte "${DFE_CONEXAO_NOME}" respondeu HTTP ${res.status}. ${res.text.slice(0, 240)}`,
    )
  }

  return parseRetEnviNFe(res.text, params.xmlAssinado)
}
