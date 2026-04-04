/**
 * Service para comunicação com a API Hono (Cloudflare Workers)
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// URL base da API — injetada pelo Vite em build time (VITE_API_URL)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request — injeta token e tenant slug em todas as chamadas
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Token de sessão (Bearer)
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Slug do tenant — identifica qual empresa está acessando
    const tenantSlug = localStorage.getItem('tenant_slug');
    if (tenantSlug) {
      config.headers['X-Tenant-Slug'] = tenantSlug;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Interceptor de response — redireciona para login (401) ou assinatura suspensa (404/403)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('tenant_slug');
      localStorage.removeItem('tenant_status');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Tenant inativo/suspenso — middleware retorna 404 com "inativo" na mensagem
    const data = error.response?.data as { error?: string } | undefined;
    const msg = data?.error ?? '';
    if (
      (error.response?.status === 404 || error.response?.status === 403) &&
      (msg.includes('inativo') || msg.includes('suspenso') || msg.includes('suspensa'))
    ) {
      localStorage.setItem('tenant_status', 'suspended');
      if (!window.location.pathname.startsWith('/subscription-expired')) {
        window.location.href = '/subscription-expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

