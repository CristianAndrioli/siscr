/**
 * Service para gerenciar Reservas de Estoque
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface ReservaEstoque {
  id: number;
  estoque: number;
  produto_nome: string;
  location_nome: string;
  tipo: 'SOFT' | 'HARD';
  quantidade: string;
  quantidade_confirmada: string;
  status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA';
  data_expiracao: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservaEstoqueCreate {
  estoque: number;
  tipo: 'SOFT' | 'HARD';
  quantidade: string;
  data_expiracao?: string | null;
  observacao?: string | null;
}

export interface ReservaEstoqueUpdate extends Partial<ReservaEstoqueCreate> {}

class ReservasService implements CrudService<ReservaEstoque, ReservaEstoqueCreate, ReservaEstoqueUpdate> {
  private baseUrl = '/estoque/reservas/';

  async list(params?: ListParams): Promise<ApiResponse<ReservaEstoque>> {
    const response = await api.get<ApiResponse<ReservaEstoque>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<ReservaEstoque> {
    const response = await api.get<ReservaEstoque>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async create(data: ReservaEstoqueCreate): Promise<ReservaEstoque> {
    const response = await api.post<ReservaEstoque>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: ReservaEstoqueUpdate): Promise<ReservaEstoque> {
    const response = await api.patch<ReservaEstoque>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }

  async confirmar(id: number): Promise<ReservaEstoque> {
    const response = await api.post<ReservaEstoque>(`${this.baseUrl}${id}/confirmar/`);
    return response.data;
  }

  async cancelar(id: number): Promise<ReservaEstoque> {
    const response = await api.post<ReservaEstoque>(`${this.baseUrl}${id}/cancelar/`);
    return response.data;
  }
}

export const reservasService = new ReservasService();

