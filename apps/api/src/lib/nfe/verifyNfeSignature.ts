import { Parse, SignedXml } from 'xmldsigjs'
import { ensureXmlCoreNodeDependencies } from './xmlCoreWorkerDeps'

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'

export type VerificacaoAssinaturaNfe = {
  possuiAssinatura: boolean
  valida: boolean
  mensagem: string
  signatureMethod?: string
  digestMethod?: string
}

/**
 * Valida a assinatura XML-DSig de uma NF-e (referência enveloped ao `infNFe`).
 */
export async function verificarAssinaturaNfeXml(xml: string): Promise<VerificacaoAssinaturaNfe> {
  ensureXmlCoreNodeDependencies()
  const doc = Parse(xml)
  const nfe = doc.documentElement
  if (!nfe || nfe.localName !== 'NFe') {
    return { possuiAssinatura: false, valida: false, mensagem: 'Documento não é uma NF-e (raiz NFe ausente).' }
  }

  const sigList = nfe.getElementsByTagNameNS(DS_NS, 'Signature')
  if (!sigList.length) {
    return {
      possuiAssinatura: false,
      valida: false,
      mensagem: 'XML sem assinatura digital (elemento Signature ausente).',
    }
  }

  const sigEl = sigList[0]!
  const signedXml = new SignedXml(doc)
  signedXml.LoadXml(sigEl)

  const signatureMethod = signedXml.XmlSignature.SignedInfo.SignatureMethod?.Algorithm
  let digestMethod: string | undefined
  const refs = signedXml.XmlSignature.SignedInfo.References as unknown as {
    GetIterator?: () => Iterable<{ DigestMethod?: { Algorithm?: string } }>
  }
  if (refs.GetIterator) {
    for (const ref of refs.GetIterator()) {
      digestMethod = ref.DigestMethod?.Algorithm
      break
    }
  }

  try {
    const valida = await signedXml.Verify()
    return {
      possuiAssinatura: true,
      valida,
      mensagem: valida
        ? 'Assinatura XML-DSig válida (digest e RSA conferem com o certificado embutido).'
        : 'Assinatura presente, mas a verificação falhou (conteúdo alterado ou assinatura corrompida).',
      signatureMethod,
      digestMethod,
    }
  } catch (e) {
    const det = e instanceof Error ? e.message : String(e)
    return {
      possuiAssinatura: true,
      valida: false,
      mensagem: `Erro ao verificar assinatura: ${det}`,
      signatureMethod,
      digestMethod,
    }
  }
}
