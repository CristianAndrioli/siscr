import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'

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
import estoqueInventarioRoutes from './routes/estoqueInventario'
import financeiroRoutes from './routes/financeiro'
import bancarioRoutes from './routes/bancario'
import faturamentoRoutes from './routes/faturamento'
import entradaRoutes from './routes/entrada'
import vendasRoutes from './routes/vendas'
import metasVendasRoutes from './routes/metasVendas'
import pessoaInteracoesRoutes from './routes/pessoaInteracoes'
import oportunidadesRoutes from './routes/oportunidades'
import comprasRoutes from './routes/compras'
import stripeWebhookRoutes from './routes/stripe-webhook'
import publicLookupRoutes from './routes/publicLookup'
import cronRoutes from './routes/cron'
import queueRoutes from './routes/queue'
import logsRoutes from './routes/logs'
import frotaRoutes from './routes/frota'
import frotaExtrasRoutes from './routes/frotaExtras'
import preferencesRoutes from './routes/preferences'
import contabilidadeRoutes from './routes/contabilidade'
import conexoesRoutes from './routes/conexoes'
import cadastrosFinanceiroRoutes from './routes/cadastrosFinanceiro'
import cadastrosProdutosAuxRoutes from './routes/cadastrosProdutosAux'
import relatoriosRoutes from './routes/relatorios'
import supportRoutes from './routes/support'
import deskRoutes from './routes/desk'

export { SupportTicketRoom } from './durable-objects/SupportTicketRoom'

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
  // Workers AI (nano assistente de suporte)
  AI?: Ai
  // Chat ao vivo por ticket
  SUPPORT_TICKET_ROOMS: DurableObjectNamespace
  // Variáveis de ambiente
  ENVIRONMENT: string
  APP_URL: string
  FRONTEND_URL: string
  ALLOWED_ORIGINS: string
  SUPPORT_DESK_URL?: string
  // Secrets (definidos via wrangler secret put)
  BETTER_AUTH_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_BASICO: string
  STRIPE_PRICE_PRO: string
  STRIPE_PRICE_ENTERPRISE: string
  /**
   * "1" = geração de XML NF-e para desenvolvimento (sem exigir A1).
   * Produção/staging: use "0".
   */
  NFE_DEV_MODE?: string
  /** Limite mensal de NF-e autorizadas por tenant (default 50). Gancho para pacotes. */
  NFE_QUOTA_MENSAL?: string
  /**
   * Host “pai” do app (sem esquema), ex.: app.suaempresa.com.br
   * Habilita tenant por subdomínio: {slug}.app.suaempresa.com.br (API + CORS).
   */
  TENANT_HOST_BASE?: string
  // E-mail — Resend (wrangler secret put RESEND_API_KEY)
  RESEND_API_KEY?: string
  /** Remetente padrão, ex.: "SISCR <noreply@siscr.com.br>" */
  EMAIL_FROM?: string
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
app.use('/api/tenant/frota', requireTenantModule('frota'))
app.use('/api/tenant/cadastros', requireTenantModule('cadastros'))
app.use('/api/tenant/estoque', requireTenantModule('estoque'))
app.use('/api/tenant/financeiro', requireTenantModule('financeiro'))
app.use('/api/tenant/bancario', requireTenantModule('financeiro'))
app.use('/api/tenant/faturamento', requireTenantModule('faturamento'))
app.use('/api/tenant/entrada', requireTenantModule('faturamento'))
app.use('/api/tenant/vendas', requireTenantModule('faturamento'))
app.use('/api/tenant/compras', requireTenantModule('faturamento'))
app.use('/api/tenant/conexoes', requireTenantModule('configuracoes'))

// ─── Rotas do tenant (autenticadas + tenant identificado) ──────
app.route('/api/tenant/info', tenantRoutes)
app.route('/api/tenant/permissoes', permissoesRoutes)
app.route('/api/tenant/cadastros', cadastrosRoutes)
app.route('/api/tenant/cadastros', cadastrosFinanceiroRoutes)
app.route('/api/tenant/cadastros', cadastrosProdutosAuxRoutes)
app.route('/api/tenant/estoque', estoqueRoutes)
app.route('/api/tenant/estoque', estoqueInventarioRoutes)
app.route('/api/tenant/financeiro', financeiroRoutes)
app.route('/api/tenant/bancario', bancarioRoutes)
app.route('/api/tenant/faturamento', faturamentoRoutes)
app.route('/api/tenant/entrada', entradaRoutes)
app.route('/api/tenant/vendas', vendasRoutes)
app.route('/api/tenant/vendas', metasVendasRoutes)
app.route('/api/tenant/vendas', pessoaInteracoesRoutes)
app.route('/api/tenant/vendas', oportunidadesRoutes)
app.route('/api/tenant/compras', comprasRoutes)
app.route('/api/tenant/logs', logsRoutes)
app.route('/api/tenant/frota', frotaRoutes)
app.route('/api/tenant/frota', frotaExtrasRoutes)
app.route('/api/tenant/preferences', preferencesRoutes)
app.route('/api/tenant/contabilidade', contabilidadeRoutes)
app.route('/api/tenant/conexoes', conexoesRoutes)
app.route('/api/tenant/relatorios', relatoriosRoutes)

// ─── Suporte do cliente (IA + tickets) — sessão ERP, sem guarda de módulo ──
app.use('/api/support/*', tenantMiddleware)
app.use('/api/support/*', authMiddleware)
app.route('/api/support', supportRoutes)

// ─── Mesa interna (agentes SISCR) — fora do pipeline tenant ────
app.route('/api/desk', deskRoutes)

// ─── Rotas internas (Cron + Queue handlers) ───────────────────
app.route('/__cron', cronRoutes)
app.route('/__queue', queueRoutes)

// ─── Handler padrão para rotas não encontradas ────────────────
app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404))

app.onError((err, c) => {
  // Respostas de erro deliberadas (validação, 4xx) não são falhas do servidor:
  // preservar status e corpo originais em vez de virarem 500 genérico.
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  console.error('Erro não tratado:', err)

  // Fora de produção o detalhe vai na resposta: sem isso, todo defeito em
  // staging chega ao cliente como "Erro interno do servidor" e só é
  // diagnosticável com `wrangler tail`.
  if (c.env.ENVIRONMENT !== 'production') {
    return c.json(
      {
        error: 'Erro interno do servidor',
        detalhe: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      },
      500,
    )
  }

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
