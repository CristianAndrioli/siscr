import api from '../api';

export interface Pessoa {
  id: string;
  codigo?: number;
  tipo: 'PF' | 'PJ';
  tipo_cadastro: 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora';
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
  ativo: number;
  created_at: string;
}

export interface PessoaForm {
  tipo: 'PF' | 'PJ';
  tipoCadastro: 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora';
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
}

/** Remove campos de string vazia para não falhar validação opcional na API */
function sanitize<T extends Record<string, unknown>>(dados: T): T {
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
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<PessoasListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
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
};
