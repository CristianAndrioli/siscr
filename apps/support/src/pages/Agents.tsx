import { FormEvent, useEffect, useState } from 'react'
import { api, type SupportAgentRow } from '../api'

export default function AgentsPage() {
  const [agents, setAgents] = useState<SupportAgentRow[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'master' | 'agent'>('agent')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await api.get<{ agents: SupportAgentRow[] }>('/agents')
    setAgents(data.agents)
  }

  useEffect(() => {
    void load().catch(() => setError('Sem permissão para listar usuários.'))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/agents', { nome, email, password, role })
      setNome('')
      setEmail('')
      setPassword('')
      await load()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Falha ao criar usuário.',
      )
    }
  }

  async function toggleAtivo(agent: SupportAgentRow) {
    await api.patch(`/agents/${agent.id}`, { ativo: agent.ativo !== 1 })
    await load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Usuários do suporte</h1>
      <form onSubmit={(e) => void create(e)} className="mt-4 grid max-w-xl gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="font-semibold text-sm">Novo usuário</div>
        <input className="input" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="input"
          type="password"
          minLength={8}
          placeholder="Senha temporária"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'master' | 'agent')}>
          <option value="agent">Agente</option>
          <option value="master">Master</option>
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-fit" type="submit">
          Criar
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
            <div>
              <div className="font-medium">{a.nome}</div>
              <div className="text-xs text-slate-500">
                {a.email} · {a.role} {a.ativo ? '' : '· inativo'}
              </div>
            </div>
            <button className="btn-secondary" type="button" onClick={() => void toggleAtivo(a)}>
              {a.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
