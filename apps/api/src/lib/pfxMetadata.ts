import * as forge from 'node-forge'

/** Campos seguros para exibir na API (não inclui chave privada nem senha). */
export type A1CertPublicMeta = {
  subjectCn: string | null
  /** Subject completo (ex.: CN=…, O=…, OU=…) */
  subjectDn: string | null
  issuerCn: string | null
  issuerDn: string | null
  serialNumber: string | null
  validFrom: string
  validTo: string
  /** SHA-256 do DER do certificado (hex minúsculo) */
  thumbprintSha256: string
}

function dnToString(subject: forge.pki.Certificate['subject']): string {
  const attrs = subject.attributes
  if (!attrs?.length) return ''
  return attrs
    .map((a) => {
      const k = a.shortName || a.name || a.type || 'attr'
      return `${k}=${a.value}`
    })
    .join(', ')
}

function fieldCn(subject: forge.pki.Certificate['subject']): string | null {
  const f = subject.getField('CN') as { value?: string } | null
  const v = f?.value
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function fieldCnIssuer(issuer: forge.pki.Certificate['issuer']): string | null {
  const f = issuer.getField('CN') as { value?: string } | null
  const v = f?.value
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function isCaCert(cert: forge.pki.Certificate): boolean {
  const ext = cert.getExtension('basicConstraints') as { cA?: boolean } | undefined
  return ext?.cA === true
}

function pickLeafCert(certs: forge.pki.Certificate[]): forge.pki.Certificate | null {
  if (certs.length === 0) return null
  const leaf = certs.find((c) => !isCaCert(c))
  return leaf ?? certs[0] ?? null
}

function forgeDateToIso(d: Date): string {
  return d.toISOString()
}

/**
 * Abre o PKCS#12 com a senha e extrai metadados do certificado de entidade (folha).
 */
export function extractA1CertPublicMeta(pfxBytes: ArrayBuffer, password: string): A1CertPublicMeta {
  const der = forge.util.createBuffer(new Uint8Array(pfxBytes))
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(der)
  } catch {
    throw Object.assign(new Error('Arquivo PKCS#12 inválido ou corrompido.'), { status: 400 })
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
  } catch {
    throw Object.assign(new Error('Senha incorreta ou arquivo não é um certificado A1 válido.'), { status: 400 })
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const bags = certBags[forge.pki.oids.certBag] ?? []
  const certs = bags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c))

  const cert = pickLeafCert(certs)
  if (!cert) {
    throw Object.assign(new Error('Nenhum certificado foi encontrado no arquivo.'), { status: 400 })
  }

  const asn1Cert = forge.pki.certificateToAsn1(cert)
  const derCert = forge.asn1.toDer(asn1Cert).getBytes()
  const md = forge.md.sha256.create()
  md.update(derCert, 'raw')
  const thumbprintSha256 = md.digest().toHex()

  const serialNumber = cert.serialNumber ? cert.serialNumber.replace(/^0+/, '') || cert.serialNumber : null

  return {
    subjectCn: fieldCn(cert.subject),
    subjectDn: dnToString(cert.subject) || null,
    issuerCn: fieldCnIssuer(cert.issuer),
    issuerDn: dnToString(cert.issuer) || null,
    serialNumber,
    validFrom: forgeDateToIso(cert.validity.notBefore),
    validTo: forgeDateToIso(cert.validity.notAfter),
    thumbprintSha256,
  }
}
