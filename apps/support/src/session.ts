const TOKEN_KEY = 'siscr_desk_token'
const AGENT_KEY = 'siscr_desk_agent'

export type DeskAgent = {
  agentId: string
  email: string
  nome: string
  role: 'master' | 'agent'
  mustChangePassword: boolean
}

export const deskSession = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getAgent: (): DeskAgent | null => {
    const raw = localStorage.getItem(AGENT_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as DeskAgent
    } catch {
      return null
    }
  },
  save: (token: string, agent: DeskAgent) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(AGENT_KEY, JSON.stringify(agent))
  },
  updateAgent: (agent: DeskAgent) => {
    localStorage.setItem(AGENT_KEY, JSON.stringify(agent))
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(AGENT_KEY)
  },
}
