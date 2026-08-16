import axios from 'axios'
import { deskSession } from './session'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/desk`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = deskSession.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      deskSession.clear()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export type SupportTicket = {
  id: string
  tenant_id: string
  tenant_slug: string
  tenant_nome: string
  created_by_user_id: string | null
  created_by_nome: string | null
  created_by_email: string | null
  assigned_agent_id: string | null
  assigned_agent_nome: string | null
  kind: 'support' | 'development'
  source: string
  status: string
  priority: string
  subject: string
  parent_ticket_id: string | null
  created_at: string
}

export type SupportMessage = {
  id: string
  ticket_id: string | null
  author_type: 'ai' | 'client' | 'agent' | 'system'
  author_id: string | null
  author_nome: string | null
  body: string
  created_at: string
}

export type SupportAgentRow = {
  id: string
  nome: string
  email: string
  role: 'master' | 'agent'
  ativo: number
  must_change_password: number
  created_at: string
}

export function ticketWsUrl(ticketId: string) {
  const token = deskSession.getToken() ?? ''
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8787'
  const wsBase = String(base).replace(/^http/, 'ws')
  return `${wsBase}/api/desk/tickets/${ticketId}/ws?token=${encodeURIComponent(token)}`
}
