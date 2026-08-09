/**
 * Transporte SOAP → ponte `sefaz-dfe` com A1 (headers X-Pfx-*).
 * A ponte faz mTLS; Workers só orquestram.
 */

import type { Env } from '../../index'
import { getConexaoFetch } from '../conexoes'
import { DFE_CONEXAO_NOME } from '../dfe/distribuicaoDfe'

export type SefazBridgeCert = {
  pfxBytes: ArrayBuffer
  password: string
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

/**
 * POST SOAP via conexão sefaz-dfe, anexando o A1 para a ponte.
 * Sem ponte configurada → erro claro.
 */
export async function postSoapViaSefazBridge(
  env: Env,
  tenantId: string,
  params: {
    sefazUrl: string
    soapBody: string
    cert: SefazBridgeCert
    contentType?: string
  },
): Promise<{ ok: boolean; status: number; text: string }> {
  const ponte = await getConexaoFetch(env, tenantId, DFE_CONEXAO_NOME)
  if (!ponte) {
    throw new Error(
      `Configure a Conexão "${DFE_CONEXAO_NOME}" (Configurações → Conexões) apontando para a ponte mTLS ` +
        `(apps/sefaz-bridge). Ver doc/integracoes-contabilidade.md §2.3.`,
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': params.contentType || 'application/soap+xml; charset=utf-8',
    'X-Sefaz-Url': params.sefazUrl,
    'X-Pfx-Base64': arrayBufferToBase64(params.cert.pfxBytes),
    'X-Pfx-Password': params.cert.password,
  }

  const res = await ponte.fetch('', {
    method: 'POST',
    headers,
    body: params.soapBody,
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}
