/**
 * Importação de documentos fiscais de **entrada** (tomador / comprador).
 *
 * Famílias:
 * - **NFe layout nacional** (`infNFe`, Portal Fiscal ICMS): modelo **55** (NF-e mercadoria) e **65** (NFC-e consumidor)
 *   compartilham o mesmo schema XML e parser base; divergem em regras de negócio (destinatário, PDV, etc.).
 * - **NFS-e**: ISS municipal / padrão nacional — XML, XSD e identificação **outros** do layout NF-e
 *   (ex.: `NFSe_v1.00.xsd`, DPS). Deve ter parser e persistência próprios quando implementados.
 *
 * Referências: MOC NF-e (Receita/SEFAZ); pacotes XSD NFS-e nacional (gov.br / ambientes municipais).
 */

/** Discriminante de produto para UI e roteamento de serviço. */
export type FiscalEntradaKind = 'nfe' | 'nfce' | 'nfse'

/** Família técnica antes do parse completo. */
export type FiscalXmlFamily = 'nfe_icms' | 'nfse' | 'desconhecido'

export type DeteccaoFiscalXml =
  | { family: 'nfe_icms'; observacao?: string }
  | { family: 'nfse'; observacao?: string }
  | { family: 'desconhecido'; motivo: string }
