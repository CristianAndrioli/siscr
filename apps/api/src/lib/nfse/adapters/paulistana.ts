import type { Env } from '../../../index'
import { postViaSefazBridge } from '../nfseBridgeTransport'
import type { NfseMunicipalAdapter, NfseTransmitInput, NfseTransmitResult } from '../types'
import { wrapPaulistanaSoap, PAULISTANA_LOTE_URL } from '../buildPaulistanaRps'

function pickXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w.-]+:)?${tag}>`, 'i')
  const m = xml.match(re)
  return m?.[1]?.trim() || null
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
    const method = teste ? 'TesteEnvioLoteRPS' : 'EnvioLoteRPS'

    const res = await postViaSefazBridge(env, tenantId, {
      targetUrl: PAULISTANA_LOTE_URL,
      body: soap,
      cert: input.cert,
      contentType: 'text/xml; charset=utf-8',
      soapAction: `http://www.prefeitura.sp.gov.br/nfe/${method}`,
    })

    const text = res.text
    const sucesso = pickXmlTag(text, 'Sucesso')
    const numeroNfe = pickXmlTag(text, 'NumeroNFe') || pickXmlTag(text, 'NumeroNfe')
    const cod = pickXmlTag(text, 'Codigo') || String(res.status)
    const desc =
      pickXmlTag(text, 'Descricao') ||
      pickXmlTag(text, 'Mensagem') ||
      (res.ok ? 'Retorno Paulistana' : `HTTP ${res.status}`)

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
