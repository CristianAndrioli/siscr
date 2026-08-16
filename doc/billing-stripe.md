# Cobrança Stripe — planos, bloqueio e produção

Fonte da verdade **de dinheiro**: Prices no Stripe (lookup keys).  
Fonte da verdade **de limites** (empresas, filiais, usuários, notas, e-mails): tabela `plans` no D1.

A tela de planos **não** chama o Stripe no browser. O Worker lê os Prices (chave secreta) e devolve os valores em `GET /api/subscriptions/plans`. Home, `/plans`, signup, checkout e assinatura usam essa API.

## Ambientes

| | Staging (test mode) | Produção (live mode) |
|--|---------------------|----------------------|
| Conta Stripe | sandbox `acct_1Sf49aJcxPm9Lx7v` | **outra** chave `sk_live_…` (repetir o catálogo) |
| Frontend | `https://staging.siscr.com.br` | `https://app.siscr.com.br` |
| API | `https://api-staging.siscr.com.br` | `https://api.siscr.com.br` |
| Webhook | `https://api-staging.siscr.com.br/api/webhooks/stripe` | `https://api.siscr.com.br/api/webhooks/stripe` |
| Secrets Wrangler | `--env staging` | `--env production` |

Test mode e live mode **não compartilham** produtos, preços nem webhook secret. Catálogo de sandbox não vale em produção.

## Planos comerciais (limites no D1)

Valores de lista atuais (impostos inclusos). A UI mostra o `unit_amount` do Stripe; se o Stripe estiver fora, cai no D1.

| Plano | Mensal | Anual (10 meses) | Empresas | Filiais | Usuários | Docs fiscais/mês | E-mails/mês |
|-------|--------|------------------|----------|---------|----------|------------------|-------------|
| Free | R$ 0 | — | 1 | 1 | 2 | 0 | 50 |
| Básico | R$ 129 | R$ 1.290 | 1 | 2 | 5 | 50 | 300 |
| Pro | R$ 249 | R$ 2.490 | 1 | 5 | 10 | 200 | 1.000 |
| Enterprise | R$ 497 | R$ 4.970 | 3 | 15 | 25 | 1.000 | 5.000 |

- **1 assinatura por tenant.** Não é licença por usuário (Salesforce).
- Free = demo sem cartão e **sem NF-e/NFS-e**.
- Trial de **14 dias** no Checkout dos planos pagos (`subscription_data[trial_period_days]=14`).
- Checkout self-serve cobra o Price **mensal**. Anual entra pelo Customer Portal (quando a troca de plano estiver ligada).
- Acima do Enterprise: cotação, não self-serve.

Lookup keys (iguais em test e, quando repetir o catálogo, em live):

| Plano | Mensal | Anual |
|-------|--------|-------|
| Básico | `siscr_basico_month` | `siscr_basico_year` |
| Pro | `siscr_pro_month` | `siscr_pro_year` |
| Enterprise | `siscr_enterprise_month` | `siscr_enterprise_year` |

IDs de Price **sandbox** (mensal), fallback nos secrets:

- `STRIPE_PRICE_BASICO=price_1U59stJcxPm9Lx7vQkyftcVw`
- `STRIPE_PRICE_PRO=price_1U59swJcxPm9Lx7vDOkPmykQ`
- `STRIPE_PRICE_ENTERPRISE=price_1U59t0JcxPm9Lx7v0ADoOFfH`

## Como a tela acompanha o Stripe

1. `GET /api/subscriptions/plans` lista o D1 (limites + características).
2. O Worker busca Prices ativos por lookup key (`apps/api/src/lib/stripe/planCatalog.ts`).
3. Resultado fica **5 minutos** no KV (`stripe:plan_catalog:v1`).
4. Checkout e troca de plano usam o **Price ID ativo** desse catálogo (não um valor hardcoded no React).

**O Price no Stripe não muda de valor.** Para “atualizar o preço”:

1. Crie um Price novo (mesmo produto, mesmo lookup key — tire o lookup do Price velho, coloque no novo).
2. Arquive o Price antigo.
3. Espere até 5 min (ou faça um request depois do TTL).
4. **Não precisa** redeploy do frontend. Se o checkout ainda apontar para o ID velho nos secrets, o lookup key ganha; ainda assim atualize `STRIPE_PRICE_*` no Wrangler para o fallback bater com o catálogo.

