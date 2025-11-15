# 📦 Database - Scripts e Seeds

Esta pasta contém todos os scripts e seeds relacionados ao banco de dados.

## 📁 Estrutura

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

## 🚀 Como Usar

### Seeds

#### Seed de Tenant Específico
```bash
docker-compose exec web python database/seeds/seed_tenant_data.py <schema_name>
```

#### Seed de Múltiplos Tenants
```bash
docker-compose exec web python database/seeds/seed_multiple_tenants.py
```

### Scripts de Verificação

#### Verificar Dados de Subscriptions
```bash
docker-compose exec web python database/scripts/check_subscriptions_data.py
```

#### Verificar Dados do Tenant
```bash
docker-compose exec web python database/scripts/check_tenant_data.py <schema_name>
```

### Scripts de Migração

#### Aplicar Migrações de Subscriptions
```bash
# Windows
database\scripts\apply_subscriptions_migrations.bat

# Linux/Mac
./database/scripts/apply_subscriptions_migrations.sh
```

## 📝 Notas

- As migrações do Django ficam nos diretórios `*/migrations/` de cada app
- Esta pasta `database/` é apenas para scripts e seeds auxiliares
- Todos os scripts assumem que o Django está configurado e o Docker está rodando

