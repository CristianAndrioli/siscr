import axios, { AxiosError, AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export type CreateSiscrHttpClientOptions = {
  baseURL: string
}

/**
 * Cliente HTTP compartilhado: base URL, headers JSON e interceptors de auth/tenant/erros globais.
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

      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      const tenantSlug = localStorage.getItem('tenant_slug')
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
        localStorage.removeItem('access_token')
        localStorage.removeItem('tenant_slug')
        localStorage.removeItem('tenant_status')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      const data = error.response?.data as { error?: string } | undefined
      const msg = data?.error ?? ''
      if (
        (error.response?.status === 404 || error.response?.status === 403) &&
        (msg.includes('inativo') || msg.includes('suspenso') || msg.includes('suspensa'))
      ) {
        localStorage.setItem('tenant_status', 'suspended')
        if (!window.location.pathname.startsWith('/subscription-expired')) {
          window.location.href = '/subscription-expired'
        }
      }

      const code = (error.response?.data as { code?: string } | undefined)?.code
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

      return Promise.reject(error)
    },
  )

  return instance
}
