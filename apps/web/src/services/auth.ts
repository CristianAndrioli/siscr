/**
 * Service de autenticação — API Hono (Cloudflare Workers)
 */
import axios from 'axios';
import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; role: string };
  tenant: { id: string; slug: string };
}

export interface SignupResponse {
  message: string;
  tenantSlug: string;
}

export const authService = {
  /**
   * Login multi-tenant — email + senha + slug do tenant
   */
  login: async (email: string, password: string, tenantSlug: string): Promise<LoginResponse> => {
    const response = await axios.post<LoginResponse>(
      `${API_BASE_URL}/api/auth/login`,
      { email, password, tenantSlug }
    );

    const { token, user, tenant } = response.data;

    localStorage.setItem('access_token', token);
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user_nome', user.nome || user.email || '');

    return response.data;
  },

  /**
   * Criar nova conta (tenant + usuário admin)
   */
  signup: async (data: {
    email: string;
    password: string;
    nome: string;
    tenantNome: string;
    tenantSlug: string;
    planId?: string;
  }): Promise<SignupResponse> => {
    const response = await axios.post<SignupResponse>(
      `${API_BASE_URL}/api/auth/signup`,
      data
    );
    return response.data;
  },

  /**
   * Logout — invalida sessão no servidor e limpa localStorage
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('tenant_slug');
      localStorage.removeItem('user');
    }
  },

  /**
   * Retorna o usuário logado atual
   */
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Verifica se há sessão ativa
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Retorna o token de sessão atual
   */
  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  },

  /**
   * Retorna o slug do tenant atual
   */
  getTenantSlug: (): string | null => {
    return localStorage.getItem('tenant_slug');
  },

  /**
   * Retorna o usuário salvo no localStorage
   */
  getLocalUser: () => {
    const str = localStorage.getItem('user');
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  },
};

