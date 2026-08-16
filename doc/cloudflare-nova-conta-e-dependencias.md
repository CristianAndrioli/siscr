# Nova conta Cloudflare — instanciar o SISCR do zero

Este guia lista **dependências, recursos e arquivos** que precisam ser recriados ou atualizados ao levar o projeto para **outra conta Cloudflare** (time novo, cliente enterprise, fork oficial, etc.).

## 1. Visão geral do que a Cloudflare hospeda

| Recurso | Uso no SISCR | Onde configurar |
|---------|----------------|-----------------|
| **Workers** | API Hono (`apps/api`) | `wrangler deploy`, nome em `wrangler.toml` (`name`, `[env.staging]`, `[env.production]`) |
| **D1** | SQLite multi-tenant (`DB_SHARED`) | `database_id` em `wrangler.toml` |
| **KV** | Sessões (`KV_SESSIONS`), cache de tenant (`KV_TENANT_CACHE`) | IDs em `wrangler.toml` |
| **R2** | Certificados A1, XMLs, artefatos | `bucket_name` + binding `R2_STORAGE` |
| **Queues** | Tarefas assíncronas | Nome da fila em `wrangler.toml` + consumer |
| **Cron Triggers** | Rotinas agendadas | `[triggers] crons` no `wrangler.toml` |
| **Pages** | Frontend React (`apps/web/dist`) e mesa de suporte (`apps/support/dist`) | Projetos Pages + branch de deploy (`siscr-web`, `siscr-support`) |
| **Email Service** | Transacional (verificação, senha, boas-vindas, ticket) | Binding `EMAIL` + domínio onboardado em Email Sending |

Nada disso é “copiado” entre contas: **crie recursos novos** na conta destino e **substitua IDs e nomes** no repositório ou via variáveis de CI.

## 2. Ordem sugerida na nova conta

1. Instalar e autenticar Wrangler: `npx wrangler login` (conta correta).
2. Criar **D1** com o nome desejado (ex.: `siscr-shared-staging`), anotar **`database_id`**.
3. Criar **2 namespaces KV** (sessões + cache), anotar **IDs**.
4. Criar **bucket R2** (staging e produção se separar).
5. Criar **Queue** (ex.: `siscr-tasks-staging`).
6. Ajustar **`apps/api/wrangler.toml`**:
   - `account_id` (opcional se usar `wrangler` com login).
   - Todos os `database_id`, `id` de KV, nomes de bucket e fila.
   - `[env.staging.vars]` e `[env.production.vars]`: `APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `ENVIRONMENT`, `NFE_DEV_MODE`.
   - Opcional produção: `TENANT_HOST_BASE` se usar subdomínio por tenant.
7. Aplicar migrações D1: `wrangler d1 migrations apply <nome-db> --remote --env staging` (a partir de `apps/api`).
8. Deploy do Worker: `wrangler deploy --env staging` (ou produção).
9. Criar projeto **Pages** (ou usar `wrangler pages project create`), configurar branch de deploy.
10. Onboard do domínio em **Compute → Email Service → Email Sending** (não use Email Routing se o MX da zona já aponta para outro provedor). O Cloudflare cria SPF/DKIM em `cf-bounce.<domínio>`.
11. Configurar **GitHub Actions** (ou outro CI) com secrets da nova conta.

## 3. Secrets do Worker (não versionados)

Definir com `wrangler secret put <NOME> --env staging` (e `--env production` quando aplicável):

| Secret | Uso |
|--------|-----|
| `BETTER_AUTH_SECRET` | Base de assinatura de sessão / tokens internos |
| Binding `AI` | Workers AI (assistente de suporte) — declarado no `wrangler.toml`, sem secret |
| Binding `EMAIL` | Cloudflare Email Service — `[[send_email]]` no `wrangler.toml`, sem secret |
| `STRIPE_SECRET_KEY` | API Stripe |
| `STRIPE_WEBHOOK_SECRET` | Validação do webhook em `/api/webhooks/stripe` |
| `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` | Price IDs dos planos (checkout) |
| `CERT_BLOB_SECRET` | Criptografia de certificado A1 no R2 (NF-e) |

Consulte `apps/api/src/index.ts` e `apps/api/wrangler.toml` para nomes exatos.

## 4. Stripe (fora da Cloudflare)

- No **Dashboard Stripe**, crie produtos/preços novos ou reutilize os mesmos IDs (se mesma conta Stripe).
- Configure o endpoint de webhook apontando para a **URL pública do Worker**, ex.:  
  `https://<seu-worker-staging>.<subdomain>.workers.dev/api/webhooks/stripe`  
  (ou domínio customizado da API, se configurado).
