# Scripts do Projeto SISCR

Este diretório contém scripts utilitários para desenvolvimento, testes e manutenção do projeto.

## 📁 Estrutura

```
scripts/
├── dev/              # Scripts de desenvolvimento
│   ├── check_stripe_config.py
│   ├── check_user.py
│   └── check_test_user.py
├── database/         # Scripts de banco de dados
│   ├── apply_migrations.bat/.sh  # Script genérico para migrations
│   ├── apply_payments_migrations.bat/.sh  # (legado - usar apply_migrations)
│   ├── apply_subscriptions_migrations.bat/.sh  # (legado - usar apply_migrations)
│   ├── check_subscriptions_data.py
│   ├── check_tenant_data.py
│   ├── create_migrations_siscr.py
│   └── create_test_tenant.py
├── tenant/           # Scripts de gerenciamento de tenant
│   ├── criar_tenant.ps1
│   └── remove_test_tenant.bat
└── utils/            # Scripts utilitários gerais
    ├── fix_test_user.py
    └── exemplo_signup.json
```

## 🔧 Scripts Disponíveis

### Desenvolvimento (`dev/`)

#### `check_stripe_config.py`
Verifica configuração do Stripe (chaves, planos, price IDs).

**Uso:**
```bash
python scripts/dev/check_stripe_config.py
```

#### `check_user.py`
Verifica se um usuário existe no banco de dados (schema público e tenants).

**Uso:**
```bash
python scripts/dev/check_user.py [username] [password]
python scripts/dev/check_user.py teste_user senha123
python scripts/dev/check_user.py --help
```

#### `check_test_user.py`
Wrapper para verificar o usuário `teste_user` com senha `senha123`.

**Uso:**
```bash
python scripts/dev/check_test_user.py
```

### Banco de Dados (`database/`)

#### `apply_migrations.bat/.sh` ⭐ **NOVO - GENÉRICO**
Script genérico para aplicar migrations de qualquer app.

**Uso:**
```bash
# Windows
scripts\database\apply_migrations.bat [app_name] [--seed]

# Linux/Mac
./scripts/database/apply_migrations.sh [app_name] [--seed]

# Exemplos
scripts\database\apply_migrations.bat payments
scripts\database\apply_migrations.bat subscriptions --seed
```

#### `apply_payments_migrations.bat/.sh` (Legado)
Script específico para migrations do app payments. **Recomendado usar `apply_migrations.bat payments`**

#### `apply_subscriptions_migrations.bat/.sh` (Legado)
Script específico para migrations do app subscriptions. **Recomendado usar `apply_migrations.bat subscriptions --seed`**

#### `check_subscriptions_data.py`
Verifica dados de subscriptions no banco.

**Uso:**
```bash
python scripts/database/check_subscriptions_data.py
```

#### `check_tenant_data.py`
Verifica dados de tenants no banco.

**Uso:**
```bash
python scripts/database/check_tenant_data.py
```

#### `create_migrations_siscr.py`
Cria migrations para o projeto.

**Uso:**
```bash
python scripts/database/create_migrations_siscr.py
```

#### `create_test_tenant.py`
Cria um tenant de teste.

**Uso:**
```bash
python scripts/database/create_test_tenant.py
```

### Tenant (`tenant/`)

#### `criar_tenant.ps1`
Cria um novo tenant interativamente via PowerShell.

**Uso:**
```powershell
.\scripts\tenant\criar_tenant.ps1
```

#### `remove_test_tenant.bat`
Remove o tenant de teste do banco de dados.

**Uso:**
```bash
scripts\tenant\remove_test_tenant.bat
```

### Utilitários (`utils/`)

#### `fix_test_user.py`
Corrige o usuário `teste_user` e o torna staff/superuser.

**Uso:**
```bash
python scripts/utils/fix_test_user.py
```

#### `exemplo_signup.json`
Exemplo de JSON para criação de tenant via API.

**Uso:**
```bash
# Usar como referência para chamadas à API /api/public/signup/
```

## 📝 Notas

- Scripts Python devem ser executados com `python scripts/...`
- Scripts PowerShell (`.ps1`) são para Windows
- Scripts Batch (`.bat`) são para Windows
- Scripts Shell (`.sh`) são para Linux/Mac

## ⚠️ Aviso

Alguns scripts podem modificar dados do banco. Sempre faça backup antes de executar scripts que alteram dados.

## 🔄 Migração de Scripts Antigos

Se você estava usando scripts da pasta `database/scripts/`, eles foram movidos para `scripts/database/`. Atualize seus comandos:

**Antes:**
```bash
python database/scripts/check_tenant_data.py
```

**Depois:**
```bash
python scripts/database/check_tenant_data.py
```

## 🆕 Novos Scripts Genéricos

Use os novos scripts genéricos quando possível:

- `apply_migrations.bat/.sh` - Substitui scripts específicos de migrations
- `check_user.py` - Substitui `check_test_user.py` (mas `check_test_user.py` ainda funciona como wrapper)
