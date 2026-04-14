# Tenant, URL e domínios

Este documento descreve como o **identificador do tenant** (slug) aparece na barra de endereço e como habilitar **subdomínio por cliente** em produção.

## Conceitos

- Cada cliente (grupo empresa) tem um **`slug` único** na tabela `tenants` (ex.: `lpsoftware`).
- A API resolve o tenant atual por, nesta ordem de prioridade (`apps/api/src/middleware/tenant.ts`):
  1. Header **`X-Tenant-Slug`** (o frontend envia a partir do `localStorage` após login).
  2. Sessão no **Bearer token** (KV: `session:{token}` contém `tenantSlug`).
  3. Se **`TENANT_HOST_BASE`** estiver definido no Worker: host **`{slug}.{TENANT_HOST_BASE}`** (ex.: `lpsoftware.app.suaempresa.com.br`).

## Staging em `*.pages.dev` (ex.: `staging.siscr-web.pages.dev`)

No Cloudflare Pages, o host público do projeto é **fixo** (nome do projeto + `pages.dev`). **Não há**, por padrão, um hostname por tenant do tipo `lpsoftware.staging.projeto.pages.dev` configurado como wildcard multi-tenant.

Por isso, após login ou cadastro, a aplicação usa:

- **`https://…/app?tenant=<slug>`** — o parâmetro permanece visível na URL e é sincronizado com `localStorage` (`TenantUrlSync`).
- O slug também aparece na UI (ex.: `@slug` na barra lateral).

Isso **não substitui** um subdomínio DNS real; é o modo suportado no host único de staging.

## Produção: subdomínio `https://<slug>.<base>/...`

Para URLs no estilo **`lpsoftware.app.suaempresa.com.br`**:

1. **Domínio** que você controla (ex.: `suaempresa.com.br`).
2. **DNS na Cloudflare** (ou outro provedor) com registro **wildcard** apontando para o **Cloudflare Pages** do front, conforme a [documentação de domínios customizados do Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/) (ex.: `*.app.suaempresa.com.br` → projeto Pages).
3. Variáveis alinhadas entre API e front:
   - **Worker** (`wrangler.toml` ou painel): `TENANT_HOST_BASE=app.suaempresa.com.br` (sem `https://`, sem path).
   - **Build do front** (CI ou `.env`): `VITE_TENANT_HOST_BASE=app.suaempresa.com.br` (mesmo valor).
4. **`ALLOWED_ORIGINS`** no Worker deve incluir a origem “apex” do app **e** a API já amplia CORS para origens `https://*.{TENANT_HOST_BASE}` quando essa variável está setada (`apps/api/src/index.ts`).
5. **`FRONTEND_URL`** deve refletir a URL canônica do app (apex ou primeira entrada), usada em redirects do Stripe e e-mails.

### Limitação: sessão e mudança de origem

O token de sessão hoje fica no **`localStorage`** do navegador, que é **por origem**.  
Redirecionar o usuário de `https://app.suaempresa.com` para `https://slug.app.suaempresa.com` **sem** novo login exige, em geral:

- **Cookie** de sessão com `Domain=.app.suaempresa.com.br`, ou  
- **Endpoint de troca** de token (one-time code na query),  

o que ainda não faz parte do fluxo padrão descrito aqui. Enquanto isso, login e uso contínuo no **mesmo host** (com `?tenant=` ou subdomínio desde o primeiro carregamento) evitam o problema.

## Variáveis relacionadas (frontend)

| Variável | Função |
|----------|--------|
| `VITE_API_URL` | URL base da API (Worker). Obrigatória no build de staging/produção. |
| `VITE_TENANT_HOST_BASE` | Opcional. Quando definida, habilita leitura do slug pelo **hostname** (`tenantUrl.ts`) e futuros redirects para `https://{slug}.{base}/...`. |
| `VITE_TENANT_URL_TEMPLATE` | Opcional. Template com `{slug}` na tela de cadastro (preview da URL). Default conceitual: `https://{slug}.seudominio.com`. |

## API pública auxiliar (CEP / CNAE)

O Worker expõe proxies sem autenticação (`apps/api/src/routes/publicLookup.ts`):

- `GET /api/public/cep/:cep` — ViaCEP (JSON bruto).
- `GET /api/public/cnae/:codigo` — IBGE CNAE subclasse (7 dígitos).

O front usa esses endpoints quando `VITE_API_URL` está definida, para reduzir problemas de CORS no navegador (`brasilCepIbge.ts`, `cnaeIbge.ts`).

## Referências no código

- Middleware de tenant: `apps/api/src/middleware/tenant.ts`
- CORS dinâmico + `TENANT_HOST_BASE`: `apps/api/src/index.ts`
- Sincronização URL ↔ `localStorage`: `apps/web/src/components/TenantUrlSync.tsx`
- Helpers de host: `apps/web/src/lib/tenantUrl.ts`
