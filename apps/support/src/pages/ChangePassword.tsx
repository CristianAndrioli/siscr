import { FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { deskSession, type DeskAgent } from '../session'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const token = deskSession.getToken()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) return <Navigate to="/login" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{ agent: DeskAgent }>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      deskSession.updateAgent(data.agent)
      navigate('/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Não foi possível alterar a senha.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold">Trocar senha</h1>
        <p className="mt-1 text-sm text-slate-500">A senha temporária precisa ser substituída no primeiro acesso.</p>
        <label className="mt-6 block text-xs font-semibold text-slate-600">Senha atual</label>
        <input
          className="input mt-1"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <label className="mt-3 block text-xs font-semibold text-slate-600">Nova senha (mín. 8)</label>
        <input
          className="input mt-1"
          type="password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={loading}>
          {loading ? 'Salvando…' : 'Salvar senha'}
        </button>
      </form>
    </div>
  )
}
