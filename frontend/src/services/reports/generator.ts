/**
 * Service para gerar relatórios
 */
import api from '../api';

export interface GerarRelatorioRequest {
  tipo: string;
  modulo?: string;
  formato?: 'pdf' | 'html' | 'xlsx';
  template_id?: number | null;
  filtros?: Record<string, any>;
  enviar_email?: boolean;
  email_destinatario?: string | null;
}

export interface PreviewRequest {
  tipo: string;
  modulo?: string;
  template_id?: number | null;
}

class GeneratorService {
  private baseUrl = '/reports/gerar/';

  async gerar(data: GerarRelatorioRequest): Promise<Blob | { html: string }> {
    if (data.formato === 'pdf') {
      const response = await api.post(`${this.baseUrl}gerar/`, data, {
        responseType: 'blob',
      });
      return response.data;
    } else if (data.formato === 'html') {
      const response = await api.post<{ html: string }>(`${this.baseUrl}gerar/`, data);
      return response.data;
    } else {
      throw new Error(`Formato ${data.formato} não suportado`);
    }
  }

  async preview(params: PreviewRequest): Promise<{ html: string }> {
    const response = await api.get<{ html: string }>(`${this.baseUrl}preview/`, { params });
    return response.data;
  }
}

export const generatorService = new GeneratorService();

