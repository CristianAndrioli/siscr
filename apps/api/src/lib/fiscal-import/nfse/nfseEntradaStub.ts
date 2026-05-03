/**
 * Importação de **NFS-e** como tomador de serviços (entrada).
 *
 * Layout diferente da NF-e: mensagens municipais / NFS-e nacional (`NFSe_v*.xsd`, DPS, CNC).
 * Próximos passos: parser por XSD nacional + tabela `nfse_entradas` ou documento genérico com `tipo`.
 */
export function parseNfseEntradaXmlNaoImplementado(_xml: string): never {
  throw new Error(
    'Importação de NFS-e (tomador) ainda não está disponível. Use NF-e/NFC-e (XML ICMS) ou aguarde o módulo NFS-e.',
  )
}
