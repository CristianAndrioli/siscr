/**
 * Ponte HTTPS → mTLS (SEFAZ / NFS-e municipal / Sefin Nacional)
 *
 * Contrato (igual ao esperado pela API SISCR / conexão `sefaz-dfe`):
 *   POST /
 *   Headers:
 *     Content-Type: application/soap+xml|application/xml|text/xml; charset=utf-8
 *     X-Sefaz-Url ou X-Target-Url: https://... (URL do webservice)
 *     X-Pfx-Base64: certificado A1 em base64 (PKCS#12)
 *     X-Pfx-Password: senha do .pfx
 *     Accept: (opcional, encaminhado)
 *     SOAPAction: (opcional, encaminhado — Paulistana)
 *     Authorization: Bearer <BRIDGE_TOKEN>  (se BRIDGE_TOKEN estiver definido)
 *   Body: envelope SOAP ou XML REST
 *
 * Resposta: status + corpo devolvidos pelo destino (transparência).
 *
 * Deploy: Cloudflare Containers (`wrangler deploy` neste pacote) ou Node em VPS.
 * Em Configurações → Conexões, URL base = URL pública do Worker da ponte.
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import tls from 'node:tls'
import { URL } from 'node:url'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 8788)
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || '').trim()
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 60_000)

/** SEFAZ / prefeituras (ICP-Brasil) não estão no Mozilla CA do Node — embutimos a cadeia. */
function loadTrustStore(): string[] {
  const cas: string[] = [...tls.rootCertificates]
  const candidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'certs', 'icp-brasil-https-cas.pem'),
    '/app/certs/icp-brasil-https-cas.pem',
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cas.push(fs.readFileSync(p, 'utf8'))
        console.log(`[sefaz-bridge] trust store + ICP-Brasil CA (${p})`)
        break
      }
    } catch {
      /* ignore */
    }
  }
  return cas
}

const TRUST_STORE = loadTrustStore()

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true, service: 'siscr-sefaz-bridge' }))
// Teste de conexão do SISCR faz GET na URL base
app.get('/', (c) => c.json({ ok: true, service: 'siscr-sefaz-bridge' }))

app.post('/', async (c) => {
  if (BRIDGE_TOKEN) {
    const auth = c.req.header('Authorization') || ''
    const expected = `Bearer ${BRIDGE_TOKEN}`
    if (auth !== expected) {
      return c.json({ error: 'Não autorizado. Use Authorization: Bearer <BRIDGE_TOKEN>.' }, 401)
    }
  }

  const targetUrl = (c.req.header('X-Target-Url') || c.req.header('X-Sefaz-Url') || '').trim()
  if (!targetUrl) {
    return c.json({ error: 'Header X-Sefaz-Url ou X-Target-Url é obrigatório.' }, 400)
  }

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return c.json({ error: 'URL de destino inválida.' }, 400)
  }
  if (parsed.protocol !== 'https:') {
    return c.json({ error: 'URL de destino deve ser https://' }, 400)
  }
  // Evita SSRF trivial para redes internas
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.endsWith('.local')
  ) {
    return c.json({ error: 'Host de destino não permitido.' }, 400)
  }

  const pfxB64 = (c.req.header('X-Pfx-Base64') || '').replace(/\s/g, '')
  const pfxPassword = c.req.header('X-Pfx-Password') ?? ''
  if (!pfxB64) {
    return c.json(
      {
        error:
          'Header X-Pfx-Base64 é obrigatório (certificado A1 em base64). A API SISCR envia o .pfx do tenant.',
      },
      400,
    )
  }

  let pfx: Buffer
  try {
    pfx = Buffer.from(pfxB64, 'base64')
  } catch {
    return c.json({ error: 'X-Pfx-Base64 inválido.' }, 400)
  }
  if (pfx.length < 100) {
    return c.json({ error: 'Certificado A1 parece incompleto.' }, 400)
  }

  const contentType =
    c.req.header('Content-Type') || 'application/soap+xml; charset=utf-8'
  const accept = c.req.header('Accept') || undefined
  const soapAction = c.req.header('SOAPAction') || undefined
  const body = Buffer.from(await c.req.arrayBuffer())

  try {
    const upstream = await postWithMtls({
      url: parsed,
      body,
      contentType,
      accept,
      soapAction,
      pfx,
      passphrase: pfxPassword,
      timeoutMs: REQUEST_TIMEOUT_MS,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.contentType || contentType,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no mTLS / destino'
    console.error('[sefaz-bridge]', msg)
    return c.json({ error: msg }, 502)
  }
})

function postWithMtls(opts: {
  url: URL
  body: Buffer
  contentType: string
  accept?: string
  soapAction?: string
  pfx: Buffer
  passphrase: string
  timeoutMs: number
}): Promise<{ status: number; body: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string | number> = {
      'Content-Type': opts.contentType,
      'Content-Length': opts.body.length,
    }
    if (opts.accept) headers.Accept = opts.accept
    if (opts.soapAction) headers.SOAPAction = opts.soapAction

    const req = https.request(
      {
        protocol: opts.url.protocol,
        hostname: opts.url.hostname,
        port: opts.url.port || 443,
        path: opts.url.pathname + opts.url.search,
        method: 'POST',
        headers,
        pfx: opts.pfx,
        passphrase: opts.passphrase,
        ca: TRUST_STORE,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode || 502,
            body: Buffer.concat(chunks),
            contentType: String(res.headers['content-type'] || ''),
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout após ${opts.timeoutMs}ms no destino.`))
    })
    req.on('error', reject)
    req.write(opts.body)
    req.end()
  })
}

console.log(`[sefaz-bridge] listening on :${PORT}${BRIDGE_TOKEN ? ' (auth Bearer)' : ' (sem BRIDGE_TOKEN)'}`)
serve({ fetch: app.fetch, port: PORT })
