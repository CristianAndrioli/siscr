import type { DurableObjectState } from '@cloudflare/workers-types'
import type { Env } from '../index'
import { SupportTicketRepository } from '../repositories/SupportTicketRepository'

type SocketMeta = {
  ticketId: string
  role: 'client' | 'agent'
  authorId: string
  authorNome: string
}

type Incoming = {
  type: 'message' | 'ping'
  body?: string
}

type HibernationSocket = {
  send(data: string): void
  close(): void
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}

/**
 * Uma instância por ticket. Hiberna conexões WebSocket e persiste no D1.
 */
export class SupportTicketRoom {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const url = new URL(request.url)
    const ticketId = url.searchParams.get('ticketId') ?? ''
    const role = (url.searchParams.get('role') === 'agent' ? 'agent' : 'client') as SocketMeta['role']
    const authorId = url.searchParams.get('authorId') ?? ''
    const authorNome = url.searchParams.get('authorNome') ?? ''
    if (!ticketId) {
      return new Response('ticketId required', { status: 400 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1] as unknown as HibernationSocket
    this.ctx.acceptWebSocket(pair[1] as never)
    server.serializeAttachment({ ticketId, role, authorId, authorNome } satisfies SocketMeta)

    const repo = new SupportTicketRepository(this.env.DB_SHARED)
    const history = await repo.listMessagesByTicket(ticketId)
    server.send(JSON.stringify({ type: 'history', messages: history }))

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: HibernationSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    let parsed: Incoming
    try {
      parsed = JSON.parse(message) as Incoming
    } catch {
      return
    }
    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
      return
    }
    if (parsed.type !== 'message' || !parsed.body?.trim()) return

    const meta = ws.deserializeAttachment() as SocketMeta | null
    if (!meta?.ticketId) return

    const repo = new SupportTicketRepository(this.env.DB_SHARED)
    const ticket = await repo.findTicket(meta.ticketId)
    if (!ticket) return

    const row = {
      id: crypto.randomUUID(),
      ticket_id: meta.ticketId,
      session_id: ticket.ai_session_id,
      author_type: meta.role === 'agent' ? ('agent' as const) : ('client' as const),
      author_id: meta.authorId,
      author_nome: meta.authorNome,
      body: parsed.body.trim(),
      created_at: new Date().toISOString(),
    }
    await repo.insertMessage(row)
    await repo.updateTicket(meta.ticketId, {
      status: meta.role === 'agent' ? 'waiting_client' : 'waiting_agent',
      assigned_agent_id: meta.role === 'agent' ? meta.authorId : undefined,
    })

    const payload = JSON.stringify({ type: 'message', message: row })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        ;(socket as unknown as HibernationSocket).send(payload)
      } catch {
        /* socket already closing */
      }
    }
  }

  async webSocketClose(ws: HibernationSocket): Promise<void> {
    ws.close()
  }
}
