/**
 * Service de autenticação — API Hono (Cloudflare Workers)
 */
import axios from 'axios';
import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface TenantInfo {
  id: string;
  slug: string;
  nome?: string;
  status: string;
}

export type ModuleMatrix = Record<string, { view: boolean; edit: boolean }>;

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome?: string;
    role: string;
    modules?: ModuleMatrix;
    customRoleId?: string | null;
  };
  tenant: TenantInfo;
}

export interface SignupResponse {
  message: string;
  tenantSlug: string;
  token: string;
  user: LoginResponse['user'];
  tenant: TenantInfo;
}

export type SessionStatusResponse =
  | { status: 'pending' }
  | { status: 'ready'; requiresLogin: true }
  | { status: 'ready'; requiresLogin?: false; token: string; user: { id: string; email: string; nome: string; role: string }; tenant: TenantInfo }

export const authService = {
  /**
   * Login — e-mail + senha. O tenant é descoberto automaticamente quando há uma única conta.
   * Passe `tenantSlug` se o mesmo e-mail existir em mais de uma empresa (resposta 409 da API).
   */
  login: async (email: string, password: string, tenantSlug?: string): Promise<LoginResponse> => {
    const body: { email: string; password: string; tenantSlug?: string } = { email, password };
    if (tenantSlug?.trim()) body.tenantSlug = tenantSlug.trim().toLowerCase();

    const response = await axios.post<LoginResponse>(`${API_BASE_URL}/api/auth/login`, body);

    const { token, user, tenant } = response.data;

    localStorage.setItem('access_token', token);
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('tenant_status', tenant.status ?? 'active');
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
      localStorage.removeItem('tenant_status');
      localStorage.removeItem('user');
      localStorage.removeItem('user_nome');
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

  /**
   * Verifica se o tenant já foi criado após pagamento no Stripe.
   * Retorna status: 'pending' | 'ready'. Quando ready sem requiresLogin,
   * inclui token de sessão para auto-login imediato.
   */
  sessionStatus: async (tenantSlug: string): Promise<SessionStatusResponse> => {
    const response = await axios.get<SessionStatusResponse>(
      `${API_BASE_URL}/api/auth/session-status`,
      { params: { tenant: tenantSlug } }
    );
    return response.data;
  },

  /**
   * Retorna o status do tenant salvo no localStorage
   */
  getTenantStatus: (): string | null => {
    return localStorage.getItem('tenant_status');
  },

  /**
   * Salva sessão no localStorage (usado após auto-login).
   */
  saveSession: (data: {
    token: string;
    user: LoginResponse['user'];
    tenant: TenantInfo;
  }) => {
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('tenant_slug', data.tenant.slug);
    localStorage.setItem('tenant_status', data.tenant.status ?? 'active');
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('user_nome', data.user.nome || data.user.email || '');
  },
};