Não dê a secret key ao Pages. A UI só fala com a API.

## Acesso: pagou usa; não pagou para

| Status Stripe | Tenant no D1 | ERP |
|---------------|--------------|-----|
| `active` / `trialing` | `active` | Liberado |
| `past_due` | `suspended` | Bloqueado (billing-only) |
| `unpaid` / `canceled` / `paused` / `incomplete_expired` | `suspended` | Bloqueado |

Login de tenant suspenso emite sessão **billing-only** (24h) e manda para `/subscription-expired`. Portal: `POST /api/subscriptions/reactivation-portal`. `invoice.paid` reativa.

Upgrade **não** abre segundo Checkout `mode=subscription` se já existe assinatura: Subscription Update + proration (fallback: portal).

Cron `0 3 * * *` só **reconcilia** Stripe × `tenants.status`. Quem cobra é o Stripe Billing.

Cota NF-e + NFS-e somada por plano: `apps/api/src/lib/fiscalDocQuota.ts`.

## Dashboard (test e live, ~10 min)

1. [Customer Portal](https://dashboard.stripe.com/test/settings/billing/portal) (live: tire `/test`): ligar **Customers can switch plans** nos 3 produtos (mensal e anual), proration on. Quantity **off**. Pause **off**. Cancelar **no fim do ciclo**. Redirect fallback: `https://staging.siscr.com.br/subscription-management` (prod: `https://app.siscr.com.br/subscription-management`).
2. Smart Retries: 8 tentativas / 14 dias.
3. E-mails: ligar **Send emails when card payments fail** (e, de preferência, cartão expirando + fim de trial).
4. Se as retries falharem: **cancel the subscription** (não deixar `unpaid` eterno).
5. Formas de pagamento no Dashboard (cartão; boleto se quiser; PIX invite-only no BR). **Não** hardcodar `payment_method_types` no Worker.
6. **Não ligar Stripe Tax** — ISS sai na NFS-e da empresa SISCR (no início, emitir manualmente após `invoice.paid`).

## Enforcement no código

| Recurso | Onde barra | Observação |
|---------|------------|------------|
| Empresas | `POST /api/tenant/info/empresas` | `checkCanCreateEmpresa` |
| Filiais | `POST .../empresas/:id/filiais` | `checkCanCreateFilial` |
| Usuários | `POST /usuarios` e reativar (`PUT` `ativo: true`) | conta só `ativo = 1` |
| NF-e / NFS-e | transmitir nota (`assertFiscalDocQuotaAvailable`) | Free = 0; soma NF-e + NFS-e no mês |
| E-mail | teto anti-abuso após o send (ticket/boas-vindas) | **não** barra reset de senha nem verificação de e-mail |

Uso aparece em `/subscription-management`.

## Checklist produção

1. Live mode: recriar os 3 produtos + 6 Prices com os **mesmos lookup keys**, BRL, imposto incluso, `licensed`.
2. `wrangler secret put` em `--env production`: `STRIPE_SECRET_KEY` (`sk_live_`), `STRIPE_WEBHOOK_SECRET` do endpoint live, `STRIPE_PRICE_*` dos IDs **live**.
3. Webhook live → `https://api.siscr.com.br/api/webhooks/stripe` com os mesmos eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. Repetir o Dashboard (portal, retries, e-mails, cancelar após retries) **no live**.
5. Migration D1 de produção (`0061_planos_comerciais.sql` e anteriores) **antes** do Worker novo.
6. Teste: 1 pagamento real pequeno ou cartão live controlado; falha → lock → portal → unlock.
7. Só então apontar o frontend de produção (`VITE_API_URL=https://api.siscr.com.br`).

Código: `apps/api/src/lib/stripe/`, `apps/api/src/routes/stripe-webhook.ts`, `apps/api/src/routes/subscriptions.ts`. Telas: `Home.tsx`, `Plans.tsx`, `Signup.tsx`, `Checkout.tsx`, `SubscriptionManagement.tsx`, `SubscriptionExpired.tsx`.
