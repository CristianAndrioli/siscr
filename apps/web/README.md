# SISCR Web — frontend (React + Vite)

Aplicação **React 19** com **TypeScript**, **Vite** e **Tailwind**, implantada em **Cloudflare Pages** a partir de `apps/web`.

## URLs e API

- **Staging (exemplo):** `https://staging.siscr-web.pages.dev/` — o build recebe **`VITE_API_URL`** no CI (`.github/workflows/deploy-staging.yml`).
- Em outra conta Cloudflare, atualize o workflow e o projeto Pages para refletir a nova URL da API.

## Variáveis de ambiente (Vite)

Definidas no **build** (GitHub Actions ou painel Pages). Prefixo obrigatório: `VITE_`.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_URL` | Sim (staging/prod) | URL base do Worker (ex.: `https://siscr-api-staging.xxx.workers.dev`). Usada por `api.ts`, `auth.ts`, signup, etc. |
| `VITE_TENANT_HOST_BASE` | Não | Se alinhada à API (`TENANT_HOST_BASE`), habilita leitura do tenant pelo hostname (`lib/tenantUrl.ts`). |
| `VITE_TENANT_URL_TEMPLATE` | Não | Template com `{slug}` na tela de cadastro (preview). Default conceitual no código. |

Com `VITE_API_URL` definida, **CEP** e **CNAE** podem usar os proxies **`/api/public/cep`** e **`/api/public/cnae`** no mesmo host da API (evita CORS).

## Desenvolvimento local

Na raiz do monorepo:

```bash
pnpm install
pnpm dev:web
```

Crie `apps/web/.env` ou `.env.local`:

```env
VITE_API_URL=http://localhost:8787
```

Para a API: `pnpm dev:api` na raiz (Worker + D1 local via Wrangler, porta típica **8787**).

## Build

```bash
pnpm --filter=@siscr/web run build
```

Saída: `apps/web/dist`. Deploy via workflow do repositório para Cloudflare Pages.

## Documentação

- Monorepo, multi-tenant, deploy, nova conta Cloudflare: **[README na raiz](../../README.md)** e **[`doc/`](../../doc/README.md)**.
