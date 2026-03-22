import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// Handler de processamento de tasks da fila
// Chamado internamente pelo queue handler no index.ts
app.post('/process', async (c) => {
  const task = await c.req.json<{ type: string; [key: string]: unknown }>()

  switch (task.type) {
    case 'notificar_vencimento':
      console.log(`[Queue] Notificando vencimento da conta ${task.contaId}`)
      // TODO: integrar com Resend para envio de email
      break

    case 'renovar_assinatura':
      console.log(`[Queue] Renovando assinatura do tenant ${task.tenantSlug}`)
      // TODO: chamar Stripe API para renovação
      break

    case 'gerar_relatorio':
      console.log(`[Queue] Gerando relatório ${task.relatorioId}`)
      // TODO: processar e salvar PDF no R2
      break

    default:
      console.warn(`[Queue] Task desconhecida: ${task.type}`)
  }

  return c.json({ processed: true })
})

export default app
