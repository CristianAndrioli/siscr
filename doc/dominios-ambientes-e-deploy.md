# Domínios, Ambientes e Deploy

Este documento descreve a configuração de domínios no Cloudflare, a estratégia de ambientes (staging / production), o fluxo de branches e o passo a passo para ativar produção.

---

## 1. Visão geral dos ambientes

| Ambiente | Branch Git | Frontend | API | Tenant |
|----------|-----------|----------|-----|--------|
| **dev** | qualquer | `localhost:5173` | `localhost:8787` | `?tenant=slug` |
| **staging** | `staging` | `staging.siscr.com.br` | `api-staging.siscr.com.br` | `?tenant=slug` |
| **production** | `main` | `app.siscr.com.br` | `api.siscr.com.br` | `slug.app.siscr.com.br` |

---

## 2. DNS no Cloudflare (`siscr.com.br`)

### Registros ativos

| Tipo | Nome | Destino | Proxy | Finalidade |
|------|------|---------|-------|------------|
| CNAME | `staging` | `siscr-web.pages.dev` | ON | Frontend staging |
| CNAME | `app` | `siscr-web.pages.dev` | ON | Frontend produção (futuro) |
| CNAME | `*.app` | `siscr-web.pages.dev` | ON | Tenants em produção: `slug.app.siscr.com.br` (futuro) |
| Worker | `api-staging` | `siscr-api-staging` | ON | API staging — criado pelo Worker dashboard |
| MX | `siscr.com.br` | — | OFF | E-mail |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` | OFF | E-mail |
| TXT | `siscr.com.br` | `v=spf1 -all` | OFF | E-mail |

### Importante: custom domain de Worker

O registro DNS do Worker de produção (`api.siscr.com.br`) **não deve ser criado manualmente** no DNS. Deve ser adicionado pelo painel do Worker:

> Workers & Pages → `siscr-api-production` → Settings → Domains & Routes → Add → Custom Domain

O Cloudflare cria o registro automaticamente. Criar manualmente antes causa conflito.

---

## 3. Workers & Pages — recursos ativos

| Recurso | Tipo | Domínio | Finalidade |
|---------|------|---------|------------|
| `siscr-web` | Pages | `staging.siscr.com.br` | Frontend (staging e futuro production) |
| `siscr-api-staging` | Worker | `api-staging.siscr.com.br` | API de staging |
| `siscr-api-production` | Worker | `api.siscr.com.br` | API de produção (a criar) |

### siscr-web (Pages)

- **Production branch:** `staging` → serve `staging.siscr.com.br`
- **Custom domain:** `staging.siscr.com.br` (Active, SSL enabled)
- **Deploy:** via GitHub Actions (`wrangler pages deploy`), sem integração Git nativa no painel — comportamento correto
- Quando a branch `staging` recebe push, o pipeline rebuilda o frontend e faz deploy automaticamente

---

## 4. Fluxo de branches e pipelines

```
feat/* ou fix/*
      │
      │  Pull Request
      ▼
   staging  ──── push ──→  .github/workflows/deploy-staging.yml
                            ├─ wrangler d1 migrations apply --env staging
                            ├─ wrangler deploy --env staging
                            ├─ pnpm build (VITE_API_URL=https://api-staging.siscr.com.br)
                            └─ wrangler pages deploy → staging.siscr.com.br
      │
      │  Pull Request (revisão final)
      ▼
    main  ──── push ──→  .github/workflows/deploy-production.yml  (a criar)
                          ├─ wrangler d1 migrations apply --env production
                          ├─ wrangler deploy --env production
                          ├─ pnpm build (VITE_API_URL=https://api.siscr.com.br)
                          └─ wrangler pages deploy → app.siscr.com.br
```

---

## 5. Como funciona o tenant por subdomínio

### Staging
Tenant identificado via **query param** ou **header**:
```
https://staging.siscr.com.br?tenant=acme
```
O frontend sincroniza o slug no `localStorage` (`TenantUrlSync`). Não requer configuração DNS por tenant.

### Produção
Tenant identificado via **subdomínio** (`TENANT_HOST_BASE=app.siscr.com.br`):
```
https://acme.app.siscr.com.br
```
O wildcard DNS `*.app → siscr-web.pages.dev` já está configurado e cobre **todos os tenants automaticamente**. Quando um cliente paga via Stripe e o tenant é criado no banco, o subdomínio já funciona — sem nenhuma ação manual de DNS.

---

## 6. Ativar produção — passo a passo completo

### 6.1 Criar recursos no Cloudflare

```bash
# A partir da raiz do projeto (pnpm deve estar instalado)

# Banco D1
npx wrangler d1 create siscr-shared-production
# → anota o database_id retornado

# KV Sessões
npx wrangler kv namespace create KV_SESSIONS --env production
# → anota o id retornado

# KV Cache de tenant
npx wrangler kv namespace create KV_TENANT_CACHE --env production
# → anota o id retornado

# R2 (bucket já definido no wrangler.toml como siscr-storage-production)
# Criar pelo painel: Cloudflare → R2 → Create bucket → siscr-storage-production

# Queue
npx wrangler queues create siscr-tasks-production
```

### 6.2 Substituir PLACEHOLDERs no `wrangler.toml`

Em `apps/api/wrangler.toml`, seção `[env.production]`, substituir:

```toml
[[env.production.d1_databases]]
database_id = "PLACEHOLDER_PROD_SHARED_DB_ID"   # → ID do d1 create

[[env.production.kv_namespaces]]
id = "PLACEHOLDER_PROD_KV_SESSIONS_ID"           # → ID do kv sessions

[[env.production.kv_namespaces]]
id = "PLACEHOLDER_PROD_KV_TENANT_CACHE_ID"       # → ID do kv tenant cache
```

### 6.3 Aplicar migrações e fazer deploy do Worker

```bash
cd apps/api

# Migrações
npx wrangler d1 migrations apply siscr-shared-production --remote --env production

# Deploy do Worker
npx wrangler deploy --env production
```

### 6.4 Adicionar custom domain no Worker de produção

No painel Cloudflare:
> Workers & Pages → `siscr-api-production` → Settings → Domains & Routes → Add → Custom Domain → `api.siscr.com.br`

**Não criar o CNAME manualmente no DNS antes disso.**

### 6.5 Definir secrets de produção

```bash
cd apps/api

npx wrangler secret put BETTER_AUTH_SECRET --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put STRIPE_PRICE_BASICO --env production
npx wrangler secret put STRIPE_PRICE_PRO --env production
npx wrangler secret put STRIPE_PRICE_ENTERPRISE --env production
npx wrangler secret put CERT_BLOB_SECRET --env production
```

### 6.6 Criar o Pages de produção

Criar um **novo projeto Pages** separado do staging:

```bash
cd apps/api
npx wrangler pages project create siscr-web-production --production-branch=main
```

Adicionar custom domain no painel:
> Workers & Pages → `siscr-web-production` → Custom domains → `app.siscr.com.br`

### 6.7 Criar o workflow de produção

Criar `.github/workflows/deploy-production.yml` espelhando o de staging, com:
- Trigger: `push` na branch `main`
- `wrangler deploy --env production`
- `VITE_API_URL=https://api.siscr.com.br`
- `VITE_TENANT_HOST_BASE=app.siscr.com.br`
- `VITE_TENANT_URL_TEMPLATE=https://{slug}.app.siscr.com.br`
- `wrangler pages deploy --project-name=siscr-web-production --branch=main`

### 6.8 Atualizar webhook do Stripe

No Stripe Dashboard → Developers → Webhooks → adicionar endpoint de produção:
```
https://api.siscr.com.br/api/webhooks/stripe
```

### 6.9 Checklist final antes de considerar "pronto"

- [ ] `GET https://api.siscr.com.br/api/health` retorna `{"status":"ok","environment":"production"}`
- [ ] `https://app.siscr.com.br` carrega o frontend sem erros de CORS
- [ ] Fluxo de cadastro + pagamento Stripe cria tenant no D1 de produção
- [ ] `https://acme.app.siscr.com.br` carrega o app com tenant correto
- [ ] Webhook Stripe respondendo 200 em produção
- [ ] Migrações D1 de produção aplicadas

---

## 7. Secrets necessários por ambiente

| Secret | Staging | Produção |
|--------|---------|---------|
| `BETTER_AUTH_SECRET` | ✅ | a definir |
| `STRIPE_SECRET_KEY` | ✅ | a definir |
| `STRIPE_WEBHOOK_SECRET` | ✅ | a definir (signing secret do endpoint de prod) |
| `STRIPE_PRICE_BASICO` | ✅ | a definir |
| `STRIPE_PRICE_PRO` | ✅ | a definir |
| `STRIPE_PRICE_ENTERPRISE` | ✅ | a definir |
| `CERT_BLOB_SECRET` | ✅ | a definir |

---

## 8. Variáveis de ambiente por ambiente

Definidas em `apps/api/wrangler.toml`:

| Variável | Dev | Staging | Produção |
|----------|-----|---------|---------|
| `APP_URL` | `http://localhost:8787` | `https://api-staging.siscr.com.br` | `https://api.siscr.com.br` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://staging.siscr.com.br` | `https://app.siscr.com.br` |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | `https://staging.siscr.com.br` | `https://app.siscr.com.br` |
| `TENANT_HOST_BASE` | — | — | `app.siscr.com.br` |
| `NFE_DEV_MODE` | `1` | `0` | `0` |
| `ENVIRONMENT` | `development` | `staging` | `production` |
