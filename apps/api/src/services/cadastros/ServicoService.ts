import {
  ServicoRepository,
  type ServicoInsertRow,
  type ServicoUpdateFields,
  type ServicoListFilters,
} from '../../repositories/ServicoRepository'

/**
 * Regras de negócio para Serviços do tenant.
 *
 * Espelho do `ProdutoService`, mais simples: serviços não têm
 * tributação fiscal (NCM/CST) — são cadastros de catálogo para
 * NFS-e municipal. O campo `ativo` vem como boolean da API e é
 * convertido para INTEGER 0/1 no service.
 */
export class ServicoService {
  constructor(private readonly repo: ServicoRepository) {}

  list(filters: ServicoListFilters, limit: number, offset: number) {
    return this.repo.list(filters, limit, offset)
  }

  findById(id: string) {
    return this.repo.findById(id)
  }

  async create(
    input: ServicoCreateInput,
    auditUserId: string | null,
  ): Promise<{ id: string; codigo: string }> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const codigo = await this.repo.nextCodigo()

    const row: ServicoInsertRow = {
      id,
      empresaId: input.empresaId ?? null,
      codigo,
      sku: input.sku ?? null,
      descricao: input.descricao,
      unidade: input.unidade,
      preco: input.preco,
      ativo: input.ativo === false ? 0 : 1,
      createdAt: now,
      auditUserId,
    }
    await this.repo.insert(row)
    return { id, codigo }
  }

  update(
    id: string,
    input: ServicoUpdateInput,
    auditUserId: string | null,
  ): Promise<boolean> {
    const patch: ServicoUpdateFields = {
      sku: input.sku,
      descricao: input.descricao,
      unidade: input.unidade,
      preco: input.preco,
      empresaId: input.empresaId,
    }
    if (input.ativo !== undefined) {
      patch.ativo = input.ativo ? 1 : 0
    }
    return this.repo.update(id, patch, auditUserId)
  }

  delete(id: string) {
    return this.repo.delete(id)
  }
}

export type ServicoCreateInput = {
  sku?: string
  descricao: string
  unidade: string
  preco: number
  ativo?: boolean
  empresaId?: string
}

export type ServicoUpdateInput = Omit<ServicoUpdateFields, 'ativo'> & { ativo?: boolean }
