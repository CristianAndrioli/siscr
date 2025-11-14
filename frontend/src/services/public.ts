/**
 * Service para APIs públicas (não requerem autenticação)
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_monthly: string;
  price_yearly: string | null;
  max_users: number;
  max_empresas: number;
  max_filiais: number;
  max_storage_gb: number;
  is_trial: boolean;
  trial_days: number;
  features: Array<{
    name: string;
    description: string;
    icon: string;
  }>;
}

export interface SignupData {
  tenant_name: string;
  domain: string;
  plan_id: number;
  admin_username: string;
  admin_email: string;
  admin_password: string;
  admin_first_name?: string;
  admin_last_name?: string;
  empresa_nome: string;
  empresa_cnpj?: string;
  empresa_razao_social?: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  tenant: {
    id: number;
    name: string;
    domain: string;
  };
  user: {
    username: string;
    email: string;
  };
  subscription: {
    plan: string;
    status: string;
    expires_at: string;
  };
  login_url: string;
}

export interface CheckDomainResponse {
  available: boolean;
  message?: string;
}

export const publicService = {
  /**
   * Lista planos disponíveis
   */
  getPlans: async (): Promise<Plan[]> => {
    const response = await axios.get<Plan[]>(`${API_BASE_URL}/api/public/plans/`);
    return response.data;
  },

  /**
   * Verifica se domínio está disponível
   */
  checkDomain: async (domain: string): Promise<CheckDomainResponse> => {
    const response = await axios.post<CheckDomainResponse>(
      `${API_BASE_URL}/api/public/check-domain/`,
      { domain }
    );
    return response.data;
  },

  /**
   * Cadastro público de novo cliente
   */
  signup: async (data: SignupData): Promise<SignupResponse> => {
    const response = await axios.post<SignupResponse>(
      `${API_BASE_URL}/api/public/signup/`,
      data
    );
    return response.data;
  },
};


