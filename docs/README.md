# 📚 Documentação do Projeto SISCR

Bem-vindo à documentação completa do SISCR. Esta documentação está organizada por categorias para facilitar a navegação.

## 📖 Índice

### 🚀 [Getting Started](./getting-started/)
Guia de início rápido e configuração inicial do projeto.

- [Setup de Desenvolvimento](./getting-started/SETUP_DEVELOPMENT.md)
- [Configurar Stripe Rápido](./getting-started/CONFIGURAR_STRIPE_RAPIDO.md)
- [Instalar Stripe CLI (Windows)](./getting-started/INSTALAR_STRIPE_CLI_WINDOWS.md)
- [Variáveis de Ambiente](./getting-started/VARIAVEIS_AMBIENTE.md)
- [Instruções de Login](./getting-started/INSTRUCOES_LOGIN.md)

### 🏗️ [Arquitetura](./architecture/)
Documentação sobre arquitetura, design e decisões técnicas.

- [Análise de Arquitetura](./architecture/ANALISE_ARQUITETURA.md)
- [Análise de Estrutura do Projeto](./architecture/ANALISE_ESTRUTURA_PROJETO.md)
- [Arquitetura Frontend](./architecture/ARQUITETURA_FRONTEND.md)
- [Arquitetura de Interfaces](./architecture/ARQUITETURA_INTERFACES.md)
- [Arquitetura de Produção](./architecture/ARQUITETURA_PRODUCAO.md)
- [Modelos Base](./architecture/MODELOS_BASE.md)
- [ORM Django](./architecture/ORM_DJANGO.md)

### 📘 [Guias](./guides/)
Guias detalhados sobre funcionalidades específicas.

- [Criar Tenant Manualmente](./guides/GUIA_CRIAR_TENANT_MANUAL.md)
- [Guia de Testes Manual](./guides/GUIA_TESTES_MANUAL.md)
- [Guia DBeaver](./guides/GUIA_DBEAVER.md)
- [Comandos PostgreSQL](./guides/COMANDOS_POSTGRESQL.md)
- [Comandos PostgreSQL Rápido](./guides/COMANDOS_POSTGRESQL_RAPIDO.md)
- [Grid Auto Columns](./guides/GRID_AUTO_COLUMNS.md)
- [URLs Públicas e Tenant](./guides/URLS_PUBLICAS_TENANT.md)
- [Middleware de Quotas](./guides/MIDDLEWARE_QUOTAS.md)
- [Rate Limiting](./guides/RATE_LIMITING.md)

### 💳 [Pagamentos](./payments/)
Documentação completa sobre integração com Stripe e pagamentos.

- [Setup do Stripe](./payments/SETUP_STRIPE.md)
- [Integração Completa do Stripe](./payments/STRIPE_INTEGRACAO_COMPLETA.md)
- [Progresso do Stripe](./payments/STRIPE_PROGRESSO.md)
- [Possibilidades de Integração Stripe](./payments/STRIPE_POSSIBILIDADES_INTEGRACAO.md)
- [Webhooks do Stripe](./payments/WEBHOOKS_STRIPE.md)
- [Webhooks Localhost](./payments/WEBHOOKS_LOCALHOST.md)
- [Diagnóstico de Webhook](./payments/DIAGNOSTICO_WEBHOOK.md)
- [Frontend Checkout](./payments/FRONTEND_CHECKOUT.md)
- [Troubleshooting Checkout](./payments/TROUBLESHOOTING_CHECKOUT.md)
- [Sincronização de Preços Stripe](./payments/SINCRONIZACAO_PRECOS_STRIPE.md)
- [Como Funcionam Planos e Preços](./payments/COMO_FUNCIONAM_PLANOS_E_PRECOS.md)
- [Modelo de Precificação](./payments/MODELO_PRECIFICACAO.md)
- [Calculadora de Preços](./payments/CALCULADORA_PRECOS.md)
- [Melhorias de Pagamento Pendente](./payments/MELHORIAS_PAGAMENTO_PENDENTE.md)

### 🧪 [Testes](./testing/)
Documentação sobre testes e validações.

- [Testes](./testing/TESTES.md)
- [Testes Fase 2](./testing/TESTES_FASE_2.md)
- [Teste de Cadastro Público](./testing/TESTE_CADASTRO_PUBLICO.md)
- [Teste de Login Multi-tenant](./testing/TESTE_LOGIN_MULTITENANT.md)
- [Teste de Página Signup](./testing/TESTE_PAGINA_SIGNUP.md)
- [Teste de Recuperação de Senha](./testing/TESTE_RECUPERACAO_SENHA.md)
- [Teste de Subscriptions](./testing/TESTE_SUBSCRIPTIONS.md)

### 🚢 [Deploy e Infraestrutura](./deployment/)
Documentação sobre deploy, produção e infraestrutura.

- [Terraform Setup](./deployment/TERRAFORM_SETUP.md)
- [Hospedagem Cloud](./deployment/HOSPEDAGEM_CLOUD.md)
- [CI/CD Roadmap](./deployment/CI_CD_ROADMAP.md)
- [Aplicar Migrations Payments](./deployment/APLICAR_MIGRATIONS_PAYMENTS.md)
- [Aplicar Migrations Subscriptions](./deployment/APLICAR_MIGRATIONS_SUBSCRIPTIONS.md)

