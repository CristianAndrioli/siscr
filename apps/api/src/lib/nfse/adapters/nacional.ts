import type { Env } from '../../../index'
import { postViaSefazBridge } from '../nfseBridgeTransport'
import type { NfseMunicipalAdapter, NfseTransmitInput, NfseTransmitResult } from '../types'

/** Sefin Nacional — Ambiente de Dados Nacional (contribuintes). */
export const SEFIN_NACIONAL_PROD = 'https://sefin.nfse.gov.br/SefinNacional'
export const SEFIN_NACIONAL_HOM = 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'

function sefinBase(ambiente: 1 | 2): string {
  return ambiente === 1 ? SEFIN_NACIONAL_PROD : SEFIN_NACIONAL_HOM
}

function pickXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w.-]+:)?${tag}>`, 'i')
  const m = xml.match(re)
  return m?.[1]?.trim() || null
}

function tryParseJsonErro(text: string): { codigo?: string; mensagem?: string } | null {
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    return {
      codigo: j.codigo != null ? String(j.codigo) : j.code != null ? String(j.code) : undefined,
      mensagem:
        j.mensagem != null
          ? String(j.mensagem)
          : j.message != null
            ? String(j.message)
            : j.erro != null
              ? String(j.erro)
              : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Adapter Chapecó — Sistema Nacional NFS-e (REST POST /nfse, DPS assinada).
 */
export const nacionalAdapter: NfseMunicipalAdapter = {
  kind: 'nacional',

  async transmitir(env: Env, tenantId: string, input: NfseTransmitInput): Promise<NfseTransmitResult> {
    const url = `${sefinBase(input.ambiente)}/nfse`
    const res = await postViaSefazBridge(env, tenantId, {
      targetUrl: url,
      body: input.xmlAssinado,
      cert: input.cert,
      contentType: 'application/xml; charset=utf-8',
      accept: 'application/xml, application/json',
    })

    const text = res.text
    const chave =
      pickXmlTag(text, 'chaveAcesso') ||
      pickXmlTag(text, 'chNFSe') ||
      pickXmlTag(text, 'infNFSe')?.slice(0, 50) ||
      null

    // Sucesso típico: HTTP 200/201 + XML NFS-e com chave
    if (res.ok && (chave || /<(?:[\w.-]+:)?NFSe\b/i.test(text) || /<(?:[\w.-]+:)?infNFSe\b/i.test(text))) {
      const chaveFinal =
        chave ||
        text.match(/\b(\d{44,50})\b/)?.[1] ||
        null
      return {
        autorizada: true,
        protocolo: chaveFinal,
        chaveAcesso: chaveFinal,
        cStat: '100',
        xMotivo: 'NFS-e gerada pelo Sistema Nacional.',
        xmlRetorno: text,
        dhRecbto: new Date().toISOString(),
      }
    }

    const jsonErr = tryParseJsonErro(text)
    const codXml = pickXmlTag(text, 'codigo') || pickXmlTag(text, 'cStat')
    const msgXml = pickXmlTag(text, 'mensagem') || pickXmlTag(text, 'xMotivo')

    return {
      autorizada: false,
      protocolo: null,
      chaveAcesso: null,
      cStat: jsonErr?.codigo || codXml || String(res.status),
      xMotivo:
        jsonErr?.mensagem ||
        msgXml ||
        (text.slice(0, 400) || `HTTP ${res.status} sem NFS-e`),
      xmlRetorno: text,
      dhRecbto: null,
    }
  },
}
