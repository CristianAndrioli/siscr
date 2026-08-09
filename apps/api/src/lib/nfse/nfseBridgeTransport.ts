/**
 * Transporte HTTPS via ponte mTLS `sefaz-dfe` (genérico: SOAP ou REST).
 * Aceita alias X-Target-Url além de X-Sefaz-Url.
 */

import type { Env } from '../../index'
import { getConexaoFetch } from '../conexoes'
import { DFE_CONEXAO_NOME } from '../dfe/distribuicaoDfe'

export type BridgeCert = {
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
 * POST via conexão sefaz-dfe com A1 (mTLS na ponte).
 */
export async function postViaSefazBridge(
  env: Env,
  tenantId: string,
  params: {
    targetUrl: string
    body: string
    cert: BridgeCert
    contentType?: string
    accept?: string
    soapAction?: string
  },
): Promise<{ ok: boolean; status: number; text: string }> {
  const ponte = await getConexaoFetch(env, tenantId, DFE_CONEXAO_NOME)
  if (!ponte) {
    throw new Error(
      `Configure a Conexão "${DFE_CONEXAO_NOME}" (Configurações → Conexões) apontando para a ponte mTLS ` +
        `(apps/sefaz-bridge). Necessária também para NFS-e (Paulistana / Sistema Nacional).`,
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': params.contentType || 'application/xml; charset=utf-8',
    'X-Sefaz-Url': params.targetUrl,
    'X-Target-Url': params.targetUrl,
    'X-Pfx-Base64': arrayBufferToBase64(params.cert.pfxBytes),
    'X-Pfx-Password': params.cert.password,
  }
  if (params.accept) headers.Accept = params.accept
  if (params.soapAction) headers.SOAPAction = params.soapAction

  const res = await ponte.fetch('', {
    method: 'POST',
    headers,
    body: params.body,
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}
