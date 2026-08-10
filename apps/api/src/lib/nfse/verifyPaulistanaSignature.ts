/**
 * Verifica XML-DSig do PedidoEnvioLoteRPS (Paulistana) com xmldsigjs.
 */

import { Parse, SignedXml } from 'xmldsigjs'
import { ensureXmlCoreNodeDependencies } from '../nfe/xmlCoreWorkerDeps'

const DS_NS = 'http://www.w3.org/2000/09/xmldsig#'

export type VerificacaoAssinaturaNfse = {
  possuiAssinatura: boolean
  valida: boolean
  mensagem: string
}

/**
 * Confere digest + RSA da Signature envelopada no PedidoEnvioLoteRPS.
 * Se falhar localmente, a Prefeitura também rejeitaria com 1057.
 */
export async function verificarAssinaturaPaulistanaXml(
  xml: string,
): Promise<VerificacaoAssinaturaNfse> {
  ensureXmlCoreNodeDependencies()
  const doc = Parse(xml)
  const root = doc.documentElement
  if (!root || root.localName !== 'PedidoEnvioLoteRPS') {
    return {
      possuiAssinatura: false,
      valida: false,
      mensagem: 'Documento não é PedidoEnvioLoteRPS.',
    }
  }

  const sigList = root.getElementsByTagNameNS(DS_NS, 'Signature')
  if (!sigList.length) {
    return {
      possuiAssinatura: false,
      valida: false,
      mensagem: 'XML sem Signature (XML-DSig).',
    }
  }

  try {
    const signedXml = new SignedXml(doc)
    signedXml.LoadXml(sigList[0]!)
    const valida = await signedXml.Verify()
    return {
      possuiAssinatura: true,
      valida,
      mensagem: valida
        ? 'Assinatura XML-DSig válida (digest e RSA conferem).'
        : 'Assinatura presente, mas a verificação local falhou — Prefeitura rejeitaria com 1057.',
    }
  } catch (e) {
    const det = e instanceof Error ? e.message : String(e)
    return {
      possuiAssinatura: true,
      valida: false,
      mensagem: `Erro ao verificar assinatura Paulistana: ${det}`,
    }
  }
}
