/**
 * Assinatura XML-DSig enveloped (RSA-SHA1) genérica para DPS / PedidoEnvioLoteRPS.
 * Reutiliza a mesma extração de chave do A1 usada na NF-e.
 */

import { Parse, XmlDsigC14NTransform } from 'xmldsigjs'
import { ensureXmlCoreNodeDependencies } from '../nfe/xmlCoreWorkerDeps'
import { pfxToWebCryptoRsaSha1 } from '../nfe/signNfeXml'

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'
const C14N_ALG = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENV_ALG = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1'

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

function findElementById(root: Element, idAttr: string): Element {
  const walk = (el: Element): Element | null => {
    if ((el.getAttribute('Id') || el.getAttribute('id') || '') === idAttr) return el
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i]
      if (n.nodeType === 1) {
        const found = walk(n as Element)
        if (found) return found
      }
    }
    return null
  }
  const found = walk(root)
  if (!found) throw new Error(`Elemento com Id="${idAttr}" não encontrado no XML.`)
  return found
}

/**
 * Assina o documento XML envelopando Signature no elemento raiz.
 * O digest é calculado sobre o elemento com atributo Id = `idAttr`.
 */
export async function signXmlEnvelopedWithA1(
  unsignedXml: string,
  idAttr: string,
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
  const root = doc.documentElement
  if (!root) throw new Error('XML inválido: sem elemento raiz.')

  const target = findElementById(root, idAttr)
  const digestCanon = c14nElement(target)
  const digestValue = bytesToBase64(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(digestCanon)))

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

  const body = stripXmlDecl(unsignedXml)
  const closeTag = `</${root.localName}>`
  const idx = body.lastIndexOf(closeTag)
  if (idx < 0) {
    throw new Error(`XML sem fechamento ${closeTag}.`)
  }
  const signed = body.slice(0, idx) + signature + body.slice(idx)
  return `<?xml version="1.0" encoding="UTF-8"?>${signed}`
}
