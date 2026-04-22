# Segurança — SISCR

Este documento reúne as **decisões e garantias de segurança** do
SISCR. Leia antes de mexer em autenticação, senhas, webhooks ou
qualquer fluxo que toque `tenant_id`.

## 1. Isolamento entre tenants

Modelo: **shared DB + coluna `tenant_id`**.

Garantias que precisam ser mantidas:

1. **Todo SQL filtra por `tenant_id`**. A convenção é usar
   `BaseTenantRepository.prepareTenant()` que já põe o `tenant_id`
   como último parâmetro do `.bind(...)`. Joins também precisam:
   `LEFT JOIN pessoas p ON p.id = x.pessoa_id AND p.tenant_id = x.tenant_id`.
2. **Repositórios recebem `tenantId` por construtor** — nunca via
   body/querystring. O `tenantId` vem SEMPRE de `c.get('tenant')`,
   que é resolvido pelo `tenantMiddleware`.
3. **Cross-tenant guard no `authMiddleware`**: após carregar a
   sessão, comparamos `sessionData.tenantId` com o tenant resolvido
   pelo middleware de tenant. Se diferir → HTTP 403 com
   `code: TENANT_MISMATCH`.

   Sem esse guard, um usuário logado no tenant A poderia enviar
   `X-Tenant-Slug: tenantB` e ler/escrever dados do tenant B,
   porque as rotas filtram por `c.get('tenant')` e a sessão não era
   re-inspecionada depois do login.

Checklist ao adicionar nova rota:

- [ ] Middleware `auth` + `tenant` configurados?
- [ ] Service/repo constrói `XRepository(db, tenant.tenantId)`?
- [ ] SQL tem `... AND tenant_id = ?` (ou usa `prepareTenant`)?
- [ ] Joins com outras tabelas de tenant casam `tenant_id`?

## 2. Senhas

### Formato canônico

```
pbkdf2$<iterations>$<saltHex>$<hashHex>
```

Implementado em `apps/api/src/lib/password.ts` como classe
`PasswordHasher`:

- **Algoritmo**: PBKDF2-SHA256.
- **Iterações**: 600_000 (OWASP 2023).
- **Salt**: 16 bytes aleatórios por senha.
- **Comparação**: timing-safe (`constantTimeEqual`).

Métodos:

- `PasswordHasher.hash(plain)` → string canônica.
- `PasswordHasher.verify(plain, stored)` → boolean. Aceita tanto o
  novo formato quanto os dois legados (`saltHex:hashHex` com 100k
  iterações e SHA-256 puro de quando era prototype).
- `PasswordHasher.needsRehash(stored)` → `true` para formatos
  legados.

### Rehash transparente

`routes/auth.ts` no login: após `verify()` retornar `true`, se
`needsRehash()` também for `true`, rehash silencioso em background
(try/catch que só loga erro). Isso migra usuários antigos sem
forçar troca de senha.

### Nunca persistir plaintext

Fluxo de signup com Stripe:

1. Frontend envia `{ email, password, ... }` para
   `POST /subscriptions/checkout`.
2. **O handler faz `PasswordHasher.hash(password)` ANTES** de
   persistir o payload pendente no KV (`pending_signup:<slug>`).
3. O KV armazena `passwordHash`, nunca a senha.
4. Quando o webhook Stripe confirma o pagamento, o hash é
   transferido direto para a tabela `users`.

O antigo fluxo que gravava plaintext em KV foi eliminado —
`subscriptions.ts` usa `zValidator` + `pendingSignupSchema` para
garantir schema, e `stripe-webhook.ts` valida o mesmo schema ao ler.

## 3. Webhooks Stripe

Implementado em:

- `lib/stripe/StripeWebhookVerifier.ts` — verifica assinatura.
- `lib/stripe/StripeEventIdempotency.ts` — evita processar 2x.

### Assinatura

- Parseia `stripe-signature` (`t=<ts>,v1=<sig>,v1=<sig>,...`) —
  múltiplos `v1=` são suportados (rotação de secret).
- Calcula HMAC-SHA256 de `<ts>.<rawBody>` usando o
  `STRIPE_WEBHOOK_SECRET`.
