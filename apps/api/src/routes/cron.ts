import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// Cron: verificar vencimentos (06:00 UTC diário)
app.post('/0 6 * * *', async (c) => {
  console.log('[Cron] Verificando vencimentos...')

  const hoje = new Date().toISOString().split('T')[0]

  // Buscar contas vencidas e enviar para fila de notificação
  const { results: vencidas } = await c.env.DB_SHARED
    .prepare("SELECT id, tenant_id, valor, vencimento FROM contas_receber WHERE status = 'pendente' AND vencimento < ? LIMIT 500")
    .bind(hoje)
    .all()

  for (const conta of vencidas) {
    await c.env.QUEUE_TASKS.send({
      type: 'notificar_vencimento',
      contaId: conta.id,
      tenantId: conta.tenant_id,
      valor: conta.valor,
      vencimento: conta.vencimento,
    })
  }

  console.log(`[Cron] ${vencidas.length} contas vencidas enfileiradas para notificação.`)
  return c.json({ processadas: vencidas.length })
})

// Cron: renovação de assinaturas (03:00 UTC diário)
app.post('/0 3 * * *', async (c) => {
  console.log('[Cron] Verificando assinaturas para renovação...')

  const { results: expirando } = await c.env.DB_SHARED
    .prepare("SELECT id, slug, stripe_customer_id FROM tenants WHERE status = 'active' AND subscription_expires_at < date('now', '+3 days')")
    .all()

  for (const tenant of expirando) {
    await c.env.QUEUE_TASKS.send({
      type: 'renovar_assinatura',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    })
  }

  console.log(`[Cron] ${expirando.length} assinaturas próximas do vencimento.`)
  return c.json({ verificadas: expirando.length })
})

export default app
