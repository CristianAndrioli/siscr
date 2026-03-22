import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { tenantMiddleware } from './middleware/tenant'
import { authMiddleware } from './middleware/auth'

import authRoutes from './routes/auth'
import tenantRoutes from './routes/tenants'
import subscriptionRoutes from './routes/subscriptions'
import cadastrosRoutes from './routes/cadastros'
import estoqueRoutes from './routes/estoque'
import financeiroRoutes from './routes/financeiro'
import faturamentoRoutes from './routes/faturamento'
import vendasRoutes from './routes/vendas'
import stripeWebhookRoutes from './routes/stripe-webhook'
import cronRoutes from './routes/cron'
import queueRoutes from './routes/queue'

export type Env = {
  // D1 — banco compartilhado (tenants, planos, billing)
  DB_SHARED: D1Database
  // KV — sessões e cache de tenant routing
  KV_SESSIONS: KVNamespace
  KV_TENANT_CACHE: KVNamespace
  // R2 — arquivos, XMLs NF-e, PDFs
  R2_STORAGE: R2Bucket
  // Queues — tarefas assíncronas
  QUEUE_TASKS: Queue
  // Variáveis de ambiente
  ENVIRONMENT: string
  APP_URL: string
  FRONTEND_URL: string
  ALLOWED_ORIGINS: string
  // Secrets (definidos via wrangler secret put)
  BETTER_AUTH_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Middlewares globais ───────────────────────────────────────
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173']
  return cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
    credentials: true,
  })(c, next)
})

app.use('*', logger())
app.use('*', prettyJSON())

// ─── Rota de health check (pública) ───────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  })
})

// ─── Rotas públicas (sem autenticação) ────────────────────────
app.route('/api/auth', authRoutes)
app.route('/api/webhooks/stripe', stripeWebhookRoutes)

// ─── Rotas de planos/assinaturas (públicas para signup) ───────
app.route('/api/subscriptions', subscriptionRoutes)

// ─── Middleware de tenant (identifica tenant pelo header/subdomain)
// Todas as rotas abaixo precisam de tenant identificado
app.use('/api/tenant/*', tenantMiddleware)
app.use('/api/tenant/*', authMiddleware)

// ─── Rotas do tenant (autenticadas + tenant identificado) ──────
app.route('/api/tenant/info', tenantRoutes)
app.route('/api/tenant/cadastros', cadastrosRoutes)
app.route('/api/tenant/estoque', estoqueRoutes)
app.route('/api/tenant/financeiro', financeiroRoutes)
app.route('/api/tenant/faturamento', faturamentoRoutes)
app.route('/api/tenant/vendas', vendasRoutes)

// ─── Rotas internas (Cron + Queue handlers) ───────────────────
app.route('/__cron', cronRoutes)
app.route('/__queue', queueRoutes)

// ─── Handler padrão para rotas não encontradas ────────────────
app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404))

app.onError((err, c) => {
  console.error('Erro não tratado:', err)
  return c.json({ error: 'Erro interno do servidor' }, 500)
})

export default {
  fetch: app.fetch,

  // Handler de Cron Triggers (agendamentos)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cronApp = new Hono<{ Bindings: Env }>()
    cronApp.route('/__cron', cronRoutes)

    const url = `http://internal/__cron/${event.cron}`
    const req = new Request(url, { method: 'POST' })
    await cronApp.fetch(req, env, ctx)
  },

  // Handler de Queue (tarefas assíncronas)
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    for (const message of batch.messages) {
      try {
        console.log(`Processando task: ${message.id}`, message.body)
        message.ack()
      } catch (err) {
        console.error(`Falha na task ${message.id}:`, err)
        message.retry()
      }
    }
  },
}
