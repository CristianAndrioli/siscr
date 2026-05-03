/**
 * # Fiscal import (entrada)
 *
 * Pipeline desejado:
 * 1. `detectarFamiliaXmlFiscal(xml)` → família (`nfe_icms` | `nfse` | desconhecido).
 * 2. Família **nfe_icms**: `parseNfeEntradaXml` → `classificarNfeEntradaKind` → **nfe** vs **nfce**
 *    → políticas em `nfe/destinatarioPolicies.ts` (comum + específico modelo 65).
 * 3. Família **nfse**: parser dedicado (futuro) + serviço `NfseEntradaService` (espelha padrão nacional/municipal).
 *
 * O sistema atual persiste entradas ICMS em `nf_entradas`; NFS-e exigirá modelo de dados alinhado ao ISS.
 */

export type { DeteccaoFiscalXml, FiscalEntradaKind, FiscalXmlFamily } from './types'
export { detectarFamiliaXmlFiscal, erroSeFamiliaNaoSuportadaEntrada, familyParaLabel } from './detectFiscalXml'
export { classificarNfeEntradaKind } from './nfe/classifyNfeEntrada'
export {
  assertDestinatarioEhEmpresa,
  assertImportacaoEntradaPermitida,
  assertPreviewDestinatarioPermitido,
  cnpjDestinatarioParaGravacao,
} from './nfe/destinatarioPolicies'
export { parseNfseEntradaXmlNaoImplementado } from './nfse/nfseEntradaStub'
