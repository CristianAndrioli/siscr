/**
 * Cliente do webservice NFeDistribuicaoDFe (Ambiente Nacional da NF-e).
 *
 * Permite baixar os documentos fiscais emitidos contra o CNPJ da empresa
 * (resumos resNFe, XMLs completos procNFe e eventos), de forma incremental
 * por NSU. Serviço público e gratuito da SEFAZ.
 *
 * TRANSPORTE / mTLS: os webservices da SEFAZ exigem TLS mútuo com o
 * certificado A1 do interessado. O fetch do Cloudflare Workers não anexa
 * certificado de cliente por requisição, então o transporte é abstraído:
 * se existir uma Conexão (Configurações → Conexões) com nome "sefaz-dfe",
 * o envelope SOAP é enviado através dela (ponte HTTPS→mTLS); sem a ponte,
 * tenta-se a chamada direta e o erro fica registrado em dfe_sync.
 * Ver doc/integracoes-contabilidade.md §2.3.
 */

import type { Env } from '../../index'
import { decryptA1Bundle } from '../certBlob'
import { postSoapViaSefazBridge } from '../nfe/sefazBridgeTransport'

export const DFE_CONEXAO_NOME = 'sefaz-dfe'

const URL_PRODUCAO = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const URL_HOMOLOGACAO = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface DistDfeParams {
  /** 1 = produção, 2 = homologação */
  tpAmb: 1 | 2
  /** Código IBGE da UF do autor (ex: 41 = PR) */
  cUfAutor: number
  /** CNPJ do interessado (somente dígitos) */
  cnpj: string
  /** Último NSU já processado (o serviço devolve a partir do seguinte) */
  ultNsu: string
}

export interface DfeDocZip {
  nsu: string
  schema: string
  /** XML já descompactado (gunzip do docZip) */
  xml: string
}

export interface DistDfeResult {
  cStat: string
  xMotivo: string
  ultNsu: string
  maxNsu: string
  /** 138 = documentos localizados; 137 = nenhum documento */
  documentos: DfeDocZip[]
}

/** Metadados extraídos de um resNFe ou procNFe para exibição em lista. */
export interface DfeDocMeta {
  tipo: 'resumo' | 'nfe_completa' | 'evento'
  chaveAcesso: string | null
  emitenteCnpj: string | null
  emitenteNome: string | null
  valorTotal: number | null
  dhEmissao: string | null
}

// ─── Montagem do envelope ────────────────────────────────────────────────────

function pad15(nsu: string): string {
  return nsu.replace(/\D/g, '').padStart(15, '0')
}

export function buildDistDfeSoapEnvelope(p: DistDfeParams): string {
  const dist =
    `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
    `<tpAmb>${p.tpAmb}</tpAmb>` +
    `<cUFAutor>${p.cUfAutor}</cUFAutor>` +
    `<CNPJ>${p.cnpj.replace(/\D/g, '')}</CNPJ>` +
    `<distNSU><ultNSU>${pad15(p.ultNsu)}</ultNSU></distNSU>` +
    `</distDFeInt>`

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
    `<nfeDadosMsg>${dist}</nfeDadosMsg>` +
    `</nfeDistDFeInteresse>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  )
}

// ─── Parse da resposta ───────────────────────────────────────────────────────

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : null
}

async function gunzipBase64(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64.replace(/\s/g, '')), (ch) => ch.charCodeAt(0))
  const ds = new DecompressionStream('gzip')
  const stream = new Blob([bytes]).stream().pipeThrough(ds)
  return new Response(stream).text()
}

