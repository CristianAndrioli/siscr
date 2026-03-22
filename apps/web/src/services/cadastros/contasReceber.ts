/**
 * Service para gerenciar Contas a Receber
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';
import type { ContaReceber, CrudService, ListParams, ProximoCodigoResponse, ApiResponse } from '../../types';

export const contasReceberService: CrudService<ContaReceber> = {
  // Listar todas as contas a receber
  list: async (params: ListParams = {}): Promise<ApiResponse<ContaReceber> | ContaReceber[]> => {
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<ContaReceber>>('/cadastros/contas-receber/', { params: drfParams });
    return response.data;
  },

  // Buscar conta por código
  get: async (codigo: number | string): Promise<ContaReceber> => {
    const response = await api.get<ContaReceber>(`/cadastros/contas-receber/${codigo}/`);
    return response.data;
  },

  // Criar nova conta
  create: async (dados: Partial<ContaReceber>): Promise<ContaReceber> => {
    const response = await api.post<ContaReceber>('/cadastros/contas-receber/', dados);
    return response.data;
  },

  // Atualizar conta
  update: async (codigo: number | string, dados: Partial<ContaReceber>): Promise<ContaReceber> => {
    const response = await api.put<ContaReceber>(`/cadastros/contas-receber/${codigo}/`, dados);
    return response.data;
  },

  // Excluir conta
  delete: async (codigo: number | string): Promise<void> => {
    await api.delete(`/cadastros/contas-receber/${codigo}/`);
  },

  // Buscar próximo código disponível
  proximoCodigo: async (): Promise<ProximoCodigoResponse> => {
    const response = await api.get<ProximoCodigoResponse>('/cadastros/contas-receber/proximo_codigo/');
    return response.data;
  },
};

