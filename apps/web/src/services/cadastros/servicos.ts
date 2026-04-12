import api from '../api';

export interface Servico {
  id: string;
  codigo: string;
  sku?: string;
  descricao: string;
  unidade: string;
  preco: number;
  ativo: number;
}

export interface ServicoForm {
  sku?: string;
  descricao: string;
  unidade: string;
  preco: number;
  ativo: boolean;
}

export type ServicosListResult = {
  servicos: Servico[];
  total: number;
  page: number;
  limit: number;
};

export const servicosService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<ServicosListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/servicos', { params: query });
    const d = response.data;
    return {
      servicos: d.servicos ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
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
