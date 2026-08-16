import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { deskSession, type DeskAgent } from '../session'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{ token: string; agent: DeskAgent }>('/auth/login', { email, password })
      deskSession.save(data.token, data.agent)
      navigate(data.agent.mustChangePassword ? '/trocar-senha' : '/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível entrar.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="font-display text-2xl font-bold text-slate-900">
          SISC<span className="text-brand-600">R</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Painel interno de suporte</p>
        <label className="mt-6 block text-xs font-semibold text-slate-600">E-mail</label>
        <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="mt-3 block text-xs font-semibold text-slate-600">Senha</label>
        <input
          className="input mt-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
