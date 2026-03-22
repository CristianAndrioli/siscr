/**
 * Service para gerenciar Relatórios de Estoque
 */
import api from '../api';

export interface RelatorioEstoqueParams {
  location?: number;
  produto?: number;
  empresa?: number;
  filial?: number;
  data_inicio?: string;
  data_fim?: string;
  tipo_movimentacao?: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE';
  abaixo_estoque_minimo?: boolean;
}

export interface RelatorioEstoquePorLocation {
  location: {
    id: number;
    nome: string;
    codigo: string;
    tipo: string;
  };
  produtos: Array<{
    produto_id: number;
    produto_nome: string;
    produto_codigo: string;
    quantidade_atual: string;
    quantidade_disponivel: string;
    quantidade_reservada: string;
    custo_medio: string;
    valor_total: string;
    abaixo_estoque_minimo: boolean;
  }>;
  total_produtos: number;
  valor_total_geral: string;
}

export interface RelatorioMovimentacoes {
  movimentacoes: Array<{
    id: number;
    data: string;
    produto: string;
    location: string;
    tipo: string;
    quantidade: string;
    custo_unitario: string | null;
    custo_total: string | null;
  }>;
  total_entradas: string;
  total_saidas: string;
  saldo: string;
}

export interface RelatorioReservas {
  reservas: Array<{
    id: number;
    produto: string;
    location: string;
    tipo: string;
    quantidade: string;
    status: string;
    data_expiracao: string | null;
  }>;
  total_reservas: number;
  total_quantidade_reservada: string;
}

export interface IndicadoresEstoque {
  rotatividade: string;
  giro_estoque: string;
  dias_estoque: number;
  produtos_parados: number;
  produtos_estoque_minimo: number;
  valor_total_estoque: string;
  custo_medio_geral: string;
}

class RelatoriosService {
  private baseUrl = '/estoque/relatorios/';

  async estoquePorLocation(params?: RelatorioEstoqueParams): Promise<RelatorioEstoquePorLocation[]> {
    const response = await api.get<RelatorioEstoquePorLocation[]>(`${this.baseUrl}estoque-por-location/`, { params });
    return response.data;
  }

  async estoqueConsolidado(params?: RelatorioEstoqueParams): Promise<RelatorioEstoquePorLocation> {
    const response = await api.get<RelatorioEstoquePorLocation>(`${this.baseUrl}estoque-consolidado/`, { params });
    return response.data;
  }

  async movimentacoes(params?: RelatorioEstoqueParams): Promise<RelatorioMovimentacoes> {
    const response = await api.get<RelatorioMovimentacoes>(`${this.baseUrl}movimentacoes/`, { params });
    return response.data;
  }

  async reservas(params?: RelatorioEstoqueParams): Promise<RelatorioReservas> {
    const response = await api.get<RelatorioReservas>(`${this.baseUrl}reservas/`, { params });
    return response.data;
  }

  async indicadores(params?: RelatorioEstoqueParams): Promise<IndicadoresEstoque> {
    const response = await api.get<IndicadoresEstoque>(`${this.baseUrl}indicadores/`, { params });
    return response.data;
  }

  async exportar(params?: RelatorioEstoqueParams & { formato: 'xlsx' | 'pdf' | 'csv' }): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}exportar/`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

export const relatoriosService = new RelatoriosService();

