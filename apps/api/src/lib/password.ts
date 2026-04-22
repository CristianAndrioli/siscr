/**
 * Hash e verificação de senhas.
 *
 * Ambiente-alvo: Cloudflare Workers (apenas Web Crypto API — sem Node).
 *
 * Formato canônico do hash armazenado em `users.password_hash`:
 *   pbkdf2$<iterations>$<saltHex>$<hashHex>
 *
 * Formatos legados suportados apenas em leitura (verify) — nunca em hash novo:
 *   1) <saltHex>:<hashHex>            PBKDF2 100k iterações (versão 1)
 *   2) <64 chars hex>                 SHA-256 puro sem salt (versão "pré-histórica")
 *
 * SEGURANÇA
 * -----------------------------------------------------------------
 * - Iterações: 600.000 (OWASP 2023 para PBKDF2-SHA256).
 * - Comparação de hash: timing-safe via `constantTimeEqual`.
 * - Rehash automático: `needsRehash(stored)` retorna true para formatos
 *   legados ou iterações abaixo do alvo atual. O caller deve chamar
 *   `hash()` novamente com a senha em memória e persistir o novo hash
 *   após login bem-sucedido (ver `routes/auth.ts::login`).
 *
 * USO (classes públicas)
 * -----------------------------------------------------------------
 *   import { PasswordHasher } from '../lib/password'
 *   const stored = await PasswordHasher.hash('senha123')
 *   const ok = await PasswordHasher.verify('senha123', stored)
 *   if (ok && PasswordHasher.needsRehash(stored)) {
 *     const fresh = await PasswordHasher.hash('senha123')
 *     // UPDATE users SET password_hash = ? WHERE id = ?
 *   }
 *
 * Funções exportadas (`hashPassword`, `verifyPassword`) são mantidas
 * como thin-wrappers para compatibilidade com chamadas antigas.
 */

/** Alvo atual de iterações para PBKDF2-SHA256. */
const CURRENT_ITERATIONS = 600_000

/** Prefixo do formato canônico. */
const ALGO_PREFIX = 'pbkdf2'

/** Tamanho do salt (bytes) e do hash derivado (bits). */
const SALT_BYTES = 16
const DERIVED_BITS = 256

/** Estrutura interna do hash canônico. */
type ParsedHash =
  | { kind: 'canonical'; iterations: number; salt: Uint8Array; hashHex: string }
  | { kind: 'legacy-pbkdf2-100k'; salt: Uint8Array; hashHex: string }
  | { kind: 'legacy-sha256'; hashHex: string }

export class PasswordHasher {
  /** Gera um novo hash no formato canônico. Sempre use esta função. */
  static async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const hashHex = await PasswordHasher.derive(password, salt, CURRENT_ITERATIONS)
    const saltHex = bytesToHex(salt)
    return `${ALGO_PREFIX}$${CURRENT_ITERATIONS}$${saltHex}$${hashHex}`
  }

  /**
   * Verifica a senha contra o hash armazenado — aceita os formatos legados
   * (`saltHex:hashHex` e SHA-256 hex puro) em leitura.
   */
  static async verify(password: string, stored: string): Promise<boolean> {
    if (!stored) return false
    const parsed = PasswordHasher.parse(stored)
    if (!parsed) return false

    if (parsed.kind === 'legacy-sha256') {
      const actual = await sha256Hex(password)
      return constantTimeEqual(actual, parsed.hashHex)
    }

    const iterations = parsed.kind === 'canonical' ? parsed.iterations : 100_000
    const actual = await PasswordHasher.derive(password, parsed.salt, iterations)
    return constantTimeEqual(actual, parsed.hashHex)
  }

  /**
   * Retorna true quando o hash armazenado está em formato legado OU com
   * contagem de iterações inferior ao alvo atual. Chame após `verify()`
   * retornar true e, se o retorno for true, refaça o hash com `hash()`
   * e persista o novo valor.
   */
  static needsRehash(stored: string): boolean {
    const parsed = PasswordHasher.parse(stored)
    if (!parsed) return true
    if (parsed.kind !== 'canonical') return true
    return parsed.iterations < CURRENT_ITERATIONS
  }

  // ── helpers privados ────────────────────────────────────────────

  private static parse(stored: string): ParsedHash | null {
    // Canônico: pbkdf2$<iter>$<saltHex>$<hashHex>
    if (stored.startsWith(`${ALGO_PREFIX}$`)) {
      const parts = stored.split('$')
      if (parts.length !== 4) return null
      const [, iterStr, saltHex, hashHex] = parts as [string, string, string, string]
      const iterations = Number(iterStr)
      if (!Number.isFinite(iterations) || iterations <= 0) return null
      const salt = hexToBytes(saltHex)
      if (!salt) return null
      return { kind: 'canonical', iterations, salt, hashHex }
    }

    // Legado v1: saltHex:hashHex (PBKDF2 100k SHA-256)
    if (stored.includes(':')) {
      const parts = stored.split(':')
      if (parts.length !== 2) return null
      const [saltHex, hashHex] = parts as [string, string]
      if (!saltHex || !hashHex) return null
      const salt = hexToBytes(saltHex)
      if (!salt) return null
      return { kind: 'legacy-pbkdf2-100k', salt, hashHex }
    }

    // Legado v0: SHA-256 hex puro (64 chars)
    if (/^[a-f0-9]{64}$/i.test(stored)) {
      return { kind: 'legacy-sha256', hashHex: stored.toLowerCase() }
    }

    return null
  }

  private static async derive(
    password: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<string> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      DERIVED_BITS,
    )
    return bytesToHex(new Uint8Array(bits))
  }
}

// ── utilitários de baixo nível ──────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const matches = hex.match(/.{2}/g)
  if (!matches) return null
  const bytes = new Uint8Array(matches.length)
  for (let i = 0; i < matches.length; i++) {
    const n = parseInt(matches[i]!, 16)
    if (Number.isNaN(n)) return null
    bytes[i] = n
  }
  return bytes
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return bytesToHex(new Uint8Array(buf))
}

/**
 * Comparação em tempo constante para strings hex de mesmo tamanho.
 * Evita timing attacks em comparação de hashes.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// ── API legada (thin wrappers) ──────────────────────────────────────

/** @deprecated Use `PasswordHasher.hash`. Mantido para compatibilidade. */
export async function hashPassword(password: string): Promise<string> {
  return PasswordHasher.hash(password)
}

/** @deprecated Use `PasswordHasher.verify`. Mantido para compatibilidade. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return PasswordHasher.verify(password, stored)
}
