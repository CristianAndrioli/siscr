import {
  CotacaoRepository,
  type CotacaoInsertRow,
  type CotacaoItemRow,
  type CotacaoListFilters,
  type CotacaoStatus,
  type CotacaoTipo,
  type CotacaoUpdatePatch,
} from '../../repositories/CotacaoRepository'

/**
 * Regras de negócio para Cotações.
 *
 * Responsabilidade
 * -----------------------------------------------------------------
 * - Calcular `valorTotal` a partir dos itens + desconto de cabeçalho.
 * - Gerar número sequencial via repositório.
 * - Passar o conjunto (header + itens) ao repo em UMA batch atômica.
 *
 * Não-responsabilidade
 * -----------------------------------------------------------------
 * - Emissão/validação de NF (ver rotas /notas).
 * - Tributação (serviço separado).
 */
export class CotacaoService {
  constructor(private readonly repo: CotacaoRepository) {}

  list(filters: CotacaoListFilters) {
    return this.repo.list(filters)
  }

  findById(id: string) {
    return this.repo.findWithItems(id)
  }

  updateStatusBatch(ids: string[], status: CotacaoStatus, auditUserId: string | null) {
    return this.repo.updateStatusBatch(ids, status, auditUserId)
  }

  async create(
    input: CotacaoCreateInput,
    auditUserId: string | null,
  ): Promise<{ id: string; numero: string }> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const numero = await this.repo.nextNumero()

    const itens: CotacaoItemRow[] = input.itens.map((i) => ({
      produtoId: i.produtoId ?? null,
      servicoId: i.servicoId ?? null,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto ?? 0,
      unidade: i.unidade ?? 'UN',
    }))

    const valorTotal = CotacaoService.calcTotal(itens) - (input.desconto ?? 0)

    const row: CotacaoInsertRow = {
      id,
      numero,
      tipo: input.tipo ?? 'venda',
      pessoaId: input.pessoaId ?? null,
      validade: input.validade ?? null,
      observacoes: input.observacoes ?? null,
      desconto: input.desconto ?? 0,
      valorTotal,
      status: input.status ?? 'rascunho',
      createdAt: now,
      auditUserId,
    }

    await this.repo.createWithItens(row, itens)
    return { id, numero }
  }

  async update(
    id: string,
    input: CotacaoUpdateInput,
    auditUserId: string | null,
  ): Promise<void> {
    const itens = input.itens
      ? input.itens.map((i) => ({
          produtoId: i.produtoId ?? null,
          servicoId: i.servicoId ?? null,
          descricao: i.descricao ?? '',
          quantidade: i.quantidade ?? 0,
          valorUnitario: i.valorUnitario ?? 0,
          desconto: i.desconto ?? 0,
          unidade: i.unidade ?? 'UN',
        }))
      : null

    const patch: CotacaoUpdatePatch = {
      pessoaId: input.pessoaId,
      validade: input.validade,
      observacoes: input.observacoes,
      desconto: input.desconto,
      status: input.status,
    }

    // Se itens mudaram, recalcula total; senão, deixa o `valorTotal`
    // atual no banco como está (não tocamos nele).
    if (itens) {
      patch.valorTotal = CotacaoService.calcTotal(itens) - (input.desconto ?? 0)
    }

    await this.repo.updateWithItens(id, patch, itens, auditUserId)
  }

  delete(id: string) {
    return this.repo.delete(id)
  }

  /** Somatório dos itens: `sum(qtd * valor_unitário - desconto_item)`. */
  static calcTotal(itens: { quantidade: number; valorUnitario: number; desconto: number }[]): number {
    return itens.reduce((s, i) => s + (i.quantidade * i.valorUnitario - (i.desconto ?? 0)), 0)
  }
}

// ─── Tipos de entrada (contratos públicos) ────────────────────────

export type CotacaoItemInput = {
  produtoId?: string
  servicoId?: string
  descricao: string
  quantidade: number
  valorUnitario: number
  desconto?: number
  unidade?: string
}

export type CotacaoCreateInput = {
  tipo?: CotacaoTipo
  pessoaId?: string
  validade?: string
  observacoes?: string
  desconto?: number
  status?: CotacaoStatus
  itens: CotacaoItemInput[]
}

export type CotacaoUpdateInput = {
  pessoaId?: string | null
  validade?: string | null
  observacoes?: string | null
  desconto?: number
  status?: CotacaoStatus
  itens?: Partial<CotacaoItemInput>[]
}
