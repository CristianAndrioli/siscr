import axios, { AxiosError, AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { sessionStore } from '../sessionStore'

export type CreateSiscrHttpClientOptions = {
  baseURL: string
}

/**
 * Cliente HTTP compartilhado: base URL, headers JSON e interceptors de
 * auth/tenant/erros globais.
 *
 * Persistência de sessão
 * -----------------------------------------------------------------
 * Os headers `Authorization` e `X-Tenant-Slug` são lidos via
 * `sessionStore`. Em 401, a sessão é limpa e redireciona para /login.
 * NÃO acessar `localStorage` direto — quando migrarmos para cookies
 * HttpOnly, basta atualizar o `sessionStore`.
 */
export function createSiscrHttpClient(options: CreateSiscrHttpClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // FormData exige boundary no Content-Type; o default application/json quebra o parse no servidor.
      if (config.data instanceof FormData) {
        const h = config.headers
        if (h instanceof AxiosHeaders) {
          h.delete('Content-Type')
        } else if (h && typeof h === 'object') {
          delete (h as Record<string, unknown>)['Content-Type']
          delete (h as Record<string, unknown>)['content-type']
        }
      }

      const token = sessionStore.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      const tenantSlug = sessionStore.getTenantSlug()
      if (tenantSlug) {
        config.headers['X-Tenant-Slug'] = tenantSlug
      }
      return config
    },
    (error: AxiosError) => Promise.reject(error),
  )

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        sessionStore.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      const data = error.response?.data as { error?: string; code?: string } | undefined
      const msg = data?.error ?? ''
      const code = data?.code
      if (
        (error.response?.status === 404 || error.response?.status === 403 || error.response?.status === 402) &&
        (msg.includes('inativo') || msg.includes('suspenso') || msg.includes('suspensa') || code === 'TENANT_INACTIVE')
      ) {
        sessionStore.setTenantStatus('suspended')
        if (!window.location.pathname.startsWith('/subscription-expired')) {
          window.location.href = '/subscription-expired'
        }
      }

      if (
        error.response?.status === 403 &&
        (code === 'FORBIDDEN_MODULE' || code === 'FORBIDDEN_EDIT')
      ) {
        window.dispatchEvent(
          new CustomEvent('siscr:forbidden', {
            detail: { message: msg || 'Sem permissão para esta ação.' },
          }),
        )
      }

      if (
        error.response?.status === 403 &&
        code &&
        (code === 'PLAN_LIMIT_EMPRESAS' || code === 'PLAN_LIMIT_FILIAIS' || code === 'PLAN_LIMIT_USUARIOS')
      ) {
        window.dispatchEvent(
          new CustomEvent('siscr:plan-limit', {
            detail: error.response?.data,
          }),
        )
      }

      return Promise.reject(error)
    },
  )

  return instance
}
