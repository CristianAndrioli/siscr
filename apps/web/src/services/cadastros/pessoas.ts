import api from '../api';

export interface Pessoa {
  id: string;
  tipo: 'PF' | 'PJ';
  tipo_cadastro: 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora';
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
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
}

export const pessoasService = {
  list: async (params: { search?: string; page?: number } = {}): Promise<Pessoa[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/pessoas', { params: query });
    return response.data.pessoas ?? [];
  },

  get: async (id: string): Promise<Pessoa> => {
    const response = await api.get(`/tenant/cadastros/pessoas/${id}`);
    return response.data;
  },

  create: async (dados: PessoaForm): Promise<{ id: string }> => {
    const response = await api.post('/tenant/cadastros/pessoas', dados);
    return response.data;
  },

  update: async (id: string, dados: Partial<PessoaForm>): Promise<void> => {
    await api.put(`/tenant/cadastros/pessoas/${id}`, dados);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/pessoas/${id}`);
  },
};
