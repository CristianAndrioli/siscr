import api from '../api';
import type { Pessoa, CrudService, ListParams, ApiResponse } from '../../types';

export const pessoasService: CrudService<Pessoa> = {
  list: async (params: ListParams = {}): Promise<ApiResponse<Pessoa> | Pessoa[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/pessoas', { params: query });
    return response.data.pessoas ?? [];
  },

  get: async (id: number | string): Promise<Pessoa> => {
    const response = await api.get(`/tenant/cadastros/pessoas/${id}`);
    return response.data;
  },

  create: async (dados: Partial<Pessoa>): Promise<Pessoa> => {
    const response = await api.post('/tenant/cadastros/pessoas', dados);
    return response.data;
  },

  update: async (id: number | string, dados: Partial<Pessoa>): Promise<Pessoa> => {
    const response = await api.put(`/tenant/cadastros/pessoas/${id}`, dados);
    return response.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/tenant/cadastros/pessoas/${id}`);
  },
};
