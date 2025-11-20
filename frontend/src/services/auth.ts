/**
 * Service para autenticação
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface TokenResponse {
  access: string;
  refresh: string;
}

export const authService = {
  /**
   * Realiza login multi-tenant e retorna tokens
   */
  login: async (username: string, password: string, domain?: string): Promise<TokenResponse & { user?: any; tenant?: any; requires_selection?: boolean }> => {
    // Se API_BASE_URL estiver vazio, usar URL relativa para o proxy do Vite
    const url = API_BASE_URL ? `${API_BASE_URL}/api/auth/login/` : '/api/auth/login/';
    
    // Configurar headers para passar o domínio do tenant se fornecido
    const headers: Record<string, string> = {};
    if (domain) {
      headers['X-Tenant-Domain'] = domain;
    }
    
    const response = await axios.post(url, {
      username,
      password,
      domain, // Também enviar no body como fallback
    }, { headers });
    
    const { access, refresh, user, tenant, requires_selection } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    // Salvar informações do usuário e tenant
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    if (tenant) {
      localStorage.setItem('tenant', JSON.stringify(tenant));
    }
    
    return { access, refresh, user, tenant, requires_selection };
  },

  /**
   * Realiza logout (remove tokens)
   */
  logout: (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  /**
   * Obtém token de acesso atual
   */
  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  },

  /**
   * Verifica se usuário está autenticado
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Atualiza token de acesso usando refresh token
   */
  refreshToken: async (): Promise<string> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('Refresh token não encontrado');
    }

    const response = await axios.post<{ access: string }>(
      `${API_BASE_URL}/api/auth/token/refresh/`,
      {
        refresh: refreshToken,
      }
    );

    const { access } = response.data;
    localStorage.setItem('access_token', access);
    return access;
  },

  /**
   * Verifica se token é válido
   */
  verifyToken: async (): Promise<boolean> => {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    try {
      await axios.post(`${API_BASE_URL}/api/auth/token/verify/`, {
        token,
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Solicita reset de senha
   */
  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const response = await axios.post<{ message: string }>(
      `${API_BASE_URL}/api/auth/password-reset/`,
      { email }
    );
    return response.data;
  },

  /**
   * Confirma reset de senha
   */
  confirmPasswordReset: async (
    uid: string,
    token: string,
    newPassword: string
  ): Promise<{ message: string }> => {
    const response = await axios.post<{ message: string }>(
      `${API_BASE_URL}/api/auth/password-reset-confirm/`,
      {
        uid,
        token,
        new_password: newPassword,
      }
    );
    return response.data;
  },
};

