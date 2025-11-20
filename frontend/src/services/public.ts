/**
 * Service para APIs públicas (não requerem autenticação)
 */
import axios from 'axios';

// Usar URL relativa para aproveitar o proxy do Vite, ou URL absoluta se VITE_API_URL estiver definido
// Quando VITE_API_URL não está definido, usar URL relativa que começa com / para o proxy funcionar
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
    // Se API_BASE_URL estiver vazio, usar URL relativa para o proxy do Vite
    const url = API_BASE_URL ? `${API_BASE_URL}/api/public/plans/` : '/api/public/plans/';
    const response = await axios.get<Plan[]>(url);
    return response.data;
  },

  /**
   * Verifica se domínio está disponível
   */
  checkDomain: async (domain: string): Promise<CheckDomainResponse> => {
    // Se API_BASE_URL estiver vazio, usar URL relativa para o proxy do Vite
    const url = API_BASE_URL ? `${API_BASE_URL}/api/public/check-domain/` : '/api/public/check-domain/';
    const response = await axios.post<CheckDomainResponse>(
      url,
      { domain }
    );
    return response.data;
  },

  /**
   * Cadastro público de novo cliente
   */
  signup: async (data: SignupData): Promise<SignupResponse> => {
    // Se API_BASE_URL estiver vazio, usar URL relativa para o proxy do Vite
    const url = API_BASE_URL ? `${API_BASE_URL}/api/public/signup/` : '/api/public/signup/';
    const response = await axios.post<SignupResponse>(
      url,
      data
    );
    return response.data;
  },
};


