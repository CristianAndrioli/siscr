import * as forge from 'node-forge'
import { Parse, XmlDsigC14NTransform } from 'xmldsigjs'
import { ensureXmlCoreNodeDependencies } from './xmlCoreWorkerDeps'

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe'
const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENV_ALG = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1'

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

function bytesToBase64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function stripXmlDecl(xml: string): string {
  return xml.replace(/^\uFEFF?<\?xml[^?]*\?>\s*/i, '').trim()
}

function c14nElement(el: Element): string {
  const t = new XmlDsigC14NTransform()
  t.LoadInnerXml(el)
  const out = t.GetOutput()
  if (typeof out !== 'string') {
    throw new Error('Falha na canonicalização C14N do XML.')
  }
  return out
}

function findInfNFe(nfe: Element, idAttr: string): Element {
  for (let i = 0; i < nfe.childNodes.length; i++) {
    const n = nfe.childNodes[i]
    if (n.nodeType === 1 && (n as Element).localName === 'infNFe') {
      const el = n as Element
      if ((el.getAttribute('Id') || '') === idAttr) return el
    }
  }
  throw new Error(`infNFe com Id="${idAttr}" não encontrado no XML.`)
}

/** Clone de infNFe com xmlns do NFe (C14N inclusivo precisa do namespace no escopo). */
function prepareInfNFeForDigest(infNFe: Element, nfe: Element): Element {
  const clone = infNFe.cloneNode(true) as Element
  const xmlns = nfe.getAttribute('xmlns') || NFE_NS
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', xmlns)
  }
  return clone
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

/**
 * Assina NF-e 4.00 (XML-DSig enveloped + C14N 1.0 + RSA-SHA1).
 * Monta Signature com xmlns padrão (sem prefixo `ds:`), exigido pelo XSD e pela SEFAZ.
 */
export async function signNfeXmlWithA1(
  unsignedXml: string,
  chave44: string,
  pfxBytes: ArrayBuffer,
  password: string,
): Promise<string> {
  ensureXmlCoreNodeDependencies()
  const { privateKey, x509Base64 } = await pfxToWebCryptoRsaSha1(pfxBytes, password)
  const leafCert = x509Base64[0]
  if (!leafCert) {
    throw new Error('Certificado A1 sem X509Certificate para KeyInfo.')
  }

  const doc = Parse(unsignedXml)
  const nfe = doc.documentElement
  if (!nfe || nfe.localName !== 'NFe') {
    throw new Error('XML NF-e inválido: elemento raiz NFe esperado.')
  }

  const idAttr = `NFe${chave44}`
  const infNFe = findInfNFe(nfe, idAttr)
  const digestCanon = c14nElement(prepareInfNFeForDigest(infNFe, nfe))
  const digestValue = bytesToBase64(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(digestCanon)))

  // SignedInfo com xmlns próprio — C14N inclusivo fica equivalente ao SignedInfo
  // embutido em <Signature xmlns="..."> (namespace herdado).
  const signedInfoForSign =
    `<SignedInfo xmlns="${DS_NS}">` +
    `<CanonicalizationMethod Algorithm="${C14N_ALG}"/>` +
    `<SignatureMethod Algorithm="${RSA_SHA1}"/>` +
    `<Reference URI="#${idAttr}">` +
    `<Transforms>` +
    `<Transform Algorithm="${ENV_ALG}"/>` +
    `<Transform Algorithm="${C14N_ALG}"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="${SHA1}"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const siDoc = Parse(signedInfoForSign)
  const siCanon = c14nElement(siDoc.documentElement!)
  const signatureBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    privateKey,
    new TextEncoder().encode(siCanon),
  )
  const signatureValue = bytesToBase64(signatureBuf)

  const signature =
    `<Signature xmlns="${DS_NS}">` +
    `<SignedInfo>` +
    `<CanonicalizationMethod Algorithm="${C14N_ALG}"/>` +
    `<SignatureMethod Algorithm="${RSA_SHA1}"/>` +
    `<Reference URI="#${idAttr}">` +
    `<Transforms>` +
    `<Transform Algorithm="${ENV_ALG}"/>` +
    `<Transform Algorithm="${C14N_ALG}"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="${SHA1}"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>` +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${leafCert}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`

  if (signature.includes('ds:') || signature.includes('xmlns:ds=')) {
    throw new Error('Assinatura NF-e gerada com prefixo ds: inesperado.')
  }

  const body = stripXmlDecl(unsignedXml)
  if (!/<\/NFe>\s*$/i.test(body)) {
    throw new Error('XML NF-e sem fechamento </NFe>.')
  }
  const signed = body.replace(/<\/NFe>\s*$/i, `${signature}</NFe>`)
  return `<?xml version="1.0" encoding="UTF-8"?>${signed}`
}
