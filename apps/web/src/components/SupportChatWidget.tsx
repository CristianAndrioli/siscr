import { FormEvent, useEffect, useRef, useState } from 'react'
import { supportService, type SupportMessage, type SupportSession } from '../services/support'

function authorLabel(type: SupportMessage['author_type'], nome: string | null) {
  if (type === 'ai') return 'Assistente'
  if (type === 'agent') return nome || 'Atendente'
  if (type === 'system') return 'Sistema'
  return 'Você'
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [session, setSession] = useState<SupportSession | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (!open || session) return
    let cancelled = false
    setLoading(true)
    supportService
      .openSession()
      .then((data) => {
        if (cancelled) return
        setSession(data.session)
        setMessages(data.messages)
        setTicketId(data.session.ticket_id)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível iniciar o suporte.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, session])

  useEffect(() => {
    if (!ticketId) return
    const url = supportService.ticketSocketUrl(ticketId)
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(String(ev.data)) as {
          type: string
          messages?: SupportMessage[]
          message?: SupportMessage
        }
        if (payload.type === 'history' && payload.messages) {
          setMessages(payload.messages)
        }
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
  }, [ticketId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !session || sending) return
    setDraft('')
    setSending(true)
    setError(null)
    try {
      if (ticketId) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'message', body: text }))
        } else {
          await supportService.sendTicketMessage(ticketId, text)
        }
      } else {
        const result = await supportService.chat(session.id, text)
        setMessages(result.messages)
        if (result.ticketId) setTicketId(result.ticketId)
      }
    } catch {
      setError('Falha ao enviar. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  async function speakToHuman() {
    if (!session || sending) return
    setSending(true)
    try {
      const result = await supportService.escalate(session.id, 'Falar com atendente')
      setTicketId(result.ticketId)
      const data = await supportService.getTicket(result.ticketId)
      setMessages(data.messages)
    } catch {
      setError('Não foi possível abrir o chamado.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/20 transition-transform hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        title="Suporte SISCR"
        aria-label={open ? 'Fechar suporte' : 'Abrir suporte'}
      >
        {open ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex w-[min(100vw-2.5rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div>
              <div className="font-display text-sm font-semibold">Assistente SISCR</div>
              <div className="text-[11px] text-white/80">
                {ticketId ? 'Conectado com o suporte' : 'Nano IA com dados da sua empresa'}
              </div>
            </div>
          </header>

          <div ref={listRef} className="h-80 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950">
            {loading && <p className="text-center text-xs text-slate-500">Abrindo conversa…</p>}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  m.author_type === 'client'
                    ? 'ml-auto bg-brand-600 text-white'
                    : m.author_type === 'system'
                      ? 'mx-auto bg-slate-200 text-center text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.author_type !== 'client' && m.author_type !== 'system' && (
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                    {authorLabel(m.author_type, m.author_nome)}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>

          {error && <p className="px-3 py-1 text-xs text-red-600">{error}</p>}

          {!ticketId && (
            <button
              type="button"
              onClick={() => void speakToHuman()}
              disabled={sending || !session}
              className="border-t border-slate-200 px-3 py-2 text-left text-xs font-medium text-brand-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-slate-800"
            >
              Falar com um atendente
            </button>
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva sua dúvida…"
              className="h-9 flex-1 rounded-control border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-3">
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}
