/**
 * Service para gerenciar Produtos
 */
import api from '../api';
import type { Produto, CrudService, ListParams, ProximoCodigoResponse, ApiResponse } from '../../types';

export const produtosService: CrudService<Produto> = {
  list: async (params: ListParams = {}): Promise<ApiResponse<Produto> | Produto[]> => {
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<Produto>>('/cadastros/produtos/', { params: drfParams });
    return response.data;
  },

  get: async (codigo: number | string): Promise<Produto> => {
    const response = await api.get<Produto>(`/cadastros/produtos/${codigo}/`);
    return response.data;
  },

  create: async (dados: Partial<Produto>): Promise<Produto> => {
    const response = await api.post<Produto>('/cadastros/produtos/', dados);
    return response.data;
  },

  update: async (codigo: number | string, dados: Partial<Produto>): Promise<Produto> => {
    const response = await api.put<Produto>(`/cadastros/produtos/${codigo}/`, dados);
    return response.data;
  },

  delete: async (codigo: number | string): Promise<void> => {
    await api.delete(`/cadastros/produtos/${codigo}/`);
  },

  proximoCodigo: async (): Promise<ProximoCodigoResponse> => {
    const response = await api.get<ProximoCodigoResponse>('/cadastros/produtos/proximo_codigo/');
    return response.data;
  },
};

