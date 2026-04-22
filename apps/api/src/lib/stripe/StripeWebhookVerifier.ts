/**
 * Verificação do header `Stripe-Signature` em webhooks.
 *
 * Segurança aplicada
 * -----------------------------------------------------------------
 * 1) HMAC-SHA256 com o secret (`STRIPE_WEBHOOK_SECRET`) sobre o payload
 *    no formato `<timestamp>.<raw-body>` — idêntico ao esquema v1 do
 *    Stripe. Referência:
 *    https://stripe.com/docs/webhooks/signatures#verify-manually
 *
 * 2) Comparação em tempo constante (`constantTimeEqual`) para evitar
 *    inferência por timing do segredo via rede.
 *
 * 3) Janela de tolerância de timestamp (default 5 min) para bloquear
 *    replay attacks: payloads capturados não podem ser reenviados
 *    indefinidamente. Ajustável via construtor.
 *
 * 4) Falha fechada: qualquer exceção interna, parse incorreto ou
 *    assinatura ausente resulta em `false` — nunca `true`.
 *
 * Uso
 * -----------------------------------------------------------------
 *   const verifier = new StripeWebhookVerifier(env.STRIPE_WEBHOOK_SECRET)
 *   const ok = await verifier.verify(rawBody, header)
 *   if (!ok) return c.json({ error: 'Assinatura inválida.' }, 401)
 */
export class StripeWebhookVerifier {
  private readonly toleranceSeconds: number

  constructor(
    private readonly secret: string,
    opts: { toleranceSeconds?: number } = {},
  ) {
    this.toleranceSeconds = opts.toleranceSeconds ?? 300
  }

  async verify(rawBody: string, header: string | null | undefined): Promise<boolean> {
    if (!header || !this.secret) return false

    try {
      const parsed = this.parseHeader(header)
      if (!parsed) return false

      // 1) Janela anti-replay
      const nowSec = Math.floor(Date.now() / 1000)
      if (Math.abs(nowSec - parsed.timestamp) > this.toleranceSeconds) {
        return false
      }

      // 2) Recalcular HMAC
      const signedPayload = `${parsed.timestamp}.${rawBody}`
      const expected = await this.hmacHex(signedPayload)

      // 3) Comparação timing-safe contra QUALQUER assinatura v1 presente
      //    (Stripe pode enviar múltiplas durante rotação de secrets).
      for (const candidate of parsed.signatures) {
        if (this.constantTimeEqual(expected, candidate)) return true
      }
      return false
    } catch {
      return false
    }
  }

  // ── helpers privados ────────────────────────────────────────────

  private parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
    const parts = header.split(',').map((p) => p.trim())
    let timestamp: number | null = null
    const signatures: string[] = []

    for (const p of parts) {
      const eq = p.indexOf('=')
      if (eq <= 0) continue
      const key = p.slice(0, eq)
      const val = p.slice(eq + 1)
      if (key === 't') {
        const n = Number(val)
        if (Number.isFinite(n)) timestamp = n
      } else if (key === 'v1') {
        signatures.push(val)
      }
    }

    if (timestamp === null || signatures.length === 0) return null
    return { timestamp, signatures }
  }

  private async hmacHex(message: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
  }
}
