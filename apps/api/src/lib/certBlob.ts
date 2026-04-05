/**
 * Cifra o bundle .pfx + senha (AES-256-GCM).
 * `scopeKey` isola registros: use o mesmo id da empresa (`empresaId`) para matriz, ou `filial:${filialId}` para filial.
 */
export async function encryptA1Bundle(
  masterSecret: string,
  tenantId: string,
  scopeKey: string,
  pfxBytes: ArrayBuffer,
  pfxPassword: string,
): Promise<ArrayBuffer> {
  const pfxB64 = arrayBufferToBase64(pfxBytes)
  const plain = JSON.stringify({ v: 1, pfxB64, pwd: pfxPassword })
  const keyMaterial = new TextEncoder().encode(`${masterSecret}|${tenantId}|${scopeKey}`)
  const keyRaw = await crypto.subtle.digest('SHA-256', keyMaterial)
  const key = await crypto.subtle.importKey('raw', keyRaw, 'AES-GCM', false, ['encrypt'])

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )

  const out = new Uint8Array(iv.length + ciphertext.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(ciphertext), iv.length)
  return out.buffer
}

/** Para uso futuro na emissão de NF-e (worker de assinatura). */
export async function decryptA1Bundle(
  masterSecret: string,
  tenantId: string,
  scopeKey: string,
  encrypted: ArrayBuffer,
): Promise<{ pfxBytes: ArrayBuffer; password: string }> {
  const u8 = new Uint8Array(encrypted)
  if (u8.length < 12 + 16) throw new Error('Blob inválido.')

  const iv = u8.slice(0, 12)
  const ct = u8.slice(12)

  const keyMaterial = new TextEncoder().encode(`${masterSecret}|${tenantId}|${scopeKey}`)
  const keyRaw = await crypto.subtle.digest('SHA-256', keyMaterial)
  const key = await crypto.subtle.importKey('raw', keyRaw, 'AES-GCM', false, ['decrypt'])

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  const plain = new TextDecoder().decode(plainBuf)
  const obj = JSON.parse(plain) as { v: number; pfxB64: string; pwd: string }
  if (obj.v !== 1 || !obj.pfxB64) throw new Error('Formato de certificado inválido.')

  return {
    pfxBytes: base64ToArrayBuffer(obj.pfxB64),
    password: obj.pwd ?? '',
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
