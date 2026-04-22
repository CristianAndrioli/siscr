import type { D1Database } from '@cloudflare/workers-types'
import { CotacaoRepository } from '../../repositories/CotacaoRepository'
import { CotacaoService } from './CotacaoService'

/**
 * Factories para os services do módulo de faturamento.
 *
 * Hoje só Cotação está extraída — NFe e NFSe ainda vivem direto em
 * `routes/faturamento.ts` porque a lógica envolve SEFAZ externa e
 * é extensa. Refatorar em outra iteração (`NFeService`,
 * `NFSeService` com ports para transporte).
 */
export function createCotacaoService(db: D1Database, tenantId: string) {
  return new CotacaoService(new CotacaoRepository(db, tenantId))
}
