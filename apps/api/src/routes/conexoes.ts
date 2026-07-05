/**
 * routes/conexoes.ts
 *
 * Conexões (named credentials) — credenciais de integração por tenant.
 * Prefixo: /tenant/conexoes
 *
 * O segredo (token/senha/api key) é cifrado com AES-256-GCM e é write-only:
 * nunca é retornado pela API. A UI apenas indica se há segredo configurado.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { authMiddleware } from '../middleware/auth'
import { tenantMiddleware } from '../middleware/tenant'
import {
  buildConexaoAuthHeaders,
  encryptConexaoSecret,
  type ConexaoRow,
} from '../lib/conexoes'

type HonoCtx = { Bindings: Env; Variables: { tenant: { tenantId: string }; user?: { id: string } } }

const app = new Hono<HonoCtx>()
app.use('*', authMiddleware)
app.use('*', tenantMiddleware)

function userId(c: any): string | null {
  try { return c.get('user')?.id ?? null } catch { return null }
}

const NOME_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

const conexaoSchema = z.object({
  nome: z.string().regex(NOME_RE, 'Use apenas letras minúsculas, números e hífens (3–40 caracteres).'),
  descricao: z.string().max(200).optional().nullable(),
  tipo: z.enum(['http', 'dominio', 'onvio', 'alterdata', 'sefaz_dfe']).default('http'),
  baseUrl: z.string().url('Informe uma URL válida (https://…).'),
  authTipo: z.enum(['none', 'basic', 'bearer', 'api_key_header']).default('none'),
  authConfig: z.object({
    username: z.string().max(200).optional(),
    headerName: z.string().max(100).optional(),
  }).optional().nullable(),
  /** Segredo em claro — só na criação/troca; jamais retornado. */
  secret: z.string().max(4000).optional().nullable(),
  empresaId: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
})

/** Projeção segura (sem secret_enc). */
function toDto(r: ConexaoRow) {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    tipo: r.tipo,
    base_url: r.base_url,
    auth_tipo: r.auth_tipo,
    auth_config: r.auth_config ? JSON.parse(r.auth_config) : null,
    tem_segredo: !!r.secret_enc,
    empresa_id: r.empresa_id,
    ativo: r.ativo,
    ultimo_teste_em: r.ultimo_teste_em,
    ultimo_teste_status: r.ultimo_teste_status,
    ultimo_teste_detalhe: r.ultimo_teste_detalhe,
  }
}

// ─── Listar ──────────────────────────────────────────────────────────────────

app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE tenant_id = ? ORDER BY nome')
    .bind(tenant.tenantId)
    .all<ConexaoRow>()
  return c.json({ conexoes: results.map(toDto) })
})

// ─── Criar ───────────────────────────────────────────────────────────────────

