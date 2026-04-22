# Multi-tenant — SISCR

Como o SISCR separa dados e contexto por cliente (tenant).

## Modelo físico

- Um único banco D1 (`DB_SHARED`).
- Cada tabela de negócio tem coluna `tenant_id TEXT NOT NULL` e
  índice em `(tenant_id, ...)` para queries filtradas.
- Não existe DB por cliente. Se um dia fizer sentido (uso
  muito desigual entre clientes, necessidade de restore isolado, ou
  compliance regional), a migração seria custosa mas bem encapsulada
  graças à camada de repositórios.

## Resolução de tenant (pipeline HTTP)

A cada requisição em `/api/tenant/*`:

1. `tenantMiddleware` decide o tenant pela ordem:
   - Header `X-Tenant-Slug` (usado pelo axios interceptor do
     frontend — veja `SiscrHttpClient.ts`).
   - Subdomínio (quando em produção e `VITE_TENANT_HOST_BASE` estiver
     configurado). O DNS wildcard aponta cada `*.<base>` para o
     mesmo Worker.
   - Slug salvo na sessão (fallback interno).

   Resolve o tenant contra `KV_TENANT_CACHE` (cache) → D1 e coloca
   `{ tenantId, slug, ... }` em `c.set('tenant', ...)`.

2. `authMiddleware` carrega a sessão e **compara** o tenant da
   sessão com o tenant resolvido. Divergência = `TENANT_MISMATCH`
   (403). Esse cross-tenant guard é o ponto mais importante deste
   pipeline — veja `seguranca.md`.

3. `requireEmpresaMatriz` / `requireTenantModule`: guardas de
   onboarding e permissões.

## Frontend — como o slug chega até aqui

Dois caminhos:

- **Por subdomínio** (produção): `componente TenantUrlSync.tsx`
  detecta o host `<slug>.<base>` e persiste o slug no localStorage.
- **Por query string/localStorage** (dev/homologação): o usuário
  entra via `/login?tenant=<slug>` ou digita no seletor; o slug é
  salvo em `localStorage['tenant_slug']`.

O `SiscrHttpClient` sempre envia `X-Tenant-Slug` com o valor lido do
`sessionStore` (que lê do localStorage hoje). Por isso mesmo em
produção com subdomínio, a request pode redundar o slug — o backend
aceita ambos.

## Criação de tenant

Hoje só via **checkout Stripe**. Fluxo:

1. Usuário preenche signup + escolhe plano no frontend.
2. `POST /api/subscriptions/checkout`:
   - Valida payload com Zod.
   - Hashea a senha (`PasswordHasher.hash`).
   - Grava `pending_signup:<slug>` no `KV_TENANT_CACHE` (TTL 1h).
   - Cria sessão Stripe Checkout e devolve URL.
3. Stripe redireciona usuário para a URL de pagamento.
4. Stripe envia `checkout.session.completed` para
   `/webhooks/stripe`.
5. Webhook:
   - Valida assinatura.
   - Claim de idempotência (`stripe_events`).
   - Lê `pending_signup:<slug>` do KV.
   - `INSERT INTO tenants` + `INSERT INTO users` (admin do tenant).
   - Grava `auto_login:<slug>` no KV_SESSIONS (TTL 10min, one-shot).
6. Frontend em `/checkout/success` chama `GET /auth/session-status`
   até ver `status: 'ready'` com `token` — faz auto-login.

## Convenções para código novo

- **`tenant_id` é sagrado**: nunca aceitar do body/query. Vem
  sempre de `c.get('tenant')`.
- **Repositórios** herdam de `BaseTenantRepository` — veja
  `padroes-arquitetura.md` §Camadas.
- **Joins entre tabelas de tenant** casam `tenant_id` no ON:
  ```sql
  LEFT JOIN pessoas p
    ON p.id = x.pessoa_id
   AND p.tenant_id = x.tenant_id
  ```
  Sem isso, um bug de inserção em outro tenant poderia vazar.

- **Listagens** com filtros opcionais devem montar a WHERE clause
  com `?` parametrizados e não interpolar strings — mesmo quando o
  valor vem "seguro" do Zod. É mais curto de escrever certo e evita
  surpresa no futuro.

- **Cache no KV**: quando invalidar, lembrar de `await
  env.KV_TENANT_CACHE.delete(`tenant:${slug}`)`. Ver pontos no
  `stripe-webhook.ts`.

## DNS e domínios em produção

O SISCR foi desenhado para que cada tenant tenha seu próprio
subdomínio (ex.: `cliente-abc.siscr.com.br`). Hoje, em
homologação, o app usa `localhost:5173` e identifica o tenant pelo
header `X-Tenant-Slug`. A migração para subdomínios não muda
qualquer decisão de backend — o middleware já resolve os dois
modos.

Detalhes operacionais de DNS (Cloudflare Pages rules,
certificados, etc.) vivem em `cloudflare-nova-conta-e-dependencias.md`
e `tenant-e-dominios.md`.

## Plan limits

`lib/planLimits.ts` expõe:

- `resolvePlanForTenant(db, tenantId)` → plano efetivo (considera
  overrides na tabela `tenants`).
- `getTenantUsage(db, tenantId)` → contadores atuais de empresas,
  filiais, usuários.
- `checkCanCreateEmpresa`, `checkCanCreateFilial`,
  `checkCanCreateUsuario` → retornam `null` se pode, ou
  `{ error, code: 'PLAN_LIMIT_XXX' }` se bateu no limite.

O axios interceptor do frontend escuta esses `code:
PLAN_LIMIT_XXX` e dispara `siscr:plan-limit` CustomEvent. Toda
rota nova que crie recursos contáveis deve chamar o check
correspondente antes de inserir.

## Downgrade / Suspensão

Trigger: `customer.subscription.deleted` ou falha de pagamento.

- Webhook marca `tenants.status = 'suspended'`.
- `tenantMiddleware` deixa o usuário logar, mas as rotas que
  dependem de status ativo devolvem 403/404 com mensagem "inativo /
  suspenso".
- `SiscrHttpClient` vê esses erros e redireciona para
  `/subscription-expired`.
