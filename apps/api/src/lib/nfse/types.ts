/**
 * Adaptadores municipais NFS-e (SP Paulistana × Chapecó / Sistema Nacional).
 * Separado do pipeline SEFAZ da NF-e.
 */

export const CMUN_SP_CAPITAL = '3550308'
export const CMUN_CHAPECO = '4204202'

export type NfseAdapterKind = 'paulistana' | 'nacional' | 'unsupported'

export function resolveNfseAdapterKind(codigoMunicipio: string | null | undefined): NfseAdapterKind {
  const c = String(codigoMunicipio ?? '').replace(/\D/g, '')
  if (c === CMUN_SP_CAPITAL) return 'paulistana'
  if (c === CMUN_CHAPECO) return 'nacional'
  return 'unsupported'
}

export function nfseAdapterLabel(kind: NfseAdapterKind): string {
  switch (kind) {
    case 'paulistana':
      return 'Nota Fiscal Paulistana (São Paulo capital)'
    case 'nacional':
      return 'Sistema Nacional NFS-e (Chapecó)'
    default:
      return 'Município não suportado nesta versão'
  }
}

export type NfseTransmitInput = {
  xmlAssinado: string
  ambiente: 1 | 2
  /** CNPJ do prestador (apenas dígitos). */
  cnpjPrestador: string
  cert: { pfxBytes: ArrayBuffer; password: string }
}

export type NfseTransmitResult = {
  autorizada: boolean
  /** Número da NFS-e municipal / protocolo / chave. */
  protocolo: string | null
  chaveAcesso: string | null
  /** Código de retorno bruto (cStat, Código, HTTP…). */
  cStat: string
  xMotivo: string
  /** XML NFS-e autorizada (nacional) ou resposta SOAP (Paulistana). */
  xmlRetorno: string | null
  dhRecbto: string | null
}

export interface NfseMunicipalAdapter {
  readonly kind: NfseAdapterKind
  transmitir(
    env: import('../../index').Env,
    tenantId: string,
    input: NfseTransmitInput,
  ): Promise<NfseTransmitResult>
}
