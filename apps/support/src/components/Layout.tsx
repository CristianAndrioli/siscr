import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { deskSession } from '../session'

export default function DeskLayout() {
  const navigate = useNavigate()
  const agent = deskSession.getAgent()

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    deskSession.clear()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-control px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 w-56 bg-slate-950 p-4 text-white">
        <div className="font-display text-lg font-bold">
          SISC<span className="text-brand-500">R</span> Suporte
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">{agent?.nome}</p>
        <nav className="mt-6 flex flex-col gap-1">
          <NavLink to="/" end className={linkClass}>
            Inbox
          </NavLink>
          <NavLink to="/desenvolvimento" className={linkClass}>
            Desenvolvimento
          </NavLink>
          <NavLink to="/clientes" className={linkClass}>
            Clientes
          </NavLink>
          {agent?.role === 'master' && (
            <NavLink to="/usuarios" className={linkClass}>
              Equipe
            </NavLink>
          )}
        </nav>
        <button type="button" onClick={() => void logout()} className="mt-8 text-xs text-slate-400 hover:text-white">
          Sair
        </button>
      </aside>
      <main className="ml-56 min-h-screen p-6">
        <Outlet />
      </main>
    </div>
  )
}