### 🔍 [Observabilidade](./observability/)
Monitoramento, métricas e observabilidade do sistema.

- [Observabilidade](./observability/OBSERVABILIDADE.md)
- [Observabilidade Simples](./observability/OBSERVABILIDADE_SIMPLES.md)
- [Guia Rápido de Observabilidade](./observability/OBSERVABILIDADE_GUIA_RAPIDO.md)
- [Dashboard de Observabilidade](./observability/OBSERVABILIDADE_DASHBOARD.md)
- [Melhorias de Observabilidade](./observability/OBSERVABILIDADE_MELHORIAS.md)
- [Próximos Passos de Observabilidade](./observability/OBSERVABILIDADE_PROXIMOS_PASSOS.md)

### 🛠️ [Desenvolvimento](./development/)
Documentação sobre desenvolvimento, migrações e progresso.

- [Migração React](./development/MIGRACAO_REACT.md)
- [Estratégia de Migração](./development/ESTRATEGIA_MIGRACAO.md)
- [Checklist de Migração](./development/CHECKLIST_MIGRACAO.md)
- [Progresso de Reorganização](./development/PROGRESSO_REORGANIZACAO.md)
- [Plano de Reorganização](./development/PLANO_REORGANIZACAO.md)
- [Próximo Passo](./development/PROXIMO_PASSO.md)
- [Melhorias Aplicadas](./development/MELHORIAS_APLICADAS.md)
- [Limpeza do Projeto](./development/LIMPEZA_PROJETO.md)
- [Páginas Não Migradas](./development/PAGINAS_NAO_MIGRADAS.md)

### 📊 [Análises e Planos](./analysis/)
Análises técnicas, comparações e planos de evolução.

- [Análise de Migração .NET](./analysis/ANALISE_MIGRACAO_DOTNET.md)
- [Resumo Comparativo Django vs .NET](./analysis/RESUMO_COMPARATIVO_DJANGO_DOTNET.md)
- [Análise de Gateways de Pagamento](./analysis/ANALISE_GATEWAYS_PAGAMENTO.md)
- [Análise de Publicação](./analysis/ANALISE_PUBLICACAO.md)
- [Plano de Evolução](./analysis/PLANO_EVOLUCAO.md)
- [Roadmap SaaS](./analysis/ROADMAP_SAAS.md)
- [Plano SaaS Completo](./analysis/PLANO_SAAS_COMPLETO.md)
- [Resumo de Implementação SaaS](./analysis/RESUMO_IMPLEMENTACAO_SAAS.md)
- [Resumo de Perguntas SaaS](./analysis/RESUMO_SAAS_PERGUNTAS.md)
- [Implementação SaaS Técnica](./analysis/IMPLEMENTACAO_SAAS_TECNICA.md)
- [Estratégia de Separação de Filiais](./analysis/ESTRATEGIA_SEPARACAO_FILIAIS.md)
- [Implementação de Separação de Filiais](./analysis/IMPLEMENTACAO_SEPARACAO_FILIAIS.md)
- [Melhorias sem Infraestrutura](./analysis/MELHORIAS_SEM_INFRAESTRUTURA.md)
- [Bibliotecas Fiscais Open Source](./analysis/BIBLIOTECAS_FISCAIS_OPEN_SOURCE.md)
- [Estudo de Estoque Multi-Tenant](./analysis/ESTUDO_ESTOQUE_MULTITENANT.md)

### 🔧 [SaaS e Multi-tenant](./saas/)
Documentação sobre funcionalidades SaaS e multi-tenant.

- [Admin Tenant - Gerenciamento](./saas/ADMIN_TENANT_GERENCIAMENTO.md)
- [Admin Tenant - Permissões](./saas/ADMIN_TENANT_PERMISSOES.md)
- [Celery Renovação Automática](./saas/CELERY_RENOVACAO_AUTOMATICA.md)
- [Seed Data](./saas/SEED_DATA.md)
- [Seed Multiple Tenants](./saas/SEED_MULTIPLE_TENANTS.md)

### 🐛 [Troubleshooting](./troubleshooting/)
Solução de problemas e diagnóstico.

- [Troubleshooting Docker](./troubleshooting/TROUBLESHOOTING_DOCKER.md)

### 📡 [API](./api/)
Documentação da API REST.

- [Documentação da API](./api/API_DOCUMENTATION.md)

---

## 🔍 Busca Rápida

### Por Funcionalidade

- **Stripe/Pagamentos**: Veja [Pagamentos](./payments/)
- **Testes**: Veja [Testes](./testing/)
- **Deploy**: Veja [Deploy e Infraestrutura](./deployment/)
- **Arquitetura**: Veja [Arquitetura](./architecture/)
- **Setup Inicial**: Veja [Getting Started](./getting-started/)

### Por Tipo de Documento

- **Guias Passo a Passo**: [Guias](./guides/)
- **Análises Técnicas**: [Análises e Planos](./analysis/)
- **Solução de Problemas**: [Troubleshooting](./troubleshooting/)
- **Monitoramento**: [Observabilidade](./observability/)

---

## 📝 Contribuindo

Ao adicionar nova documentação:

1. Coloque o arquivo na pasta apropriada
2. Atualize este README.md com o link
3. Use nomes descritivos e consistentes
4. Adicione um resumo no início do documento

---

*Última atualização: {{ data_atual }}*

