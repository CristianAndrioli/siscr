import { resolveNfseAdapterKind, type NfseMunicipalAdapter } from './types'
import { paulistanaAdapter } from './adapters/paulistana'
import { nacionalAdapter } from './adapters/nacional'

export function getNfseAdapter(codigoMunicipio: string | null | undefined): NfseMunicipalAdapter {
  const kind = resolveNfseAdapterKind(codigoMunicipio)
  if (kind === 'paulistana') return paulistanaAdapter
  if (kind === 'nacional') return nacionalAdapter
  throw new Error(
    `Município IBGE "${codigoMunicipio || '—'}" sem adapter NFS-e. ` +
      'Nesta versão: São Paulo capital (3550308) e Chapecó (4204202). Configure o código do município em Empresas/Filiais.',
  )
}

export {
  resolveNfseAdapterKind,
  nfseAdapterLabel,
  CMUN_SP_CAPITAL,
  CMUN_CHAPECO,
} from './types'
export type { NfseAdapterKind, NfseTransmitResult } from './types'
