import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ticketWsUrl, type SupportMessage, type SupportTicket } from '../api'

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  waiting_client: 'Aguardando cliente',
  waiting_agent: 'Aguardando agente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState('')
  const [devSubject, setDevSubject] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  async function refresh() {
    if (!id) return
    const { data } = await api.get<{ ticket: SupportTicket; messages: SupportMessage[] }>(`/tickets/${id}`)
    setTicket(data.ticket)
    setMessages(data.messages)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .get<{ ticket: SupportTicket; messages: SupportMessage[] }>(`/tickets/${id}`)
      .then(({ data }) => {
        if (cancelled) return
        setTicket(data.ticket)
        setMessages(data.messages)
      })
      .catch(() => {
        if (!cancelled) setError('Ticket não encontrado.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (!id) return
    const ws = new WebSocket(ticketWsUrl(id))
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(String(ev.data)) as {
          type: string
          messages?: SupportMessage[]
          message?: SupportMessage
        }
        if (payload.type === 'history' && payload.messages) setMessages(payload.messages)
        if (payload.type === 'message' && payload.message) {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.message!.id) ? prev : [...prev, payload.message!],
          )
        }
      } catch {
        /* ignore */
      }
    }
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [id])

  async function claim() {
    if (!id) return
    await api.post(`/tickets/${id}/claim`)
    await refresh()
  }

  async function setStatus(status: string) {
    if (!id) return
    await api.patch(`/tickets/${id}`, { status })
    await refresh()
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!id || !draft.trim()) return
    const body = draft.trim()
    setDraft('')
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', body }))
    } else {
      await api.post(`/tickets/${id}/messages`, { body })
      await refresh()
    }
  }

  async function createDev(e: FormEvent) {
    e.preventDefault()
    if (!id || !devSubject.trim()) return
    const { data } = await api.post<{ ticket: SupportTicket }>(`/tickets/${id}/development`, {
      subject: devSubject.trim(),
    })
    setDevSubject('')
    if (data.ticket) window.location.href = `/tickets/${data.ticket.id}`
  }

  if (error) return <p className="text-red-600">{error}</p>
  if (!ticket) return <p className="text-sm text-slate-500">Carregando…</p>

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section>
        <Link to={ticket.kind === 'development' ? '/desenvolvimento' : '/'} className="text-sm text-brand-700">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{ticket.subject}</h1>
        <p className="text-sm text-slate-500">
          {ticket.tenant_nome} (@{ticket.tenant_slug}) · {ticket.created_by_nome} ({ticket.created_by_email})
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={() => void claim()}>
            Assumir
          </button>
          <select
            className="input max-w-[12rem]"
            value={ticket.status}
            onChange={(e) => void setStatus(e.target.value)}
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div ref={listRef} className="mt-4 h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.author_type === 'agent'
                  ? 'ml-auto bg-brand-600 text-white'
                  : m.author_type === 'system'
                    ? 'mx-auto bg-slate-100 text-center text-xs text-slate-600'
                    : 'bg-slate-100 text-slate-800'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase opacity-80">
                {m.author_nome || m.author_type}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </div>

        <form onSubmit={(e) => void send(e)} className="mt-3 flex gap-2">
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Responder ao cliente…" />
          <button className="btn-primary" type="submit">
            Enviar
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="font-semibold">Detalhes</div>
          <p className="mt-2 text-slate-600">Status: {STATUS_LABEL[ticket.status] ?? ticket.status}</p>
          <p className="text-slate-600">Prioridade: {ticket.priority}</p>
          <p className="text-slate-600">Agente: {ticket.assigned_agent_nome || '—'}</p>
          {ticket.parent_ticket_id && (
            <Link className="mt-2 block text-brand-700" to={`/tickets/${ticket.parent_ticket_id}`}>
              Ticket de origem
            </Link>
          )}
        </div>
        {ticket.kind === 'support' && (
          <form onSubmit={(e) => void createDev(e)} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-sm">Criar ticket de desenvolvimento</div>
            <input
              className="input mt-2"
              value={devSubject}
              onChange={(e) => setDevSubject(e.target.value)}
              placeholder="Ex.: Bug na emissão de NF-e"
            />
            <button className="btn-primary mt-3 w-full" type="submit">
              Criar
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
