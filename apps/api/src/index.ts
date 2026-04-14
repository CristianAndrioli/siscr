import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { tenantMiddleware } from './middleware/tenant'
import { authMiddleware } from './middleware/auth'
import { requireEmpresaMatrizMiddleware } from './middleware/requireEmpresaMatriz'
import { requireTenantModule } from './middleware/moduleGuard'

import authRoutes from './routes/auth'
import tenantRoutes from './routes/tenants'
import permissoesRoutes from './routes/permissoes'
import subscriptionRoutes from './routes/subscriptions'
import cadastrosRoutes from './routes/cadastros'
import estoqueRoutes from './routes/estoque'
import financeiroRoutes from './routes/financeiro'
import bancarioRoutes from './routes/bancario'
import faturamentoRoutes from './routes/faturamento'
import entradaRoutes from './routes/entrada'
import vendasRoutes from './routes/vendas'
import stripeWebhookRoutes from './routes/stripe-webhook'
import publicLookupRoutes from './routes/publicLookup'
import cronRoutes from './routes/cron'
import queueRoutes from './routes/queue'
import logsRoutes from './routes/logs'

export type Env = {
  // D1 — banco compartilhado (tenants, planos, billing)
  DB_SHARED: D1Database
  // KV — sessões e cache de tenant routing
  KV_SESSIONS: KVNamespace
  KV_TENANT_CACHE: KVNamespace
  // R2 — arquivos, XMLs NF-e, PDFs, certificados A1 cifrados
  R2_STORAGE?: R2Bucket
  /** Secret para AES-GCM do bundle .pfx+senha (wrangler secret put CERT_BLOB_SECRET) */
  CERT_BLOB_SECRET?: string
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
  STRIPE_PRICE_BASICO: string
  STRIPE_PRICE_PRO: string
  STRIPE_PRICE_ENTERPRISE: string
  /**
   * "1" = geração de XML NF-e para desenvolvimento (sem envio SOAP real nesta versão).
   * Produção: use "0" e implemente assinatura + SEFAZ.
   */
  NFE_DEV_MODE?: string
  /**
   * Host “pai” do app (sem esquema), ex.: app.suaempresa.com.br
   * Habilita tenant por subdomínio: {slug}.app.suaempresa.com.br (API + CORS).
   */
  TENANT_HOST_BASE?: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Middlewares globais ───────────────────────────────────────
app.use('*', async (c, next) => {
  const list =
    c.env.ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? ['http://localhost:5173']
  const tenantBase = c.env.TENANT_HOST_BASE?.trim().toLowerCase()
  return cors({
    origin: (origin) => {
      if (!origin) return list[0]
      if (list.includes(origin)) return origin
      if (tenantBase) {
        try {
          const host = new URL(origin).hostname.toLowerCase()
          if (host === tenantBase || host.endsWith(`.${tenantBase}`)) return origin
        } catch {
          /* ignore */
        }
      }
      return list[0]
    },
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

// ─── Proxies públicos (CEP / CNAE) — sem auth ─────────────────
app.route('/api/public', publicLookupRoutes)

// ─── Middleware de tenant (identifica tenant pelo header/subdomain)
app.use('/api/tenant/*', tenantMiddleware)
app.use('/api/tenant/*', authMiddleware)
app.use('/api/tenant/*', requireEmpresaMatrizMiddleware)

// Permissões por módulo (API) — após autenticação
app.use('/api/tenant/cadastros', requireTenantModule('cadastros'))
app.use('/api/tenant/estoque', requireTenantModule('estoque'))
app.use('/api/tenant/financeiro', requireTenantModule('financeiro'))
app.use('/api/tenant/bancario', requireTenantModule('financeiro'))
app.use('/api/tenant/faturamento', requireTenantModule('faturamento'))
app.use('/api/tenant/entrada', requireTenantModule('faturamento'))
app.use('/api/tenant/vendas', requireTenantModule('faturamento'))

// ─── Rotas do tenant (autenticadas + tenant identificado) ──────
app.route('/api/tenant/info', tenantRoutes)
app.route('/api/tenant/permissoes', permissoesRoutes)
app.route('/api/tenant/cadastros', cadastrosRoutes)
app.route('/api/tenant/estoque', estoqueRoutes)
app.route('/api/tenant/financeiro', financeiroRoutes)
app.route('/api/tenant/bancario', bancarioRoutes)
app.route('/api/tenant/faturamento', faturamentoRoutes)
app.route('/api/tenant/entrada', entradaRoutes)
app.route('/api/tenant/vendas', vendasRoutes)
app.route('/api/tenant/logs', logsRoutes)

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
  async queue(batch: MessageBatch, _env: Env, _ctx: ExecutionContext) {
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
