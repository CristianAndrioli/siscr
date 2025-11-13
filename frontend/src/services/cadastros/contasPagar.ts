/**
 * Service para gerenciar Contas a Pagar
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';
import type { ContaPagar, CrudService, ListParams, ProximoCodigoResponse, ApiResponse } from '../../types';

export const contasPagarService: CrudService<ContaPagar> = {
  // Listar todas as contas a pagar
  list: async (params: ListParams = {}): Promise<ApiResponse<ContaPagar> | ContaPagar[]> => {
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<ContaPagar>>('/cadastros/contas-pagar/', { params: drfParams });
    return response.data;
  },

  // Buscar conta por código
  get: async (codigo: number | string): Promise<ContaPagar> => {
    const response = await api.get<ContaPagar>(`/cadastros/contas-pagar/${codigo}/`);
    return response.data;
  },

  // Criar nova conta
  create: async (dados: Partial<ContaPagar>): Promise<ContaPagar> => {
    const response = await api.post<ContaPagar>('/cadastros/contas-pagar/', dados);
    return response.data;
  },

  // Atualizar conta
  update: async (codigo: number | string, dados: Partial<ContaPagar>): Promise<ContaPagar> => {
    const response = await api.put<ContaPagar>(`/cadastros/contas-pagar/${codigo}/`, dados);
    return response.data;
  },

  // Excluir conta
  delete: async (codigo: number | string): Promise<void> => {
    await api.delete(`/cadastros/contas-pagar/${codigo}/`);
  },

  // Buscar próximo código disponível
  proximoCodigo: async (): Promise<ProximoCodigoResponse> => {
    const response = await api.get<ProximoCodigoResponse>('/cadastros/contas-pagar/proximo_codigo/');
    return response.data;
  },
};

