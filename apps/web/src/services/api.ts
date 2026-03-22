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

// Interceptor de response — redireciona para login em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('tenant_slug');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

