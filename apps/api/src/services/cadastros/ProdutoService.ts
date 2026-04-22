import {
  ProdutoRepository,
  type ProdutoInsertRow,
  type ProdutoUpdateFields,
  type ProdutoListFilters,
} from '../../repositories/ProdutoRepository'

/**
 * Regras de negócio para Produtos do tenant.
 *
 * Responsabilidade
 * -----------------------------------------------------------------
 * - Traduzir o contrato de API em `ProdutoInsertRow` (aplicando
 *   defaults de CST PIS/Cofins, origem, etc.).
 * - Coordenar `nextCodigo()` + INSERT como operação atômica (do ponto
 *   de vista do caller).
 * - Traduzir erros UNIQUE (SKU duplicado) em mensagens de domínio.
 *
 * Observação
 * -----------------------------------------------------------------
 * D1/SQLite não tem erro tipado para UNIQUE — por isso o caller de
 * `create()`/`update()` pode embrulhar em try/catch e diferenciar
 * pela mensagem. Futuramente, podemos centralizar essa detecção aqui
 * (ver `isUniqueViolation` em uma próxima iteração).
 */
export class ProdutoService {
  constructor(private readonly repo: ProdutoRepository) {}

  list(filters: ProdutoListFilters, limit: number, offset: number) {
    return this.repo.list(filters, limit, offset)
  }

  findById(id: string) {
    return this.repo.findById(id)
  }

  async create(
    input: ProdutoCreateInput,
    auditUserId: string | null,
  ): Promise<{ id: string; codigo: string }> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const codigo = await this.repo.nextCodigo()

    const row: ProdutoInsertRow = {
      id,
      empresaId: input.empresaId ?? null,
      codigo,
      sku: input.sku ?? null,
      descricao: input.descricao,
      unidade: input.unidade,
      precoVenda: input.precoVenda,
      precoCusto: input.precoCusto ?? 0,
      ncm: input.ncm ?? null,
      origem: input.origem ?? 0,
      cest: input.cest ?? null,
      icmsCst: input.icmsCst ?? null,
      icmsCsosn: input.icmsCsosn ?? null,
      pisCst: input.pisCst ?? '07',
      cofinsCst: input.cofinsCst ?? '07',
      ativo: input.ativo === false ? 0 : 1,
      createdAt: now,
      auditUserId,
    }
    await this.repo.insert(row)
    return { id, codigo }
  }

  /**
   * Atualiza produto normalizando `ativo` boolean→int.
   * Retorna `false` quando o patch é vazio (caller = HTTP 400).
   */
  update(
    id: string,
    input: ProdutoUpdateInput,
    auditUserId: string | null,
  ): Promise<boolean> {
    const patch: ProdutoUpdateFields = {
      sku: input.sku,
      descricao: input.descricao,
      unidade: input.unidade,
      precoVenda: input.precoVenda,
      precoCusto: input.precoCusto,
      ncm: input.ncm,
      origem: input.origem,
      cest: input.cest,
      icmsCst: input.icmsCst,
      icmsCsosn: input.icmsCsosn,
      pisCst: input.pisCst,
      cofinsCst: input.cofinsCst,
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

export type ProdutoCreateInput = {
  sku?: string
  descricao: string
  unidade: string
  precoVenda: number
  precoCusto?: number
  ncm?: string
  origem?: number
  cest?: string
  icmsCst?: string
  icmsCsosn?: string
  pisCst?: string
  cofinsCst?: string
  ativo?: boolean
  empresaId?: string
}

export type ProdutoUpdateInput = Omit<ProdutoUpdateFields, 'ativo'> & { ativo?: boolean }