export async function parseRetDistDfe(soapXml: string): Promise<DistDfeResult> {
  const cStat = tag(soapXml, 'cStat')
  const xMotivo = tag(soapXml, 'xMotivo')
  if (!cStat) {
    throw new Error('Resposta da SEFAZ sem cStat — envelope inesperado.')
  }

  const documentos: DfeDocZip[] = []
  const re = /<docZip\s+([^>]*)>([\s\S]*?)<\/docZip>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(soapXml)) !== null) {
    const attrs = m[1]
    const nsu = attrs.match(/NSU="(\d+)"/)?.[1] ?? ''
    const schema = attrs.match(/schema="([^"]+)"/)?.[1] ?? ''
    const xml = await gunzipBase64(m[2])
    documentos.push({ nsu, schema, xml })
  }

  return {
    cStat,
    xMotivo: xMotivo ?? '',
    ultNsu: tag(soapXml, 'ultNSU') ?? '0',
    maxNsu: tag(soapXml, 'maxNSU') ?? '0',
    documentos,
  }
}

/** Extrai metadados de exibição de um documento distribuído. */
export function extractDocMeta(schema: string, xml: string): DfeDocMeta {
  const isEvento = /evento/i.test(schema)
  const isProc = /^procNFe/i.test(schema)

  if (isEvento) {
    return {
      tipo: 'evento',
      chaveAcesso: tag(xml, 'chNFe'),
      emitenteCnpj: tag(xml, 'CNPJ'),
      emitenteNome: tag(xml, 'xNome'),
      valorTotal: null,
      dhEmissao: tag(xml, 'dhEvento'),
    }
  }

  if (isProc) {
    // procNFe: XML completo — chave no atributo Id da infNFe, emit dentro de <emit>
    const chave = xml.match(/Id="NFe(\d{44})"/)?.[1] ?? tag(xml, 'chNFe')
    const emit = xml.match(/<emit>([\s\S]*?)<\/emit>/)?.[1] ?? ''
    const vNF = tag(xml, 'vNF')
    return {
      tipo: 'nfe_completa',
      chaveAcesso: chave,
      emitenteCnpj: tag(emit, 'CNPJ'),
      emitenteNome: tag(emit, 'xNome'),
      valorTotal: vNF ? Number(vNF) : null,
      dhEmissao: tag(xml, 'dhEmi'),
    }
  }

  // resNFe: resumo
  const vNF = tag(xml, 'vNF')
  return {
    tipo: 'resumo',
    chaveAcesso: tag(xml, 'chNFe'),
    emitenteCnpj: tag(xml, 'CNPJ'),
    emitenteNome: tag(xml, 'xNome'),
    valorTotal: vNF ? Number(vNF) : null,
    dhEmissao: tag(xml, 'dhEmi'),
  }
}

// ─── Consulta (com transporte abstraído) ─────────────────────────────────────

export async function consultarDistribuicaoDfe(
  env: Env,
  tenantId: string,
  params: DistDfeParams & {
    /** Escopo do A1 no R2: empresaId ou `filial:${id}` */
    certScopeKey: string
    a1ObjectKey: string
  },
): Promise<DistDfeResult> {
  if (!env.CERT_BLOB_SECRET?.trim()) {
    throw new Error('CERT_BLOB_SECRET não configurado — impossível ler o certificado A1.')
  }
  if (!env.R2_STORAGE) {
    throw new Error('R2_STORAGE não configurado — impossível ler o certificado A1.')
  }

  const certObj = await env.R2_STORAGE.get(params.a1ObjectKey)
  if (!certObj) {
    throw new Error('Arquivo do certificado A1 não encontrado no armazenamento.')
  }
  const bundle = await decryptA1Bundle(
    env.CERT_BLOB_SECRET,
    tenantId,
    params.certScopeKey,
    await certObj.arrayBuffer(),
  )

  const envelope = buildDistDfeSoapEnvelope(params)
  const sefazUrl = params.tpAmb === 1 ? URL_PRODUCAO : URL_HOMOLOGACAO

  const res = await postSoapViaSefazBridge(env, tenantId, {
    sefazUrl,
    soapBody: envelope,
    cert: { pfxBytes: bundle.pfxBytes, password: bundle.password },
  })

  if (!res.ok) {
    throw new Error(
      `Falha na consulta DFe: ponte "${DFE_CONEXAO_NOME}" respondeu HTTP ${res.status}. ${res.text.slice(0, 200)}`,
    )
  }

  return parseRetDistDfe(res.text)
}
