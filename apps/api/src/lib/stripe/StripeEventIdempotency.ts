import type { D1Database } from '@cloudflare/workers-types'

/**
 * Gate de idempotência para webhooks Stripe.
 *
 * O Stripe re-entrega eventos em caso de falha/timeout. Alguns handlers
 * (subscription.updated / deleted) são inherentemente não-idempotentes
 * se executados duas vezes. Esta classe encapsula o "claim" do evento
 * pelo `event.id` via `INSERT OR IGNORE` — simples, atômico e barato
 * no D1.
 *
 * Contrato
 * -----------------------------------------------------------------
 * - `claim(eventId, type)`:
 *     true  → este processo é o dono, pode executar a lógica.
 *     false → evento já foi processado antes, ignorar.
 *
 * Tabela `stripe_events` — migração `0030_stripe_events_idempotency.sql`.
 */
export class StripeEventIdempotency {
  constructor(private readonly db: D1Database) {}

  /**
   * Tenta reservar o evento. Retorna true SE e somente se esta chamada
   * gravou uma nova linha.
   */
  async claim(eventId: string, eventType: string): Promise<boolean> {
    if (!eventId) return false
    const result = await this.db
      .prepare('INSERT OR IGNORE INTO stripe_events (event_id, event_type) VALUES (?, ?)')
      .bind(eventId, eventType)
      .run()
    // D1 expõe `meta.changes` (aka rows affected). 1 = novo evento, 0 = duplicado.
    const changes = (result as { meta?: { changes?: number } })?.meta?.changes ?? 0
    return changes > 0
  }
}