- Compara em **tempo constante** (timing-safe).
- **Replay window de 5 min**: `|now - ts| > 300s` → rejeita. Sem
  isso, um ataque MITM capturando um webhook poderia reentregá-lo
  horas depois.

### Idempotência

Tabela `stripe_events` (migração 0030):

```sql
CREATE TABLE stripe_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime(...))
);
```

Fluxo:

1. `claim(eventId, eventType)` faz `INSERT` com PK — se colidiu, é
   duplicata e handler retorna 200 com `duplicate: true` (Stripe
   acha que foi aceito, para de reentregar).
2. Dispatch do handler.
3. Se o handler joga, **desfaz o claim** (`DELETE WHERE event_id =
   ?`) para que a próxima entrega possa tentar de novo. Caso
   contrário, falha transiente bloquearia o evento pra sempre.

## 4. Tokens de sessão

- Gerados no login/signup/auto-login como UUID opaco.
- Armazenados em `KV_SESSIONS` com TTL de 7 dias.
- Enviados pelo frontend via `Authorization: Bearer <token>`.
- Validados em cada request no `authMiddleware`.

### Frontend — onde a sessão mora

Hoje: `localStorage` (chaves `access_token`, `tenant_slug`,
`tenant_status`, `user`, `user_nome`).

Acesso é feito **apenas** via `sessionStore` em
`apps/web/src/services/sessionStore.ts`. `auth.ts` e
`SiscrHttpClient.ts` dependem apenas dessa interface. Nenhum
componente React novo deve ler `localStorage` para auth — use o
`sessionStore`.

### Plano para HttpOnly cookies

Documentado inline no `sessionStore.ts`. Resumo:

1. Backend `Set-Cookie: siscr_session=<token>; HttpOnly; Secure;
   SameSite=Strict; Path=/; Max-Age=604800` no login/auto-login.
2. Backend aceita token via cookie OU Authorization header (compat
   transitório), prefere cookie.
3. Frontend usa `withCredentials: true` no axios;
   `sessionStore.getToken()` passa a ser stub ou retorna flag
   não-sensível.
4. CORS: `Allow-Credentials: true` + origem explícita.

Até lá, a recomendação é **não deixar nenhum `<script>` de
terceiros executar na mesma origem** (CSP agressivo). Se precisar
CDN para JS, gerenciar SRI.

## 5. Certificados A1 (.pfx/.p12)

- Armazenados em R2, cifrados com AES-GCM via `CERT_BLOB_SECRET`
  (secret do Worker).
- `tenant_id` + `empresa_id`/`filial_id` entram como AAD (additional
  authenticated data) na cifra — impossível reaproveitar blob de
  outro tenant mesmo com acesso a R2.
- Só `role = 'admin'` pode enviar ou atualizar certificado.
- Metadados públicos (CN, issuer, validade) são extraídos e salvos
  em D1 para listagem sem descifrar.
- Decifração só ocorre no momento de emitir NFe.

## 6. Audit trail

Todas as tabelas principais têm `created_by` e `updated_by` com o
`userId` de quem executou a operação (via helper `auditUserId(c)`).
Isso é feito automaticamente pelos repositórios — não precisa ser
preocupação do caller.

Logs de erro do worker vão para `console.error` e podem ser
plugados em Logpush/Sentry. **Não logar** PII (email, nome, slug)
em nível `info`. O `stripe-webhook.ts` já foi auditado para remover
PII dos logs.

## 7. O que ainda não está coberto

- **Rate limiting**: sem limite no login (só a UI faz debounce).
  Pode ser atacado por brute force → TODO plugar Cloudflare Rate
  Limiting rules ou Durable Object.
- **CSP**: headers de segurança HTTP não estão configurados.
- **MFA**: não implementado. Roadmap.
- **Lockout após N tentativas**: não implementado.
- **Rotação automática de `CERT_BLOB_SECRET`** e rechaveamento dos
  blobs: processo manual hoje.

Se você chegou aqui depois de descobrir algo, adicione ao
roadmap em vez de consertar sozinho — várias dessas decisões
impactam o produto inteiro.
