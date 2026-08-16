import api from './api'
import { sessionStore } from './sessionStore'

export type SupportAuthorType = 'ai' | 'client' | 'agent' | 'system'

export type SupportMessage = {
  id: string
  ticket_id: string | null
  session_id: string | null
  author_type: SupportAuthorType
  author_id: string | null
  author_nome: string | null
  body: string
  created_at: string
}

export type SupportSession = {
  id: string
  tenant_id: string
  user_id: string
  ticket_id: string | null
  created_at: string
}

export type SupportTicket = {
  id: string
  subject: string
  status: string
  kind: string
  created_at: string
}

export const supportService = {
  openSession: async () => {
    const { data } = await api.post<{ session: SupportSession; messages: SupportMessage[] }>('/support/session')
    return data
  },

  chat: async (sessionId: string, message: string) => {
    const { data } = await api.post<{
      reply: string | null
      ticketId: string | null
      messages: SupportMessage[]
      handedOff: boolean
    }>('/support/chat', { sessionId, message })
    return data
  },

  escalate: async (sessionId: string, subject?: string) => {
    const { data } = await api.post<{ ticketId: string }>('/support/escalate', { sessionId, subject })
    return data
  },

  getTicket: async (ticketId: string) => {
    const { data } = await api.get<{ ticket: SupportTicket; messages: SupportMessage[] }>(
      `/support/tickets/${ticketId}`,
    )
    return data
  },

  sendTicketMessage: async (ticketId: string, body: string) => {
    const { data } = await api.post<{ message: SupportMessage }>(`/support/tickets/${ticketId}/messages`, { body })
    return data
  },

  ticketSocketUrl: (ticketId: string) => {
    const token = sessionStore.getToken()
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8787'
    const wsBase = String(base).replace(/^http/, 'ws')
    return `${wsBase}/api/support/tickets/${ticketId}/ws?token=${encodeURIComponent(token ?? '')}`
  },
}
