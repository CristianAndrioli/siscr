/**
 * Service para gerenciar Pessoas (Cadastro Geral)
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';
import type { Pessoa, CrudService, ListParams, ProximoCodigoResponse, ApiResponse } from '../../types';

export const pessoasService: CrudService<Pessoa> = {
  // Listar todas as pessoas (compatível com useCrud)
  list: async (params: ListParams = {}): Promise<ApiResponse<Pessoa> | Pessoa[]> => {
    // Converter pageSize para page_size (padrão do DRF)
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<Pessoa>>('/cadastros/pessoas/', { params: drfParams });
    return response.data;
  },

  // Buscar pessoa por código (compatível com useCrud)
  get: async (codigo: number | string): Promise<Pessoa> => {
    const response = await api.get<Pessoa>(`/cadastros/pessoas/${codigo}/`);
    return response.data;
  },

  // Criar nova pessoa (compatível com useCrud)
  create: async (dados: Partial<Pessoa>): Promise<Pessoa> => {
    const response = await api.post<Pessoa>('/cadastros/pessoas/', dados);
    return response.data;
  },

  // Atualizar pessoa (compatível com useCrud)
  update: async (codigo: number | string, dados: Partial<Pessoa>): Promise<Pessoa> => {
    const response = await api.put<Pessoa>(`/cadastros/pessoas/${codigo}/`, dados);
    return response.data;
  },

  // Excluir pessoa (compatível com useCrud)
  delete: async (codigo: number | string): Promise<void> => {
    await api.delete(`/cadastros/pessoas/${codigo}/`);
  },

  // Buscar próximo código disponível
  proximoCodigo: async (): Promise<ProximoCodigoResponse> => {
    const response = await api.get<ProximoCodigoResponse>('/cadastros/pessoas/proximo_codigo/');
    return response.data;
  },
};

