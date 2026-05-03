import type { NfeEntradaParsed } from '../../nfe/parseNfeEntradaXml'
import type { FiscalEntradaKind } from '../types'

/**
 * Após `parseNfeEntradaXml`: discrimina **nfe** (modelo 55 e demais não-65) vs **nfce** (modelo 65).
 * Ambos usam o mesmo layout XML nacional; a diferenciação é fiscal-operacional (MOC `ide/mod`).
 */
export function classificarNfeEntradaKind(parsed: NfeEntradaParsed): Extract<FiscalEntradaKind, 'nfe' | 'nfce'> {
  return parsed.modelo === 65 ? 'nfce' : 'nfe'
}