- Use o **signing secret** correspondente em `STRIPE_WEBHOOK_SECRET`.

## 5. CI/CD (GitHub Actions)

Arquivo atual: `.github/workflows/deploy-staging.yml`.

Ajustar para a nova conta:

| Item | O que mudar |
|------|-------------|
| `CLOUDFLARE_API_TOKEN` | Token na nova conta (Workers, D1, Pages conforme escopo). |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta destino. |
| Nome do D1 no comando `d1 migrations apply` | Deve coincidir com `database_name` no `wrangler.toml`. |
| `command: deploy --env staging` | Nome do worker em `[env.staging]` deve existir após primeiro deploy ou ajuste do `name`. |
| `VITE_API_URL` no step de build | URL **pública** do Worker de staging após deploy (ex.: `https://siscr-api-staging.<account>.workers.dev`). |
| `pages deploy ... --project-name=siscr-web` | Nome do projeto Pages na nova conta (criar antes ou alterar o nome). |
| `--branch=staging` | Branch do Pages que recebe o artefato (alinhada ao fluxo do repositório). |

Não existe hoje no repositório um `deploy-production.yml` separado; produção pode ser espelhada criando outro workflow ou usando tags — documente internamente o processo ao ativar.

## 6. Frontend — variáveis de build

No build do Pages (workflow ou painel):

- **`VITE_API_URL`** — URL canônica da API (Worker) acessível pelo navegador.
- Opcional: **`VITE_TENANT_HOST_BASE`**, **`VITE_TENANT_URL_TEMPLATE`** — ver `doc/tenant-e-dominios.md`.

## 7. DNS e domínio customizado

- **Pages:** adicionar domínio customizado ao projeto e, se necessário, wildcard para tenants (`*.app.dominio.com`).
- **Worker (API):** pode usar `workers.dev` ou **Custom Domain** no Worker; atualizar `APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` e qualquer URL hardcoded no CI.

## 8. Checklist rápido antes de considerar “pronto”

- [ ] `GET https://<api>/api/health` retorna JSON com `status: ok`.
- [ ] Login e chamada autenticada a `/api/tenant/...` com `Authorization` + tenant resolvido.
- [ ] Webhook Stripe recebido (teste no dashboard Stripe ou evento de teste).
- [ ] Pages abre o SPA e `VITE_API_URL` aponta para a API correta (sem CORS bloqueado — `ALLOWED_ORIGINS` alinhado).
- [ ] Migrações D1 aplicadas no ambiente remoto correto.

## 9. Arquivos-chave no repositório

| Arquivo | Conteúdo relevante |
|---------|---------------------|
| `apps/api/wrangler.toml` | Bindings D1, KV, R2, Queues, cron, `vars` por ambiente |
| `apps/api/src/index.ts` | CORS, `TENANT_HOST_BASE`, rotas montadas |
| `.github/workflows/deploy-staging.yml` | Pipeline staging |
| `packages/db/migrations/shared/` | SQL de schema compartilhado |

Manter este documento alinhado quando novos bindings (ex.: Hyperdrive, Durable Objects) forem adicionados ao projeto.
