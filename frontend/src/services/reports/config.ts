/**
 * Service para gerenciar Configurações de Relatórios
 */
import api from '../api';

export interface ReportConfig {
  id: number;
  tenant: number;
  empresa?: number | null;
  logo_url: string;
  logo_upload?: string | null;
  nome_empresa: string;
  endereco: string;
  telefone: string;
  email: string;
  cnpj: string;
  formato_padrao: 'pdf' | 'html' | 'xlsx';
  email_destinatario_padrao: string;
  assunto_padrao: string;
  created_at: string;
  updated_at: string;
}

export interface ReportConfigUpdate {
  logo_url?: string;
  logo_upload?: File | null;
  nome_empresa?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  cnpj?: string;
  formato_padrao?: 'pdf' | 'html' | 'xlsx';
  email_destinatario_padrao?: string;
  assunto_padrao?: string;
}

class ConfigService {
  private baseUrl = '/reports/config/';

  async get(): Promise<ReportConfig> {
    const response = await api.get<ReportConfig>(this.baseUrl);
    // Se retornar lista, pegar o primeiro
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async create(data: Partial<ReportConfigUpdate>): Promise<ReportConfig> {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'logo_upload' && value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await api.post<ReportConfig>(this.baseUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async update(id: number, data: Partial<ReportConfigUpdate>): Promise<ReportConfig> {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'logo_upload' && value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await api.patch<ReportConfig>(`${this.baseUrl}${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

export const configService = new ConfigService();