app.post('/', zValidator('json', conexaoSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')

  if (body.authTipo !== 'none' && !body.secret) {
    return c.json({ error: 'Informe o segredo (token, senha ou API key) para este tipo de autenticação.' }, 400)
  }

  const dup = await c.env.DB_SHARED
    .prepare('SELECT id FROM conexoes WHERE tenant_id = ? AND nome = ?')
    .bind(tenant.tenantId, body.nome)
    .first()
  if (dup) return c.json({ error: `Já existe uma conexão com o nome "${body.nome}".` }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  let secretEnc: string | null = null
  if (body.secret) {
    if (!c.env.CERT_BLOB_SECRET) return c.json({ error: 'CERT_BLOB_SECRET não configurado no servidor.' }, 503)
    secretEnc = await encryptConexaoSecret(c.env.CERT_BLOB_SECRET, tenant.tenantId, id, body.secret)
  }

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO conexoes (id, tenant_id, empresa_id, nome, descricao, tipo, base_url,
                            auth_tipo, auth_config, secret_enc, ativo, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId, body.empresaId ?? null, body.nome, body.descricao ?? null,
      body.tipo, body.baseUrl, body.authTipo,
      body.authConfig ? JSON.stringify(body.authConfig) : null,
      secretEnc, body.ativo ? 1 : 0, now, userId(c),
    )
    .run()

  const row = await c.env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE id = ?').bind(id).first<ConexaoRow>()
  return c.json({ conexao: toDto(row!) }, 201)
})

// ─── Atualizar ───────────────────────────────────────────────────────────────

app.put('/:id', zValidator('json', conexaoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const row = await c.env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<ConexaoRow>()
  if (!row) return c.json({ error: 'Conexão não encontrada.' }, 404)

  if (body.nome && body.nome !== row.nome) {
    const dup = await c.env.DB_SHARED
      .prepare('SELECT id FROM conexoes WHERE tenant_id = ? AND nome = ? AND id != ?')
      .bind(tenant.tenantId, body.nome, id)
      .first()
    if (dup) return c.json({ error: `Já existe uma conexão com o nome "${body.nome}".` }, 409)
  }

  let secretEnc = row.secret_enc
  if (body.secret) {
    if (!c.env.CERT_BLOB_SECRET) return c.json({ error: 'CERT_BLOB_SECRET não configurado no servidor.' }, 503)
    secretEnc = await encryptConexaoSecret(c.env.CERT_BLOB_SECRET, tenant.tenantId, id, body.secret)
  }

  await c.env.DB_SHARED
    .prepare(`
      UPDATE conexoes SET
        nome = ?, descricao = ?, tipo = ?, base_url = ?, auth_tipo = ?,
        auth_config = ?, secret_enc = ?, empresa_id = ?, ativo = ?,
        updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(
      body.nome ?? row.nome,
      body.descricao !== undefined ? body.descricao : row.descricao,
      body.tipo ?? row.tipo,
      body.baseUrl ?? row.base_url,
      body.authTipo ?? row.auth_tipo,
      body.authConfig !== undefined ? (body.authConfig ? JSON.stringify(body.authConfig) : null) : row.auth_config,
      secretEnc,
      body.empresaId !== undefined ? body.empresaId : row.empresa_id,
      body.ativo !== undefined ? (body.ativo ? 1 : 0) : row.ativo,
      new Date().toISOString(), userId(c),
      id, tenant.tenantId,
    )
    .run()

  const updated = await c.env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE id = ?').bind(id).first<ConexaoRow>()
  return c.json({ conexao: toDto(updated!) })
})

// ─── Remover ─────────────────────────────────────────────────────────────────

app.delete('/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const r = await c.env.DB_SHARED
    .prepare('DELETE FROM conexoes WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .run()
  if (!r.meta.changes) return c.json({ error: 'Conexão não encontrada.' }, 404)
  return c.json({ message: 'Conexão removida.' })
})

// ─── Testar ──────────────────────────────────────────────────────────────────

/**
 * Faz um GET na base_url com a autenticação injetada e registra o resultado.
 * Considera "ok" qualquer resposta HTTP (mesmo 401/404) — o objetivo é validar
 * alcance de rede e formação da credencial; falha apenas em erro de transporte.
 */
app.post('/:id/testar', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const row = await c.env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<ConexaoRow>()
  if (!row) return c.json({ error: 'Conexão não encontrada.' }, 404)

  const now = new Date().toISOString()
  let status: 'ok' | 'erro' = 'ok'
  let detalhe = ''

  try {
    const headers = await buildConexaoAuthHeaders(c.env, row)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    try {
      const res = await fetch(row.base_url, { method: 'GET', headers, signal: ctrl.signal })
      detalhe = `HTTP ${res.status} ${res.statusText}`.trim()
      if (res.status === 401 || res.status === 403) {
        detalhe += ' — endpoint alcançado, mas a credencial foi recusada'
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    status = 'erro'
    detalhe = e instanceof Error ? e.message : 'Falha de rede.'
  }

  await c.env.DB_SHARED
    .prepare('UPDATE conexoes SET ultimo_teste_em = ?, ultimo_teste_status = ?, ultimo_teste_detalhe = ? WHERE id = ?')
    .bind(now, status, detalhe.slice(0, 300), id)
    .run()

  return c.json({ status, detalhe, testado_em: now })
})

export default app
