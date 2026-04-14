# Documentação SISCR

Índice dos tópicos mantidos nesta pasta. O **README na raiz do repositório** continua sendo o ponto de entrada geral (stack, estrutura, deploy).

| Documento | Conteúdo |
|-----------|----------|
| [tenant-e-dominios.md](./tenant-e-dominios.md) | Multi-tenant na URL: `?tenant=`, subdomínio real, variáveis `TENANT_HOST_BASE` / `VITE_TENANT_HOST_BASE`, limitações do `*.pages.dev`. |
| [cloudflare-nova-conta-e-dependencias.md](./cloudflare-nova-conta-e-dependencias.md) | Checklist para instanciar o projeto em **outra conta Cloudflare** (ou clonar ambiente): recursos, IDs, secrets, CI, Stripe, DNS. |

Atualize estes arquivos quando alterar fluxos de autenticação, domínio ou infraestrutura.
