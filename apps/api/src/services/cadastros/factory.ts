import type { D1Database } from '@cloudflare/workers-types'
import { PessoaRepository } from '../../repositories/PessoaRepository'
import { ProdutoRepository } from '../../repositories/ProdutoRepository'
import { ServicoRepository } from '../../repositories/ServicoRepository'
import { PessoaService } from './PessoaService'
import { ProdutoService } from './ProdutoService'
import { ServicoService } from './ServicoService'

/**
 * Factories para os serviços do módulo de cadastros.
 *
 * Padrão: a rota chama `createXxxService(db, tenantId)` e recebe
 * o service já instanciado com o repositório escopado por tenant.
 * Isso mantém as rotas puras em transporte (HTTP ↔ JSON) e concentra
 * a composição num lugar só — facilita trocar implementações em teste.
 */

export function createPessoaService(db: D1Database, tenantId: string) {
  return new PessoaService(new PessoaRepository(db, tenantId))
}

export function createProdutoService(db: D1Database, tenantId: string) {
  return new ProdutoService(new ProdutoRepository(db, tenantId))
}

export function createServicoService(db: D1Database, tenantId: string) {
  return new ServicoService(new ServicoRepository(db, tenantId))
}
