/**
 * Service para gerenciar Estoque
 */
import api from '../api';
import type { ListParams, ApiResponse } from '../../types';

export interface Estoque {
  id: number;
  produto: number;
  produto_nome: string;
  produto_codigo: string;
  location: number;
  location_nome: string;
  location_codigo: string;
  empresa: number;
  empresa_nome: string;
  quantidade_atual: string;
  quantidade_reservada: string;
  quantidade_disponivel: string;
  quantidade_prevista: string;
  quantidade_disponivel_com_prevista: string;
  custo_medio: string;
  valor_total: string;
  estoque_minimo: string | null;
  estoque_maximo: string | null;
  abaixo_estoque_minimo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EstoqueConsolidado {
  produto: number;
  produto_nome: string;
  produto_codigo: string;
  quantidade_total: string;
  quantidade_disponivel_total: string;
  quantidade_reservada_total: string;
  valor_total: string;
  custo_medio_ponderado: string;
  locations: Array<{
    location: number;
    location_nome: string;
    quantidade: string;
    quantidade_disponivel: string;
  }>;
}

export interface ProcessarEntradaData {
  produto: number;
  location: number;
  quantidade: string;
  custo_unitario: string;
  observacao?: string;
}

export interface ProcessarSaidaData {
  produto: number;
  location: number;
  quantidade: string;
  observacao?: string;
}

export interface ProcessarTransferenciaData {
  produto: number;
  location_origem: number;
  location_destino: number;
  quantidade: string;
  observacao?: string;
}

class EstoqueService {
  private baseUrl = '/estoque/estoques/';

  async list(params?: ListParams): Promise<ApiResponse<Estoque>> {
    const response = await api.get<ApiResponse<Estoque>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<Estoque> {
    const response = await api.get<Estoque>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async consolidado(params?: ListParams): Promise<ApiResponse<EstoqueConsolidado>> {
    const response = await api.get<ApiResponse<EstoqueConsolidado>>(`${this.baseUrl}consolidado/`, { params });
    return response.data;
  }

  async processarEntrada(data: ProcessarEntradaData): Promise<Estoque> {
    const response = await api.post<Estoque>(`${this.baseUrl}entrada/`, data);
    return response.data;
  }

  async processarSaida(data: ProcessarSaidaData): Promise<Estoque> {
    const response = await api.post<Estoque>(`${this.baseUrl}saida/`, data);
    return response.data;
  }

  async processarTransferencia(data: ProcessarTransferenciaData): Promise<{ origem: Estoque; destino: Estoque }> {
    const response = await api.post<{ origem: Estoque; destino: Estoque }>(`${this.baseUrl}transferencia/`, data);
    return response.data;
  }

  async update(id: number, data: Partial<Estoque>): Promise<Estoque> {
    const response = await api.patch<Estoque>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }
}

export const estoqueService = new EstoqueService();

