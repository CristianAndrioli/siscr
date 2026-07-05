/**
 * Conexões — "named credentials" do SISCR.
 *
 * Modelo inspirado nas Named/External Credentials do Salesforce:
 * a credencial é configurada por tela (Configurações → Conexões) e o código
 * consome via `getConexaoFetch(env, tenantId, nome)`, que injeta a
 * autenticação em runtime. O segredo é cifrado com AES-256-GCM (chave
 * derivada de CERT_BLOB_SECRET + tenant + conexão, mesmo padrão do
 * certificado A1 em certBlob.ts) e nunca sai do backend.
 */

import type { Env } from '../index'

export type ConexaoAuthTipo = 'none' | 'basic' | 'bearer' | 'api_key_header'
export type ConexaoTipo = 'http' | 'dominio' | 'onvio' | 'alterdata' | 'sefaz_dfe'

export interface ConexaoRow {
  id: string
  tenant_id: string
  empresa_id: string | null
  nome: string
  descricao: string | null
  tipo: ConexaoTipo
  base_url: string
  auth_tipo: ConexaoAuthTipo
  auth_config: string | null
  secret_enc: string | null
  ativo: number
  ultimo_teste_em: string | null
  ultimo_teste_status: string | null
  ultimo_teste_detalhe: string | null
}

export interface ConexaoAuthConfig {
  /** basic: usuário (a senha é o segredo) */
  username?: string
  /** api_key_header: nome do header (ex: "X-Api-Key") */
  headerName?: string
}

// ─── Criptografia do segredo ─────────────────────────────────────────────────

const SECRET_SCOPE_PREFIX = 'conexao'

async function deriveKey(masterSecret: string, tenantId: string, conexaoId: string, usage: KeyUsage): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${masterSecret}|${tenantId}|${SECRET_SCOPE_PREFIX}:${conexaoId}`)
  const raw = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [usage])
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
}

export async function encryptConexaoSecret(
  masterSecret: string,
  tenantId: string,
  conexaoId: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(masterSecret, tenantId, conexaoId, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret))
  const out = new Uint8Array(iv.length + ct.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(ct), iv.length)
  return toBase64(out)
}

export async function decryptConexaoSecret(
  masterSecret: string,
  tenantId: string,
  conexaoId: string,
  secretEnc: string,
): Promise<string> {
  const u8 = fromBase64(secretEnc)
  if (u8.length < 12 + 16) throw new Error('Segredo da conexão inválido.')
  const key = await deriveKey(masterSecret, tenantId, conexaoId, 'decrypt')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12))
  return new TextDecoder().decode(plain)
}

// ─── Resolução e consumo ─────────────────────────────────────────────────────

export interface ConexaoFetch {
  conexao: Pick<ConexaoRow, 'id' | 'nome' | 'tipo' | 'base_url' | 'auth_tipo'>
  /** fetch com base_url + autenticação injetada — o chamador não vê o segredo. */
  fetch: (path: string, init?: RequestInit) => Promise<Response>
}

export async function getConexaoRow(env: Env, tenantId: string, nome: string): Promise<ConexaoRow | null> {
  return env.DB_SHARED
    .prepare('SELECT * FROM conexoes WHERE tenant_id = ? AND nome = ? AND ativo = 1 LIMIT 1')
    .bind(tenantId, nome)
    .first<ConexaoRow>()
}

/** Monta os headers de autenticação de uma conexão (segredo descriptografado em memória). */
export async function buildConexaoAuthHeaders(env: Env, row: ConexaoRow): Promise<Record<string, string>> {
  if (row.auth_tipo === 'none') return {}

  if (!env.CERT_BLOB_SECRET) throw new Error('CERT_BLOB_SECRET não configurado — impossível descriptografar segredos.')
  if (!row.secret_enc) throw new Error(`Conexão "${row.nome}" não possui segredo configurado.`)

  const secret = await decryptConexaoSecret(env.CERT_BLOB_SECRET, row.tenant_id, row.id, row.secret_enc)
  const cfg: ConexaoAuthConfig = row.auth_config ? JSON.parse(row.auth_config) : {}

  switch (row.auth_tipo) {
    case 'bearer':
      return { Authorization: `Bearer ${secret}` }
    case 'basic':
      return { Authorization: `Basic ${btoa(`${cfg.username ?? ''}:${secret}`)}` }
    case 'api_key_header':
      return { [cfg.headerName || 'X-Api-Key']: secret }
    default:
      return {}
  }
}

/**
 * Equivalente ao `callout:NomeDaConexao` do Salesforce.
 * Retorna null se a conexão não existir ou estiver inativa.
 */
export async function getConexaoFetch(env: Env, tenantId: string, nome: string): Promise<ConexaoFetch | null> {
  const row = await getConexaoRow(env, tenantId, nome)
  if (!row) return null

  const baseUrl = row.base_url.replace(/\/+$/, '')

  return {
    conexao: { id: row.id, nome: row.nome, tipo: row.tipo, base_url: row.base_url, auth_tipo: row.auth_tipo },
    fetch: async (path: string, init?: RequestInit) => {
      const authHeaders = await buildConexaoAuthHeaders(env, row)
      const headers = new Headers(init?.headers)
      for (const [k, v] of Object.entries(authHeaders)) headers.set(k, v)
      const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
      return fetch(url, { ...init, headers })
    },
  }
}
