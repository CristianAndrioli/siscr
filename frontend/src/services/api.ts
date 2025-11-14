/**
 * Service para comunicação com a API Django
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

/**
 * Obtém a URL base da API considerando o tenant
 * Em desenvolvimento, usa o domínio do tenant salvo no localStorage
 * ou um domínio padrão de desenvolvimento
 */
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Tentar obter o domínio do tenant do localStorage
  try {
    const tenantStr = localStorage.getItem('tenant');
    if (tenantStr) {
      const tenant = JSON.parse(tenantStr);
      // Se o tenant tiver um domínio, usar ele
      if (tenant.domain) {
        return `http://${tenant.domain}:8000`;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler tenant do localStorage:', e);
  }

  // Em desenvolvimento, usar um domínio padrão de tenant
  // Você pode criar um tenant com domínio 'teste-tenant.localhost' ou 'localhost'
  // Para desenvolvimento local sem subdomínio, você precisará criar um tenant
  // com domínio 'localhost' no Django admin
  const devTenantDomain = import.meta.env.VITE_DEV_TENANT_DOMAIN || 'teste-tenant.localhost';
  return `http://${devTenantDomain}:8000`;
}

// URL base da API (backend Django)
const API_BASE_URL = getApiBaseUrl();

// Criar instância do axios
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT em todas as requisições
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Se receber 401 e não tiver tentado refresh ainda
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post<{ access: string }>(
            `${API_BASE_URL}/api/auth/token/refresh/`,
            {
              refresh: refreshToken,
            }
          );

          const { access } = response.data;
          localStorage.setItem('access_token', access);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token inválido, fazer logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Exportar instância do axios para uso em outros serviços
export default api;

