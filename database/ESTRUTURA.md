# 📦 Estrutura de Database - Scripts e Seeds

## 📁 Organização

Todos os scripts e seeds relacionados ao banco de dados foram organizados na pasta `database/`:

```
database/
├── migrations/     # (Reservado para futuras migrações customizadas)
├── seeds/          # Scripts de seed de dados
│   ├── seed_tenant_data.py          # Seed para um tenant específico
│   └── seed_multiple_tenants.py      # Seed para múltiplos tenants com dados realistas
└── scripts/       # Scripts auxiliares
    ├── check_subscriptions_data.py   # Verifica se dados de subscriptions existem
    ├── check_tenant_data.py         # Verifica se dados do tenant existem
    ├── create_test_tenant.py        # Cria tenant de teste
    ├── create_migrations_siscr.py   # (Legado) Script para criar migrações
    ├── apply_subscriptions_migrations.bat  # Aplica migrações de subscriptions (Windows)
    ├── apply_subscriptions_migrations.sh  # Aplica migrações de subscriptions (Linux/Mac)
    ├── apply_payments_migrations.bat      # Aplica migrações de payments (Windows)
    └── apply_payments_migrations.sh       # Aplica migrações de payments (Linux/Mac)
```

## 🔄 Migrações

### Status Atual

Todas as migrações antigas foram **deletadas** e **novas migrações foram geradas do zero**.

As migrações agora estão organizadas em:
- `accounts/migrations/0001_initial.py`
- `cadastros/migrations/0001_initial.py`
- `payments/migrations/0001_initial.py`
- `subscriptions/migrations/0001_initial.py`
- `tenants/migrations/0001_initial.py`

### Aplicar Migrações

```bash
# Schema compartilhado
docker-compose exec web python manage.py migrate_schemas --shared

# Todos os schemas (compartilhado + tenants)
docker-compose exec web python manage.py migrate_schemas
```

## 🌱 Seeds

### Seed de Tenant Específico

```bash
docker-compose exec web python database/seeds/seed_tenant_data.py <schema_name>
```

### Seed de Múltiplos Tenants

Cria 3 tenants completos com dados realistas:
- **Comércio Simples**: 1 empresa, 1 filial
- **Grupo Expansão**: 1 empresa, 2 filiais
- **Holding Diversificada**: 2 empresas, 2 filiais cada

```bash
docker-compose exec web python database/seeds/seed_multiple_tenants.py
```

## 🔍 Scripts de Verificação

### Verificar Dados de Subscriptions

```bash
docker-compose exec web python database/scripts/check_subscriptions_data.py
```

Retorna:
- `0` se dados existem
- `1` se dados não existem

### Verificar Dados do Tenant

```bash
docker-compose exec web python database/scripts/check_tenant_data.py <schema_name>
```

Retorna:
- `0` se dados existem
- `1` se dados não existem

## 📝 Notas Importantes

1. **Migrações do Django**: Ficam nos diretórios `*/migrations/` de cada app Django
2. **Scripts auxiliares**: Ficam em `database/scripts/`
3. **Seeds**: Ficam em `database/seeds/`
4. **Pasta `database/migrations/`**: Reservada para futuras migrações customizadas (se necessário)

## 🔄 Atualizações no `start_dev_windows.bat`

O script `start_dev_windows.bat` foi atualizado para usar os novos caminhos:
- `database/scripts/check_subscriptions_data.py`
- `database/seeds/seed_multiple_tenants.py`
- `database/seeds/seed_tenant_data.py`

