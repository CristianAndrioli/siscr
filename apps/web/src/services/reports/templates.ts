/**
 * Service para gerenciar Templates de Relatórios
 */
import api from '../api';
import type { ListParams, ApiResponse } from '../../types';

export interface ReportTemplate {
  id: number;
  nome: string;
  codigo: string;
  descricao: string;
  modulo: string;
  tipo_relatorio: string;
  template_customizado: boolean;
  template_arquivo: string;
  template_html: string;
  template_css: string;
  incluir_logo: boolean;
  incluir_dados_empresa: boolean;
  orientacao: 'portrait' | 'landscape';
  variaveis_disponiveis: Record<string, any>;
  tenant?: number | null;
  empresa?: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplateCreate {
  nome: string;
  codigo: string;
  descricao?: string;
  modulo: string;
  tipo_relatorio: string;
  template_customizado?: boolean;
  template_arquivo?: string;
  template_html?: string;
  template_css?: string;
  incluir_logo?: boolean;
  incluir_dados_empresa?: boolean;
  orientacao?: 'portrait' | 'landscape';
  variaveis_disponiveis?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

class TemplatesService {
  private baseUrl = '/reports/templates/';

  async list(params?: ListParams): Promise<ApiResponse<ReportTemplate>> {
    const response = await api.get<ApiResponse<ReportTemplate>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<ReportTemplate> {
    const response = await api.get<ReportTemplate>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async create(data: ReportTemplateCreate): Promise<ReportTemplate> {
    const response = await api.post<ReportTemplate>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: Partial<ReportTemplateCreate>): Promise<ReportTemplate> {
    const response = await api.patch<ReportTemplate>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }
}

export const templatesService = new TemplatesService();

