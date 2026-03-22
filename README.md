# SISCR — ERP SaaS Multi-Tenant (Cloudflare)

> Branch: `cloudflare` — Migração completa para Cloudflare Workers + D1 + Pages.
> Stack 100% serverless, sem servidor, custo zero para começar.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS → **Cloudflare Pages** |
| Backend | **Hono** (TypeScript) → **Cloudflare Workers** |
| Banco de Dados | **Cloudflare D1** (SQLite, isolamento por tenant_id) |
| Cache / Sessões | **Cloudflare KV** |
| Arquivos / XMLs | **Cloudflare R2** |
| Tarefas Assíncronas | **Cloudflare Queues** |
| Agendamento | **Cloudflare Cron Triggers** |
| ORM | **Drizzle ORM** |
| Pagamentos | **Stripe** |
| Monorepo | **Turborepo + pnpm** |

## Estrutura do Projeto

```
siscr/
├── apps/
│   ├── web/          # Frontend React → Cloudflare Pages
│   └── api/          # Backend Hono → Cloudflare Workers
│       ├── src/
│       │   ├── index.ts           # Entry point do Worker
│       │   ├── middleware/
│       │   │   ├── tenant.ts      # Identifica tenant (header/subdomínio)
│       │   │   └── auth.ts        # JWT + sessões no KV
│       │   └── routes/
│       │       ├── auth.ts        # Login, signup, logout
│       │       ├── tenants.ts     # Empresas e filiais
│       │       ├── cadastros.ts   # Pessoas, produtos, serviços
│       │       ├── estoque.ts     # Posição + movimentações
│       │       ├── financeiro.ts  # Contas a receber/pagar
│       │       ├── faturamento.ts # NF-e, NFSe
│       │       ├── vendas.ts      # Pedidos e orçamentos
│       │       └── stripe-webhook.ts
│       └── wrangler.toml
├── packages/
│   ├── db/
│   │   ├── src/schema/shared.ts   # Schema Drizzle (todas as tabelas)
│   │   └── migrations/shared/     # Migrations SQL para D1
│   └── shared/
│       └── src/types/index.ts     # Tipos compartilhados
├── .github/workflows/
│   ├── deploy-staging.yml         # Auto-deploy na branch cloudflare
│   └── deploy-production.yml      # Deploy via tag (v*)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Arquitetura Multi-Tenant

```
Tenant (Grupo Empresa)
  └── D1 compartilhado (tenant_id em cada linha)
        ├── Empresa A (CNPJ 01)
        │     ├── Filial - Matriz SP
        │     └── Filial - RJ
        └── Empresa B (CNPJ 02)
              └── Filial - Única
```

Identificação do tenant:
- **Desenvolvimento:** header `X-Tenant-Slug: meugrupo`
- **Produção:** subdomínio `meugrupo.seudominio.com.br`

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/installation)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- Conta Cloudflare (gratuita em [cloudflare.com](https://cloudflare.com))

---

## Configuração Inicial (primeira vez)

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Autenticar no Cloudflare

```bash
wrangler login
```

### 3. Criar os recursos no Cloudflare (staging)

```bash
# Criar banco D1
wrangler d1 create siscr-shared-staging

# Criar namespaces KV
wrangler kv namespace create KV_SESSIONS --preview
wrangler kv namespace create KV_TENANT_CACHE --preview

# Criar bucket R2
wrangler r2 bucket create siscr-storage-staging

# Criar fila
wrangler queues create siscr-tasks-staging
```

> Após criar cada recurso, copie os IDs gerados e cole no `apps/api/wrangler.toml`
> nos campos marcados como `PLACEHOLDER_*`.

### 4. Aplicar migration no banco local

```bash
# Rodar D1 localmente (sem precisar do Cloudflare)
pnpm --filter=@siscr/api run db:migrate:shared
```

### 5. Configurar secrets

```bash
cd apps/api

# Chave secreta de autenticação (gere uma string aleatória)
wrangler secret put BETTER_AUTH_SECRET --env staging

# Stripe (modo teste)
wrangler secret put STRIPE_SECRET_KEY --env staging
wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
```

### 6. Iniciar em modo desenvolvimento

```bash
# Terminal 1 — API (Worker)
pnpm dev:api
# Disponível em: http://localhost:8787

# Terminal 2 — Frontend
pnpm dev:web
# Disponível em: http://localhost:5173
```

---

## Deploy para Staging (teste sem instalar na máquina)

O deploy de staging acontece **automaticamente** a cada push na branch `cloudflare`:

```bash
git push origin cloudflare
```

O GitHub Actions vai:
1. Aplicar migrations no D1 staging
2. Fazer deploy do Worker (API)
3. Fazer build do frontend
4. Fazer deploy do frontend no Cloudflare Pages

**URLs após deploy:**
- Frontend: `https://staging.siscr-web.pages.dev`
- API: `https://siscr-api-staging.SEU_ACCOUNT_ID.workers.dev`

---

## Secrets necessários no GitHub

Vá em: `GitHub → Repositório → Settings → Secrets and variables → Actions`

| Secret | Como obter |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Painel Cloudflare → My Profile → API Tokens → Create Token](https://dash.cloudflare.com/profile/api-tokens) → usar template "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | [Painel Cloudflare → lado direito da tela → Account ID](https://dash.cloudflare.com/) |

---

## Desenvolvimento local — Como testar multi-tenant

No desenvolvimento local, identifique o tenant pelo header:

```bash
# Testar health
curl http://localhost:8787/api/health

# Login (tenant identificado pelo body)
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@teste.com", "password": "senha123", "tenantSlug": "meugrupo"}'

# Requisição autenticada (tenant pelo header)
curl http://localhost:8787/api/tenant/cadastros/pessoas \
  -H "X-Tenant-Slug: meugrupo" \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Endpoints da API

### Públicos
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Criar conta (tenant + admin) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Usuário atual |
| GET | `/api/subscriptions/plans` | Listar planos |
| POST | `/api/webhooks/stripe` | Webhook Stripe |

### Autenticados (requerem `Authorization: Bearer TOKEN` + `X-Tenant-Slug`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tenant/info` | Dados do tenant |
| GET/POST | `/api/tenant/info/empresas` | Empresas do grupo |
| GET/POST | `/api/tenant/info/empresas/:id/filiais` | Filiais de uma empresa |
| GET/POST | `/api/tenant/cadastros/pessoas` | Clientes, fornecedores |
| GET/POST | `/api/tenant/cadastros/produtos` | Produtos |
| GET | `/api/tenant/estoque` | Posição de estoque |
| POST | `/api/tenant/estoque/movimentacao` | Entrada/saída de estoque |
| GET/POST | `/api/tenant/financeiro/receber` | Contas a receber |
| GET/POST | `/api/tenant/financeiro/pagar` | Contas a pagar |
| GET | `/api/tenant/financeiro/dashboard` | Resumo financeiro |
| GET/POST | `/api/tenant/vendas/pedidos` | Pedidos de venda |
| GET | `/api/tenant/faturamento/notas` | Notas fiscais |

---

## Custos estimados (Cloudflare)

| Escala | Tenants | Custo/mês |
|---|---|---|
| Desenvolvimento / Staging | qualquer | **$0** |
| Produção pequena (< 50 tenants) | 50 | **$5** |
| Produção média (50–200 tenants) | 200 | **~$16** |
| Produção grande (200–1.000 tenants) | 1.000 | **~$80** |
