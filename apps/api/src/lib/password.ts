/**
 * Hash e verificação de senha (Web Crypto — compatível com Workers).
 * Formato PBKDF2: saltHex:hashHex
 * Legado (só verificação): SHA-256 hex puro (64 chars), usado por versões antigas do POST de usuários.
 */

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false

  // Legado: hash SHA-256 simples (sem salt), 64 hex
  if (!stored.includes(':') && /^[a-f0-9]{64}$/i.test(stored)) {
    const encoder = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hex.toLowerCase() === stored.toLowerCase()
  }

  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [saltHex, hashHex] = parts
  if (!saltHex || !hashHex) return false

  const saltMatch = saltHex.match(/.{2}/g)
  if (!saltMatch) return false
  const salt = new Uint8Array(saltMatch.map(h => parseInt(h, 16)))
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const testHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return testHex === hashHex
}
