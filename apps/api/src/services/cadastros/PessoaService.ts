import {
  PessoaRepository,
  type PessoaInsertRow,
  type PessoaUpdateFields,
  type PessoaListFilters,
} from '../../repositories/PessoaRepository'

/**
 * Regras de negócio para Pessoas (clientes, fornecedores,
 * funcionários, transportadoras) no SISCR.
 *
 * Responsabilidade
 * -----------------------------------------------------------------
 * - Montar a "shape" do insert/update a partir do contrato de API.
 * - Aplicar defaults de domínio (ex.: `indIeDest = '9'` quando não
 *   informado, `codigoPais = '1058'` para Brasil).
 * - Fornecer método `list()` com o mesmo contrato de filtros da rota.
 *
 * Não-responsabilidade
 * -----------------------------------------------------------------
 * - Escrever SQL (fica no repo).
 * - Ler body/headers HTTP (fica na rota).
 * - Paginação (o caller já resolveu limit/offset via helper).
 */
export class PessoaService {
  constructor(private readonly repo: PessoaRepository) {}

  list(filters: PessoaListFilters, limit: number, offset: number) {
    return this.repo.list(filters, limit, offset)
  }

  findById(id: string) {
    return this.repo.findById(id)
  }

  async create(input: PessoaCreateInput, auditUserId: string | null): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: PessoaInsertRow = {
      id,
      empresaId: input.empresaId ?? null,
      filialId: input.filialId ?? null,
      tipo: input.tipo,
      tipoCadastro: input.tipoCadastro,
      nome: input.nome,
      cpfCnpj: input.cpfCnpj ?? null,
      email: input.email ?? null,
      telefone: input.telefone ?? null,
      cep: input.cep ?? null,
      logradouro: input.logradouro ?? null,
      numero: input.numero ?? null,
      complemento: input.complemento ?? null,
      bairro: input.bairro ?? null,
      cidade: input.cidade ?? null,
      uf: input.uf ?? null,
      inscricaoEstadual: input.inscricaoEstadual ?? null,
      indIeDest: input.indIeDest ?? '9',
      codigoMunicipio: input.codigoMunicipio ?? null,
      codigoPais: input.codigoPais ?? '1058',
      comissaoPercentual: input.comissaoPercentual ?? null,
      metaMensal: input.metaMensal ?? null,
      matricula: input.matricula ?? null,
      tipoOperador: input.tipoOperador ?? null,
      cnhNumero: input.cnhNumero ?? null,
      cnhCategoria: input.cnhCategoria ?? null,
      cnhValidade: input.cnhValidade ?? null,
      createdAt: now,
      auditUserId,
    }
    await this.repo.insert(row)
    return id
  }

  /**
   * Atualiza pessoa. Retorna `false` quando nenhum campo válido
   * foi informado — caller deve responder HTTP 400.
   */
  update(id: string, patch: PessoaUpdateFields, auditUserId: string | null): Promise<boolean> {
    return this.repo.update(id, patch, auditUserId)
  }

  delete(id: string) {
    return this.repo.delete(id)
  }
}

export type PessoaCreateInput = {
  tipo: 'PF' | 'PJ'
  tipoCadastro: 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora' | 'vendedor'
  nome: string
  cpfCnpj?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  inscricaoEstadual?: string
  indIeDest?: string
  codigoMunicipio?: string
  codigoPais?: string
  empresaId?: string
  filialId?: string
  comissaoPercentual?: number
  metaMensal?: number
  matricula?: string
  tipoOperador?: string
  cnhNumero?: string
  cnhCategoria?: string
  cnhValidade?: string
}
