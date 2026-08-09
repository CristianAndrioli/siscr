/**
 * Ponte HTTPS → mTLS SEFAZ
 *
 * Contrato (igual ao esperado pela API SISCR / conexão `sefaz-dfe`):
 *   POST /
 *   Headers:
 *     Content-Type: application/soap+xml; charset=utf-8
 *     X-Sefaz-Url: https://... (URL real do webservice SEFAZ)
 *     X-Pfx-Base64: certificado A1 em base64 (PKCS#12)
 *     X-Pfx-Password: senha do .pfx
 *     Authorization: Bearer <BRIDGE_TOKEN>  (se BRIDGE_TOKEN estiver definido)
 *   Body: envelope SOAP
 *
 * Resposta: status + corpo devolvidos pela SEFAZ (transparência).
 *
 * Deploy: Cloudflare Containers (`wrangler deploy` neste pacote) ou Node em VPS.
 * Em Configurações → Conexões, URL base = URL pública do Worker da ponte.
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import https from 'node:https'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 8788)
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || '').trim()
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 60_000)

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true, service: 'siscr-sefaz-bridge' }))

app.post('/', async (c) => {
  if (BRIDGE_TOKEN) {
    const auth = c.req.header('Authorization') || ''
    const expected = `Bearer ${BRIDGE_TOKEN}`
    if (auth !== expected) {
      return c.json({ error: 'Não autorizado. Use Authorization: Bearer <BRIDGE_TOKEN>.' }, 401)
    }
  }

  const sefazUrl = (c.req.header('X-Sefaz-Url') || '').trim()
  if (!sefazUrl) {
    return c.json({ error: 'Header X-Sefaz-Url é obrigatório.' }, 400)
  }

  let parsed: URL
  try {
    parsed = new URL(sefazUrl)
  } catch {
    return c.json({ error: 'X-Sefaz-Url inválida.' }, 400)
  }
  if (parsed.protocol !== 'https:') {
    return c.json({ error: 'X-Sefaz-Url deve ser https://' }, 400)
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
    return c.json({ error: 'Host SEFAZ não permitido.' }, 400)
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
  const body = Buffer.from(await c.req.arrayBuffer())

  try {
    const upstream = await postWithMtls({
      url: parsed,
      body,
      contentType,
      pfx,
      passphrase: pfxPassword,
      timeoutMs: REQUEST_TIMEOUT_MS,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.contentType || 'application/soap+xml; charset=utf-8',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no mTLS / SEFAZ'
    console.error('[sefaz-bridge]', msg)
    return c.json({ error: msg }, 502)
  }
})

function postWithMtls(opts: {
  url: URL
  body: Buffer
  contentType: string
  pfx: Buffer
  passphrase: string
  timeoutMs: number
}): Promise<{ status: number; body: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: opts.url.protocol,
        hostname: opts.url.hostname,
        port: opts.url.port || 443,
        path: opts.url.pathname + opts.url.search,
        method: 'POST',
        headers: {
          'Content-Type': opts.contentType,
          'Content-Length': opts.body.length,
        },
        pfx: opts.pfx,
        passphrase: opts.passphrase,
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
      req.destroy(new Error(`Timeout após ${opts.timeoutMs}ms na SEFAZ.`))
    })
    req.on('error', reject)
    req.write(opts.body)
    req.end()
  })
}

console.log(`[sefaz-bridge] listening on :${PORT}${BRIDGE_TOKEN ? ' (auth Bearer)' : ' (sem BRIDGE_TOKEN)'}`)
serve({ fetch: app.fetch, port: PORT })
