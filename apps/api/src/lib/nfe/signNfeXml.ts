import * as forge from 'node-forge'
import { Parse, SignedXml } from 'xmldsigjs'
import { ensureXmlCoreNodeDependencies } from './xmlCoreWorkerDeps'

function isCaCert(cert: forge.pki.Certificate): boolean {
  const ext = cert.getExtension('basicConstraints') as { cA?: boolean } | undefined
  return ext?.cA === true
}

function pickLeafCert(certs: forge.pki.Certificate[]): forge.pki.Certificate | null {
  if (certs.length === 0) return null
  const leaf = certs.find((c) => !isCaCert(c))
  return leaf ?? certs[0] ?? null
}

function derStringToUint8(der: string): Uint8Array {
  const out = new Uint8Array(der.length)
  for (let i = 0; i < der.length; i++) out[i] = der.charCodeAt(i) & 0xff
  return out
}

function certToBase64Der(cert: forge.pki.Certificate): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  return btoa(der)
}

/**
 * Abre PKCS#12 (A1), extrai chave RSA em PKCS#8 e cadeia em DER base64 para KeyInfo.
 */
export async function pfxToWebCryptoRsaSha1(
  pfxBytes: ArrayBuffer,
  password: string,
): Promise<{ privateKey: CryptoKey; x509Base64: string[] }> {
  const derBuf = forge.util.createBuffer(new Uint8Array(pfxBytes))
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(derBuf)
  } catch {
    throw new Error('Arquivo PKCS#12 inválido ou corrompido.')
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
  } catch {
    throw new Error('Senha do certificado A1 incorreta ou arquivo inválido.')
  }

  const shrouded =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []

  let privateKey: forge.pki.PrivateKey | null = null
  for (const b of [...shrouded, ...plain]) {
    if (b.key) {
      privateKey = b.key
      break
    }
  }
  if (!privateKey) {
    throw new Error('Chave privada não encontrada no certificado A1.')
  }

  const rsa = privateKey as forge.pki.rsa.PrivateKey
  if (rsa.n == null) {
    throw new Error('Apenas certificados RSA são suportados para NF-e nesta versão.')
  }

  const rsaPrivateKeyAsn1 = forge.pki.privateKeyToAsn1(privateKey)
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKeyAsn1)
  const pkcs8Der = Uint8Array.from(
    derStringToUint8(forge.asn1.toDer(privateKeyInfo).getBytes()),
  )

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const certs = certBags.map((b) => b.cert).filter((c): c is forge.pki.Certificate => Boolean(c))
  const leaf = pickLeafCert(certs)
  if (!leaf) {
    throw new Error('Nenhum certificado de entidade encontrado no A1.')
  }

  const chain: forge.pki.Certificate[] = [leaf]
  for (const c of certs) {
    if (c !== leaf) chain.push(c)
  }

  const x509Base64 = chain.map(certToBase64Der)

  const privateKeyCrypto = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign'],
  )

  return { privateKey: privateKeyCrypto, x509Base64 }
}

type XmlPrefixed = {
  Prefix: string | null
  element?: Element | null
  GetIterator?: () => Iterable<unknown>
}

/**
 * SEFAZ/XSD exigem Signature sem prefixo `ds:`.
 * xmldsigjs assina com `ds:` — se só removermos o prefixo depois, o SignatureValue
 * (calculado sobre o SignedInfo com ds:) deixa de bater → rejeição 297.
 * Aqui zeramos o prefixo na árvore e forçamos rebuild do XML em cache.
 */
function useDefaultXmlDsigNamespace(root: XmlPrefixed): void {
  const seen = new Set<object>()
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)

    const o = node as XmlPrefixed & Record<string, unknown>
    if ('Prefix' in o) {
      o.Prefix = null
      if ('element' in o) o.element = null
    }
    if (typeof o.GetIterator === 'function') {
      for (const item of o.GetIterator()) visit(item)
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'Parent' || k === 'element' || k === 'document') continue
      if (v && typeof v === 'object' && ('Prefix' in (v as object) || typeof (v as XmlPrefixed).GetIterator === 'function')) {
        visit(v)
      }
    }
  }
  visit(root)
}

/**
 * Assina NF-e 4.00 (XML-DSig, RSA-SHA1, enveloped + C14N 1.0), referência ao `infNFe` (`#NFe{chave44}`).
 * Emite Signature com xmlns padrão (sem `ds:`), alinhado ao XSD e à verificação da SEFAZ.
 */
export async function signNfeXmlWithA1(
  unsignedXml: string,
  chave44: string,
  pfxBytes: ArrayBuffer,
  password: string,
): Promise<string> {
  ensureXmlCoreNodeDependencies()
  const { privateKey, x509Base64 } = await pfxToWebCryptoRsaSha1(pfxBytes, password)

  const doc = Parse(unsignedXml)
  const root = doc.documentElement
  if (!root || root.localName !== 'NFe') {
    throw new Error('XML NF-e inválido: elemento raiz NFe esperado.')
  }

  const signedXml = new SignedXml()
  await signedXml.Sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    privateKey,
    doc,
    {
      references: [
        {
          uri: `#NFe${chave44}`,
          hash: 'SHA-1',
          transforms: ['enveloped', 'c14n'],
        },
      ],
      // Apenas o certificado folha no KeyInfo (cadeia completa costuma quebrar o XSD da NF-e)
      x509: x509Base64.slice(0, 1),
    },
  )

  // Recalcula SignatureValue no leiaute sem prefixo ds: (exigido pela SEFAZ / XSD NF-e).
  useDefaultXmlDsigNamespace(signedXml.XmlSignature as unknown as XmlPrefixed)
  const dataEl = signedXml['document']?.documentElement ?? root
  const signedInfoCanon = (
    signedXml as unknown as { TransformSignedInfo: (data: Element) => string }
  ).TransformSignedInfo(dataEl)
  const signatureBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    privateKey,
    new TextEncoder().encode(signedInfoCanon),
  )
  signedXml.XmlSignature.SignatureValue = new Uint8Array(signatureBuf)

  let body = signedXml.toString()
  // Garante xmlns padrão sem espaço estranho; não altera SignedInfo já reassinado.
  body = body.replace(
    /<Signature\b[^>]*>/,
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
  )
  if (body.includes('ds:') || body.includes('xmlns:ds=')) {
    throw new Error('Assinatura NF-e ainda contém prefixo ds: — regeneração incompleta.')
  }
  if (body.startsWith('<?xml')) return body
  return `<?xml version="1.0" encoding="UTF-8"?>${body}`
}
