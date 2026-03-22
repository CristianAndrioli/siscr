/**
 * Service para gerenciar Movimentações de Estoque
 */
import api from '../api';
import type { ListParams, ApiResponse } from '../../types';

export interface MovimentacaoEstoque {
  id: number;
  estoque: number;
  produto_nome: string;
  location_nome: string;
  location_origem_nome?: string | null;
  location_destino_nome?: string | null;
  tipo: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE' | 'RESERVA' | 'CANCELAMENTO_RESERVA';
  origem: string;
  status: string;
  quantidade: string;
  quantidade_anterior?: string;
  quantidade_posterior?: string;
  valor_unitario: string | null;
  valor_total: string | null;
  data_movimentacao?: string;
  documento_referencia?: string | null;
  observacoes?: string | null;
  movimentacao_origem: number | null;
  movimentacao_destino: number | null;
  movimentacao_relacionada: number | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
}

export interface MovimentacaoEstoqueFilters extends ListParams {
  tipo?: MovimentacaoEstoque['tipo'];
  origem?: string; // Para filtrar por origem (ex: 'TRANSFERENCIA')
  produto?: number;
  location?: number;
  data_inicio?: string;
  data_fim?: string;
}

class MovimentacoesService {
  private baseUrl = '/estoque/movimentacoes/';

  async list(params?: MovimentacaoEstoqueFilters): Promise<ApiResponse<MovimentacaoEstoque>> {
    const response = await api.get<ApiResponse<MovimentacaoEstoque>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<MovimentacaoEstoque> {
    const response = await api.get<MovimentacaoEstoque>(`${this.baseUrl}${id}/`);
    return response.data;
  }
}

export const movimentacoesService = new MovimentacoesService();

