import api from '../api';
import type { Servico, CrudService, ListParams, ApiResponse } from '../../types';

export const servicosService: CrudService<Servico> = {
  list: async (params: ListParams = {}): Promise<ApiResponse<Servico> | Servico[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/servicos', { params: query });
    return response.data.servicos ?? [];
  },

  get: async (id: number | string): Promise<Servico> => {
    const response = await api.get(`/tenant/cadastros/servicos/${id}`);
    return response.data;
  },

  create: async (dados: Partial<Servico>): Promise<Servico> => {
    const response = await api.post('/tenant/cadastros/servicos', dados);
    return response.data;
  },

  update: async (id: number | string, dados: Partial<Servico>): Promise<Servico> => {
    const response = await api.put(`/tenant/cadastros/servicos/${id}`, dados);
    return response.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/tenant/cadastros/servicos/${id}`);
  },
};
