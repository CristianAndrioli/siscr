/**
 * Service para gerenciar Transferências de Estoque
 */
import api from '../api';
import type { ListParams, ApiResponse } from '../../types';

export interface Transferencia {
  id: number;
  produto_id: number;
  produto_nome: string;
  produto_codigo: string;
  location_origem_id: number;
  location_origem_nome: string;
  location_origem_codigo: string;
  location_destino_id: number;
  location_destino_nome: string;
  location_destino_codigo: string;
  quantidade: string;
  valor_unitario: string;
  valor_total: string;
  documento_referencia: string | null;
  observacoes: string | null;
  data_movimentacao: string | null;
  created_at: string | null;
  movimentacao_saida_id: number;
  movimentacao_entrada_id: number | null;
  status: string;
  motivo_cancelamento?: string | null;
}

class TransferenciasService {
  private baseUrl = '/estoque/movimentacoes/';

  async list(params?: ListParams): Promise<ApiResponse<Transferencia>> {
    const response = await api.get<ApiResponse<Transferencia>>(`${this.baseUrl}transferencias/`, { params });
    return response.data;
  }

  async get(id: number): Promise<Transferencia> {
    // id é o movimentacao_saida_id (que é o id retornado na lista)
    // Buscar na lista e filtrar pelo ID
    const response = await api.get<ApiResponse<Transferencia>>(`${this.baseUrl}transferencias/`, {
      params: { page_size: 1000 }
    });
    const transferencias = 'results' in response.data ? response.data.results : response.data;
    const transferencia = Array.isArray(transferencias) 
      ? transferencias.find(t => t.id === id || t.movimentacao_saida_id === id)
      : null;
    
    if (!transferencia) {
      throw new Error('Transferência não encontrada');
    }
    
    return transferencia;
  }

  async cancelar(id: number, motivo: string): Promise<any> {
    // id é o movimentacao_saida_id
    const response = await api.post(
      `${this.baseUrl}${id}/cancelar-transferencia/`,
      { motivo }
    );
    return response.data;
  }
}

export const transferenciasService = new TransferenciasService();

