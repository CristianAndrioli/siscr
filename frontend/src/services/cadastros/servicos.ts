/**
 * Service para gerenciar Serviços
 */
import api from '../api';
import type { Servico, CrudService, ListParams, ProximoCodigoResponse, ApiResponse } from '../../types';

export const servicosService: CrudService<Servico> = {
  list: async (params: ListParams = {}): Promise<ApiResponse<Servico> | Servico[]> => {
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<Servico>>('/cadastros/servicos/', { params: drfParams });
    return response.data;
  },

  get: async (codigo: number | string): Promise<Servico> => {
    const response = await api.get<Servico>(`/cadastros/servicos/${codigo}/`);
    return response.data;
  },

  create: async (dados: Partial<Servico>): Promise<Servico> => {
    const response = await api.post<Servico>('/cadastros/servicos/', dados);
    return response.data;
  },

  update: async (codigo: number | string, dados: Partial<Servico>): Promise<Servico> => {
    const response = await api.put<Servico>(`/cadastros/servicos/${codigo}/`, dados);
    return response.data;
  },

  delete: async (codigo: number | string): Promise<void> => {
    await api.delete(`/cadastros/servicos/${codigo}/`);
  },

  proximoCodigo: async (): Promise<ProximoCodigoResponse> => {
    const response = await api.get<ProximoCodigoResponse>('/cadastros/servicos/proximo_codigo/');
    return response.data;
  },
};

