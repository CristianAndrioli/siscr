# Documentação SISCR

Índice dos tópicos mantidos nesta pasta. O **README na raiz do repositório** continua sendo o ponto de entrada geral (stack, estrutura, deploy).

| Documento | Conteúdo |
|-----------|----------|
| [tenant-e-dominios.md](./tenant-e-dominios.md) | Multi-tenant na URL: `?tenant=`, subdomínio real, variáveis `TENANT_HOST_BASE` / `VITE_TENANT_HOST_BASE`, limitações do `*.pages.dev`. |
| [cloudflare-nova-conta-e-dependencias.md](./cloudflare-nova-conta-e-dependencias.md) | Checklist para instanciar o projeto em **outra conta Cloudflare** (ou clonar ambiente): recursos, IDs, secrets, CI, Stripe, DNS. |
| [dominios-ambientes-e-deploy.md](./dominios-ambientes-e-deploy.md) | Domínios, ambientes (staging/produção) e fluxo de deploy. |
| [multi-tenant.md](./multi-tenant.md) | Arquitetura multi-tenant do sistema. |
| [padroes-arquitetura.md](./padroes-arquitetura.md) | Padrões de arquitetura adotados no projeto. |
| [seguranca.md](./seguranca.md) | Práticas e requisitos de segurança. |
| [plano-contabilidade-fiscal.md](./plano-contabilidade-fiscal.md) | Plano do módulo de contabilidade e obrigações fiscais. |
| [integracoes-contabilidade.md](./integracoes-contabilidade.md) | Integração com escritórios contábeis: exportação ZIP, Distribuição DFe, APIs Domínio/Alterdata e o modelo de Conexões (named credentials). |
| [redesign-frontend.mmd](./redesign-frontend.mmd) | Plano técnico do redesign do frontend (design system, componentes, páginas, responsividade). |

Atualize estes arquivos quando alterar fluxos de autenticação, domínio ou infraestrutura.
