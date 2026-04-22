# Padrões de arquitetura — SISCR

Este documento descreve o esqueleto e as convenções de código do
SISCR, focado em **como adicionar funcionalidade de forma que o
próximo dev consiga ler e mexer sem surpresas**. Mudanças no padrão
devem ser discutidas antes de aplicar — a consistência aqui é parte
do que torna o projeto manutenível.

## Big picture

O SISCR é um SaaS ERP multi-tenant hospedado em Cloudflare:

- **Backend** (`apps/api`): Workers + Hono + D1 (SQLite). O runtime é
  um Web Worker, sem filesystem e com limites de CPU/tempo por
  requisição.
- **Frontend** (`apps/web`): React 19 + Vite + Tailwind servido via
  Cloudflare Pages.
- **Pacotes**: `packages/db` (migrações SQL), `packages/shared`
  (tipos compartilhados).
- **Infra adicional**: KV (`KV_SESSIONS`, `KV_TENANT_CACHE`), R2
  (certificados A1 cifrados), Queues e Cron (workers de fundo).

Multi-tenancy é **físico-compartilhado, logicamente isolado**: um
único banco D1, todas as tabelas têm coluna `tenant_id` + índice,
todas as queries filtram por `tenant_id`. A alternativa (um DB por
tenant) não cabe no plano de custos e provisionamento desse
produto.

## Camadas do backend

A separação de camadas é obrigatória para qualquer domínio novo:

```
 HTTP ──►  Middleware  ──►  Route      ──►  Service          ──►  Repository   ──►  D1
          (tenant/auth)    (Hono + Zod)     (regras/OO)          (SQL + bind)
```

Responsabilidades:

### Middleware (`src/middleware/*.ts`)

- Resolver tenant (`tenantMiddleware`): lê `X-Tenant-Slug` / subdomínio
  → `c.set('tenant', { tenantId, slug, ... })`.
- Autenticar (`authMiddleware`): valida Bearer token contra
  `KV_SESSIONS` → `c.set('user', session)`. **Também faz o
  cross-tenant guard** (veja `seguranca.md`).
- Guardas: `requireEmpresaMatriz`, `requireTenantModule`, etc.

Ordem fixa no pipeline (ver `src/index.ts`):
`tenantMiddleware → authMiddleware → requireEmpresaMatriz → requireTenantModule`.

### Route (`src/routes/*.ts`)

O que pode ficar na rota:
- Definição do endpoint (`app.get`, `app.post`, ...).
- Validação Zod via `zValidator('json', schema)`.
- Leitura de `c.get('tenant')`, `c.get('user')`, `c.req.query()`.
- Chamar o service e traduzir exceções em status HTTP.

O que **não** pode:
- SQL cru (`c.env.DB_SHARED.prepare(...)`). Migrar para repo/service.
- Regras de negócio (ex.: "se primeira empresa, apenas admin").
  → Service.
- Manipulação direta de `localStorage` ou KV sem necessidade.

### Service (`src/services/<dominio>/*.ts`)

- Uma classe por agregado (ex.: `EmpresaFilialService`,
  `PessoaService`, `CotacaoService`).
- Recebe repositórios via construtor (**DI manual**). Fácil de
  mockar em teste.
- Orquestra operações que tocam múltiplas tabelas.
- Aplica defaults de domínio (ex.: `codigoPais = '1058'`).
- Converte tipos para o formato que o repo espera
  (ex.: `ativa: boolean` → `ativa: 0|1` antes do INSERT).

Padrão de retorno:
- `create(...)` → devolve `string` (id) ou `{ id, codigo }`.
- `update(...)` → devolve `boolean` (false = patch vazio → caller 400).
- `delete(...)` → `void`.

### Repository (`src/repositories/*.ts`)

- Uma classe por tabela principal (`EmpresaRepository`,
  `PessoaRepository`, `CotacaoRepository`).
- **Herda de `BaseTenantRepository`** — garante que todo SQL filtra
  por `tenant_id` via `prepareTenant()` ou `buildUpdateSet()`.
