# SISCR Web — frontend (React + Vite)

Aplicação **React 19** com **TypeScript**, **Vite** e **Tailwind**, implantada em **Cloudflare Pages** a partir do diretório `apps/web`.

## Staging

- **URL pública:** [https://staging.siscr-web.pages.dev/](https://staging.siscr-web.pages.dev/)
- A API de staging é definida no build via variável **`VITE_API_URL`** (no CI aponta para o Worker `siscr-api-staging` — ver `.github/workflows/deploy-staging.yml`).

## Desenvolvimento local

Na raiz do monorepo:

```bash
pnpm install
pnpm dev:web
```

Por padrão o Vite sobe em `http://localhost:5173`. Crie `apps/web/.env` (ou `.env.local`) se precisar:

```env
VITE_API_URL=http://localhost:8787
```

Para subir a API localmente, use na raiz `pnpm dev:api` (Worker com D1 local via Wrangler).

## Build de produção / Pages

```bash
pnpm --filter=@siscr/web run build
```

O artefato fica em `apps/web/dist`. O deploy para Cloudflare Pages é feito pelo workflow do repositório (não é necessário Docker).

## Documentação do monorepo

Arquitetura completa, banco **D1 compartilhado**, multi-tenant, migrações e deploy: **[README.md na raiz do repositório](../../README.md)**.
