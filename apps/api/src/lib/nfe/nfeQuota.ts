/**
 * Cota mensal de emissões fiscais — reexporta o módulo unificado (NF-e + NFS-e).
 * @deprecated Use `lib/fiscalDocQuota`.
 */
export {
  assertFiscalDocQuotaAvailable as assertNfeQuotaAvailable,
  currentYm,
  getFiscalDocUsoMes as getNfeUsoMes,
  incrementFiscalDocUsoMes as incrementNfeUsoMes,
} from '../fiscalDocQuota'
