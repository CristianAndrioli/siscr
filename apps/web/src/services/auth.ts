/**
 * Service de autenticação — API REST (Hono).
 *
 * Persistência
 * -----------------------------------------------------------------
 * Este service NÃO toca em `localStorage` diretamente — toda leitura/
 * escrita passa por `sessionStore` (ver `./sessionStore.ts`). Isso
 * mantém a decisão de "onde a sessão mora" num único módulo e abre
 * caminho para migrar para cookies HttpOnly sem tocar aqui.
 */
import axios from 'axios';
import api from './api';
import { sessionStore } from './sessionStore';

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

    sessionStore.save(response.data);
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
   * Logout — invalida sessão no servidor e limpa sessão local.
   * Sempre limpa o localStorage, mesmo se o POST falhar (ex.: offline).
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStore.clear();
    }
  },

  /**
   * Retorna o usuário logado atual (GET /auth/me).
   */
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /** Verifica se há sessão ativa (presença do token no store). */
  isAuthenticated: (): boolean => sessionStore.isAuthenticated(),

  /** Retorna o token de sessão atual. */
  getToken: (): string | null => sessionStore.getToken(),

  /** Retorna o slug do tenant atual. */
  getTenantSlug: (): string | null => sessionStore.getTenantSlug(),

  /** Retorna o usuário cache local (para UI; não é source of truth). */
  getLocalUser: () => sessionStore.getLocalUser(),

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

  /** Status cache do tenant (active/suspended). */
  getTenantStatus: (): string | null => sessionStore.getTenantStatus(),

  /** Salva sessão após auto-login pós-checkout. */
  saveSession: (data: {
    token: string;
    user: LoginResponse['user'];
    tenant: TenantInfo;
  }) => sessionStore.save(data),
};
