/**
 * Service para gerenciar Configurações de Estoque
 */
import api from '../api';

export interface ConfiguracaoEstoque {
  id: number;
  empresa: number;
  empresa_nome: string;
  cancelamento_nf_entrada_devolve_estoque: boolean;
  cancelamento_nf_saida_retorna_estoque: boolean;
  tratamento_custo_devolucao: 'MANTER_ORIGINAL' | 'USAR_CUSTO_ATUAL' | 'ZERAR';
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoEstoqueCreate {
  empresa: number;
  cancelamento_nf_entrada_devolve_estoque?: boolean;
  cancelamento_nf_saida_retorna_estoque?: boolean;
  tratamento_custo_devolucao?: ConfiguracaoEstoque['tratamento_custo_devolucao'];
}

export interface ConfiguracaoEstoqueUpdate extends Partial<ConfiguracaoEstoqueCreate> {}

class ConfiguracoesService {
  private baseUrl = '/estoque/configuracoes/';

  async list(): Promise<ConfiguracaoEstoque[]> {
    const response = await api.get<ConfiguracaoEstoque[]>(this.baseUrl);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  }

  async get(id: number): Promise<ConfiguracaoEstoque> {
    const response = await api.get<ConfiguracaoEstoque>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async getByEmpresa(empresaId: number): Promise<ConfiguracaoEstoque | null> {
    const configs = await this.list();
    return configs.find(c => c.empresa === empresaId) || null;
  }

  async create(data: ConfiguracaoEstoqueCreate): Promise<ConfiguracaoEstoque> {
    const response = await api.post<ConfiguracaoEstoque>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: ConfiguracaoEstoqueUpdate): Promise<ConfiguracaoEstoque> {
    const response = await api.patch<ConfiguracaoEstoque>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }
}

export const configuracoesService = new ConfiguracoesService();

