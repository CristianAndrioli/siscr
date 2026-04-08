import api from '../api';

export interface Servico {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco: number;
  ativo: number;
}

export interface ServicoForm {
  descricao: string;
  unidade: string;
  preco: number;
  ativo: boolean;
}

export const servicosService = {
  list: async (params: { search?: string; page?: number } = {}): Promise<Servico[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/servicos', { params: query });
    return response.data.servicos ?? [];
  },

  get: async (id: string): Promise<Servico> => {
    const response = await api.get(`/tenant/cadastros/servicos/${id}`);
    return response.data;
  },

  create: async (dados: ServicoForm): Promise<{ id: string }> => {
    const response = await api.post('/tenant/cadastros/servicos', dados);
    return response.data;
  },

  update: async (id: string, dados: Partial<ServicoForm>): Promise<void> => {
    await api.put(`/tenant/cadastros/servicos/${id}`, dados);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/servicos/${id}`);
  },
};
