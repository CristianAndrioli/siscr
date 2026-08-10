/**
 * Persiste eventos de transmissão / rejeição vinculados à URL da tela da nota,
 * para a aba Logs listar o histórico (não só o último `transmissao_erro`).
 */

export async function appendNotaEventoLog(
  db: D1Database,
  params: {
    tenantId: string
    notaId: string
    /** Prefixo de rota da tela, ex.: `/faturamento/nfse` ou `/faturamento/nf-venda` */
    routePrefix: string
    friendlyMessage: string
    technical?: string | null
    context?: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO error_logs
        (id, tenant_id, timestamp, friendly_message, technical, stack_trace, url, context, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      params.tenantId,
      now,
      params.friendlyMessage.slice(0, 500),
      (params.technical || null)?.slice(0, 4000) ?? null,
      `${params.routePrefix}/${params.notaId}`,
      (params.context || 'Transmissão').slice(0, 200),
      now,
    )
    .run()
}
