import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type SupportTicket } from '../api'

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  waiting_client: 'Aguardando cliente',
  waiting_agent: 'Aguardando agente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export default function InboxPage({ kind }: { kind: 'support' | 'development' }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ kind })
    if (q.trim()) params.set('q', q.trim())
    if (status) params.set('status', status)
    api
      .get<{ tickets: SupportTicket[] }>(`/tickets?${params.toString()}`)
      .then(({ data }) => {
        if (!cancelled) setTickets(data.tickets)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, q, status])

  return (
    <div>
      <h1 className="text-2xl font-bold">{kind === 'support' ? 'Inbox de suporte' : 'Tickets de desenvolvimento'}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Buscar cliente, assunto, e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && <p className="p-4 text-sm text-slate-500">Carregando…</p>}
        {!loading && tickets.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum ticket.</p>}
        {tickets.map((t) => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
          >
            <div>
              <div className="font-medium text-slate-900">{t.subject}</div>
              <div className="text-xs text-slate-500">
                {t.tenant_nome} (@{t.tenant_slug}) · {t.created_by_nome || t.created_by_email}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>{STATUS_LABEL[t.status] ?? t.status}</div>
              <div>{t.assigned_agent_nome || 'Sem agente'}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
