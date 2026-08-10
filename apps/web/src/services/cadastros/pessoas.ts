import api from '../api';

export type PessoaCadastroTipo = 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora' | 'vendedor';

export interface Pessoa {
  id: string;
  codigo?: number;
  tipo: 'PF' | 'PJ';
  tipo_cadastro: PessoaCadastroTipo;
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  // endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  inscricao_estadual?: string | null;
  ind_ie_dest?: string | null;
  codigo_municipio?: string | null;
  codigo_pais?: string | null;
  // papel "vendedor"
  comissao_percentual?: number | null;
  meta_mensal?: number | null;
  // papel "funcionário/operador"
  matricula?: string | null;
  tipo_operador?: string | null;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  ativo: number;
  created_at: string;
}

export interface PessoaForm {
  tipo: 'PF' | 'PJ';
  tipoCadastro: PessoaCadastroTipo;
  nome: string;
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  // endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  inscricaoEstadual?: string;
  indIeDest?: '1' | '2' | '9';
  codigoMunicipio?: string;
  codigoPais?: string;
  comissaoPercentual?: number;
  metaMensal?: number;
  matricula?: string;
  tipoOperador?: string;
  cnhNumero?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
}

/** Remove campos de string vazia para não falhar validação opcional na API */
function sanitize<T extends object>(dados: T): T {
  return Object.fromEntries(
    Object.entries(dados).filter(([, v]) => v !== ''),
  ) as T;
}

export type PessoasListResult = {
  pessoas: Pessoa[];
  total: number;
  page: number;
  limit: number;
};

export const pessoasService = {
  list: async (params: { search?: string; page?: number; limit?: number; tipoCadastro?: PessoaCadastroTipo } = {}): Promise<PessoasListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.tipoCadastro) query.tipoCadastro = params.tipoCadastro;
    const response = await api.get('/tenant/cadastros/pessoas', { params: query });
    const d = response.data;
    return {
      pessoas: d.pessoas ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  get: async (id: string): Promise<Pessoa> => {
    const response = await api.get(`/tenant/cadastros/pessoas/${id}`);
    return response.data;
  },

  create: async (dados: PessoaForm): Promise<{ id: string }> => {
    const response = await api.post('/tenant/cadastros/pessoas', sanitize(dados));
    return response.data;
  },

  update: async (id: string, dados: Partial<PessoaForm>): Promise<void> => {
    await api.put(`/tenant/cadastros/pessoas/${id}`, sanitize(dados));
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/pessoas/${id}`);
  },

  seedDemo: async (): Promise<{
    ok: boolean;
    pessoas: number;
    produtos: number;
    servicos: number;
    message?: string;
  }> => {
    const response = await api.post('/tenant/cadastros/seed');
    return response.data;
  },
};
