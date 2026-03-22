/**
 * Service para comunicação com a API Django
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// URL base da API (backend Django)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Criar instância do axios
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT e tenant domain em todas as requisições
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Adicionar header X-Tenant-Domain se o tenant estiver salvo
    const tenantStr = localStorage.getItem('tenant');
    if (tenantStr) {
      try {
        const tenant = JSON.parse(tenantStr);
        // Usar domínio diretamente se disponível, senão construir a partir do schema_name
        const domain = tenant.domain || (tenant.schema_name ? `${tenant.schema_name}.localhost` : null);
        if (domain) {
          config.headers['X-Tenant-Domain'] = domain;
          console.log('[API] Adicionando header X-Tenant-Domain:', domain);
        } else {
          console.warn('[API] Tenant encontrado mas sem domain ou schema_name:', tenant);
        }
      } catch (e) {
        // Se houver erro ao parsear, ignorar silenciosamente
        console.warn('[API] Erro ao parsear tenant do localStorage:', e);
      }
    } else {
      console.warn('[API] Nenhum tenant encontrado no localStorage');
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

