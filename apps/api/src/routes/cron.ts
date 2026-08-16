import { Hono } from 'hono'
import type { Env } from '../index'
import { fetchSubscription, findActiveSubscriptionId, stripeCustomerId } from '../lib/stripe/stripeApi'
import { applyStripeSubscription } from '../lib/stripe/tenantBilling'

const app = new Hono<{ Bindings: Env }>()

// Cron: verificar vencimentos (06:00 UTC diário)
app.post('/0 6 * * *', async (c) => {
  console.log('[Cron] Verificando vencimentos...')

  const hoje = new Date().toISOString().split('T')[0]

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

// Cron: reconciliação Stripe (03:00 UTC diário) — Stripe Billing cobra; aqui só alinha status.
app.post('/0 3 * * *', async (c) => {
  console.log('[Cron] Reconciliando assinaturas Stripe...')

  const { results: tenants } = await c.env.DB_SHARED
    .prepare(
      `SELECT id, slug, stripe_customer_id, stripe_subscription_id, status
       FROM tenants
       WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != ''
       LIMIT 200`,
    )
    .all<{
      id: string
      slug: string
      stripe_customer_id: string
      stripe_subscription_id: string | null
      status: string
    }>()

  let reconciled = 0
  for (const tenant of tenants ?? []) {
    await c.env.QUEUE_TASKS.send({
      type: 'reconciliar_assinatura',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      stripeCustomerId: tenant.stripe_customer_id,
      stripeSubscriptionId: tenant.stripe_subscription_id,
    })
    reconciled += 1
  }

  console.log(`[Cron] ${reconciled} tenants enfileirados para reconciliação Stripe.`)
  return c.json({ verificadas: reconciled })
})

export async function reconcileTenantSubscription(
  env: Env,
  tenant: { stripeSubscriptionId?: string | null; stripeCustomerId?: string | null },
): Promise<void> {
  let subId = tenant.stripeSubscriptionId?.trim() || null
  if (!subId && tenant.stripeCustomerId) {
    subId = await findActiveSubscriptionId(env, tenant.stripeCustomerId)
  }
  if (!subId) return
  const sub = await fetchSubscription(env, subId)
  const customer = stripeCustomerId(sub.customer) || tenant.stripeCustomerId || undefined
  await applyStripeSubscription(env, sub, { customerHint: customer })
}

export default app
