# 📊 Análise de Migrações

## 📋 Resumo

Este documento analisa a estrutura atual de migrações do projeto SISCR.

## 📦 Apps com Migrações

### Contagem de Migrações por App

| App | Migrações | Arquivos |
|-----|-----------|----------|
| `accounts` | 3 | 0001_initial.py, 0002_customrole_modulepermission_and_more.py, 0003_increase_role_max_length.py |
| `cadastros` | 3 | 0001_initial.py, 0002_increase_cpf_cnpj_length.py, 0003_remove_contareceber_cliente_and_more.py |
| `estoque` | 3 | 0001_initial.py, 0002_reservaestoque_previsaomovimentacao.py, 0003_grupofilial.py |
| `faturamento` | 2 | 0001_initial.py, 0002_initial.py |
| `financeiro` | 2 | 0001_initial.py, 0002_initial.py |
| `payments` | 1 | 0001_initial.py |
| `public` | 1 | 0001_initial.py |
| `reports` | 1 | 0001_initial.py |
| `subscriptions` | 3 | 0001_initial.py, 0002_add_pending_status.py, 0003_plan_stripe_price_id_monthly_and_more.py |
| `tenants` | 4 | 0001_initial.py, 0002_tenant_created_at_updated_at.py, 0003_alter_tenant_created_at_alter_tenant_updated_at.py, 0004_tenant_last_backup_at.py |
| `vendas` | 1 | 0001_initial.py |

**Total**: 24 arquivos de migração (sem contar `__init__.py`)

## 🔄 Comandos de Migração Usados

### No `start_dev_windows.bat`:

1. `migrate_schemas --shared --noinput` - Aplica migrações no schema público
2. `fix_subscriptions_migrations` - Corrige colunas faltantes em subscriptions
3. `fix_accounts_migrations` - Corrige colunas faltantes em accounts
4. `fix_tenants_tenant_migrations` - Corrige colunas faltantes em tenants_tenant
5. `sync_tenants_to_public` - Sincroniza tenants dos schemas para a tabela pública
6. `apply_tenant_migrations` - Aplica migrações nos schemas dos tenants
7. `create_tenant_tables` - Cria tabelas tenants_empresa e tenants_filial
8. `fix_tenant_migrations` - Corrige colunas faltantes nos tenants

## 🎯 Objetivo do Squash

Consolidar todas as migrações em uma única migração inicial (`0001_initial.py`) por app, eliminando:

- Migrações intermediárias que apenas adicionam colunas
- Migrações de correção que podem ser incorporadas na inicial
- Complexidade desnecessária no histórico de migrações

## ✅ Benefícios

1. **Simplicidade**: Uma única migração por app é mais fácil de entender
2. **Performance**: Menos migrações para aplicar = mais rápido
3. **Manutenção**: Histórico mais limpo e fácil de manter
4. **Deploy**: Migração única é mais confiável em produção

## ⚠️ Considerações

- **Backup**: Sempre faça backup antes de fazer squash
- **Teste**: Teste em banco limpo após o squash
- **Produção**: Use apenas em desenvolvimento ou antes do primeiro deploy
- **Histórico**: Você perderá o histórico detalhado de mudanças

## 📝 Processo Recomendado

1. **Fazer backup** de todas as migrações
2. **Remover** migrações antigas (exceto `__init__.py`)
3. **Gerar** novas migrações iniciais com `makemigrations`
4. **Testar** em banco limpo
5. **Verificar** que tudo funciona corretamente
6. **Remover** backup se tudo estiver OK