- Expõe métodos de persistência: `list`, `findById`, `insert`,
  `update`, `delete` + queries específicas do domínio (ex.:
  `getA1ObjectKey`, `nextNumero`).
- **Atualização é sempre whitelisted**: cada repo tem um
  `COLUMN_MAP: Record<keyof UpdateFields, string>` — campos fora do
  mapa são silenciosamente ignorados.

### Factory (`src/services/<dominio>/factory.ts`)

Centraliza a composição service + repositórios para as rotas:

```ts
export function createPessoaService(db, tenantId) {
  return new PessoaService(new PessoaRepository(db, tenantId))
}
```

Isso evita que a rota saiba sobre os repositórios — a dependência é
só para o service.

## Como adicionar um domínio novo

Exemplo: novo domínio "Contratos".

1. **Migração SQL** em `packages/db/migrations/shared/NNNN_*.sql` com
   a tabela + `tenant_id TEXT NOT NULL` + índice em `tenant_id`.
2. **Repository** em `src/repositories/ContratoRepository.ts`
   extendendo `BaseTenantRepository`. Defina `ContratoInsertRow`,
   `ContratoUpdateFields` e `CONTRATO_COLUMN_MAP`.
3. **Service** em `src/services/contratos/ContratoService.ts`.
4. **Factory** em `src/services/contratos/factory.ts`.
5. **Route** em `src/routes/contratos.ts`. Mantenha fina.
6. **Registrar** a rota em `src/index.ts` atrás dos middlewares
   apropriados (geralmente `/api/tenant/contratos`).

Se em algum ponto você sentir vontade de fazer `c.env.DB_SHARED.prepare(...)`
dentro da rota, pare e crie o método no repo. É sempre mais trabalhoso
na primeira vez e muito mais barato nas próximas.

## Frontend

### Services (`apps/web/src/services/`)

- `sessionStore.ts` — **único** lugar que toca `localStorage` para
  sessão. Veja `seguranca.md`.
- `http/SiscrHttpClient.ts` — axios instance com interceptors de
  auth/tenant/erros globais.
- `auth.ts` — wrapper específico de autenticação que depende de
  `sessionStore`.
- `<dominio>Service.ts` — chamadas REST (ex.: `faturamentoService.ts`).

### Formatação (`apps/web/src/utils/`)

- `formatters.ts` é a fonte canônica. Contém `formatCurrency`,
  `formatCPF`, `formatCNPJ`, `formatCEP`, `formatPhone`, `formatDate`
  e aliases `fmtBRL`/`fmtDate`/`fmtDateISO`.
- `format.ts` ficou como thin re-export apenas para compat. Código
  novo deve importar de `./formatters` (ou do barrel `./`).
- `helpers.ts` — `formatApiError(err, fallback?)` é o caminho único
  para extrair mensagens de erro. Use `catch (err: unknown)`.

### Regra de ouro

Nenhum componente React acessa `localStorage` para sessão. Nenhum
`catch (err: any)`. Nenhuma duplicação de formatador.

## Migrações SQL

- Vivem em `packages/db/migrations/shared/NNNN_descricao.sql`.
- São incrementais e **apenas forward** (não existe `down`).
- `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` para
  idempotência em D1.
- Nunca editar migração já aplicada — criar nova.

## Testes (futuro)

Ainda não há suite consolidada. Convenções quando existirem:

- `*.test.ts` ao lado do arquivo testado.
- Repositórios testam contra D1 in-memory (via `better-sqlite3`).
- Services testam com repositórios mockados — é fácil por causa da
  DI no construtor.

## O que ainda vive em camada errada

- `src/routes/faturamento.ts` ainda tem NFe/NFSe direto na rota
  (SEFAZ é externa + muitas regras). Está na lista para extrair em
  `NfeService`/`NfseService` em outra iteração.
- Algumas páginas React acessam `localStorage` direto
  (`Layout.tsx`, `Perfil.tsx`, `AppHome.tsx`). Plano é migrar ao
  `sessionStore`.

Se você encontrar outro ponto que quebra o padrão, abra uma nota
aqui com **arquivo + o que está fora + que camada deveria ir**.
