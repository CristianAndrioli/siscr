/**
 * Service para gerenciar configurações de email
 */
import api from './api';

export interface EmailSettings {
  id: number;
  backend: 'console' | 'smtp' | 'file';
  host: string | null;
  port: number;
  use_tls: boolean;
  use_ssl: boolean;
  username: string | null;
  password?: string; // Apenas no create/update
  from_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailSettingsCreate {
  backend: 'console' | 'smtp' | 'file';
  host?: string;
  port?: number;
  use_tls?: boolean;
  use_ssl?: boolean;
  username?: string;
  password?: string;
  from_email?: string;
  is_active?: boolean;
}

export interface EmailSettingsUpdate extends Partial<EmailSettingsCreate> {}

export interface TestEmailRequest {
  to_email: string;
}

export interface TestEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  settings_used?: {
    backend: string;
    host: string | null;
    port: number;
    from_email: string;
  };
}

class EmailService {
  private baseUrl = 'email-settings';

  async list(): Promise<EmailSettings[]> {
    const response = await api.get<EmailSettings[]>(`/${this.baseUrl}/`);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  }

  async get(id: number): Promise<EmailSettings> {
    const response = await api.get<EmailSettings>(`/${this.baseUrl}/${id}/`);
    return response.data;
  }

  async getActive(): Promise<EmailSettings | null> {
    const settings = await this.list();
    return settings.find(s => s.is_active) || settings[0] || null;
  }

  async create(data: EmailSettingsCreate): Promise<EmailSettings> {
    const response = await api.post<EmailSettings>(`/${this.baseUrl}/`, data);
    return response.data;
  }

  async update(id: number, data: EmailSettingsUpdate): Promise<EmailSettings> {
    const response = await api.patch<EmailSettings>(`/${this.baseUrl}/${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/${this.baseUrl}/${id}/`);
  }

  async testEmail(data: TestEmailRequest): Promise<TestEmailResponse> {
    const response = await api.post<TestEmailResponse>(`/${this.baseUrl}/test/`, data);
    return response.data;
  }
}

export const emailService = new EmailService();

