# Mesa de suporte SISCR

Painel interno em `apps/support`, API no Worker existente (`/api/desk` e `/api/support`), tabelas `support_*` no D1 compartilhado.

## URLs

| Ambiente | Desk | API |
|----------|------|-----|
| Dev | http://localhost:5174 | http://localhost:8787 |
| Staging | https://suporte-staging.siscr.com.br | https://api-staging.siscr.com.br |
| Produção | https://suporte.siscr.com.br | https://api.siscr.com.br |

Masters iniciais (troca de senha obrigatória no primeiro login):

- Cristian Andrioli — `cristian.andrioli@siscr.com`
- Lucas Percisi — `lucas.percisi@siscr.com`

## Passos manuais no Cloudflare

O CI cria o projeto Pages `siscr-support` (branch de produção `staging`) se ainda não existir. Estes pontos **só o painel** resolve:

1. **Custom domain de staging** (não criar CNAME no DNS antes):
   - `siscr-support` → Custom domains → Add → `suporte-staging.siscr.com.br`
   - O Cloudflare cria o registro na zona `siscr.com.br`
   - Até lá o desk fica em `https://siscr-support.pages.dev`

2. **Produção** (quando for a hora):
   - Custom domain `suporte.siscr.com.br` no Pages de produção
   - De novo: **não** criar CNAME manual antes

3. **Workers AI:** o binding `AI` vai no `wrangler.toml`. Se o deploy do Worker reclamar, ative Workers AI na conta (Workers → AI).

4. **Durable Objects:** sobem com o Worker; sem tela extra.

5. **E-mail de chamado:** o Worker usa Cloudflare Email Service (`noreply@siscr.com.br`). No painel: **Compute → Email Service → Email Sending → Onboard Domain** em `siscr.com.br`. Não ative **Email Routing** se o MX da zona já for de outro provedor (Gmail etc.).

6. **Opcional:** Cloudflare Access em `suporte*.siscr.com.br` restringindo a e-mails do time.

Não é necessário criar D1, KV, R2 ou Queue novos.

## Dev local

```bash
pnpm install
pnpm dev:api
pnpm dev:support
```

O widget no ERP (`pnpm dev:web`) usa a mesma API.
