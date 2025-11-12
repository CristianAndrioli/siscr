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
   * Realiza login e retorna tokens
   */
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const response = await axios.post<TokenResponse>(`${API_BASE_URL}/api/auth/token/`, {
      username,
      password,
    });
    
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    return { access, refresh };
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
};

