import api from '../api';
import type { Produto, CrudService, ListParams, ApiResponse } from '../../types';

export const produtosService: CrudService<Produto> = {
  list: async (params: ListParams = {}): Promise<ApiResponse<Produto> | Produto[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/produtos', { params: query });
    return response.data.produtos ?? [];
  },

  get: async (id: number | string): Promise<Produto> => {
    const response = await api.get(`/tenant/cadastros/produtos/${id}`);
    return response.data;
  },

  create: async (dados: Partial<Produto>): Promise<Produto> => {
    const response = await api.post('/tenant/cadastros/produtos', dados);
    return response.data;
  },

  update: async (id: number | string, dados: Partial<Produto>): Promise<Produto> => {
    const response = await api.put(`/tenant/cadastros/produtos/${id}`, dados);
    return response.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/tenant/cadastros/produtos/${id}`);
  },
};
