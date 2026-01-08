# 📊 Divisão de Schemas: Público vs Tenant

## 🎯 Visão Geral

O sistema SISCR usa **django-tenants** para implementar multi-tenancy com **PostgreSQL schemas**. Os dados são divididos em dois tipos de schemas:

1. **Schema Público (`public`)**: Dados compartilhados entre todos os tenants
2. **Schemas de Tenants**: Dados específicos de cada tenant (um schema por tenant)

---

## 🏛️ Schema Público (`public`)

O schema público contém dados que são **compartilhados** entre todos os tenants. Esses dados são gerenciados centralmente e acessíveis por todos os tenants.

### Apps no Schema Público (SHARED_APPS)

Baseado em `siscr/settings.py`, os seguintes apps estão configurados como `SHARED_APPS`:

#### 1. **Django Core (Sistema)**
- `django_tenants` - Framework de multi-tenancy
- `django.contrib.contenttypes` - Tipos de conteúdo
- `django.contrib.auth` - Autenticação (User)
- `django.contrib.sessions` - Sessões
- `django.contrib.messages` - Mensagens
- `django.contrib.admin` - Admin do Django
- `django.contrib.staticfiles` - Arquivos estáticos

#### 2. **Third-Party Apps**
- `rest_framework` - Django REST Framework
- `rest_framework_simplejwt` - JWT Authentication
- `drf_spectacular` - Swagger/OpenAPI
- `corsheaders` - CORS
- `guardian` - Permissões por objeto
- `django_extensions` - Extensões do Django
- `django_ratelimit` - Rate limiting

#### 3. **Apps Customizados (Shared)**

##### **`tenants`** - Gerenciamento de Tenants
Tabelas:
- `tenants_tenant` - Lista de todos os tenants do sistema
- `tenants_domain` - Domínios/subdomínios de cada tenant

**Nota Importante**: Embora `Empresa` e `Filial` estejam no app `tenants`, elas **NÃO** estão no schema público. Elas são criadas nos schemas dos tenants (ver explicação abaixo).

##### **`accounts`** - Autenticação e Permissões
Tabelas:
- `accounts_userprofile` - Perfis de usuários (vinculados a tenants)
- `accounts_tenantmembership` - Relação many-to-many entre User e Tenant (define quais tenants um usuário tem acesso)
- `accounts_customrole` - Roles customizadas
- `accounts_modulepermission` - Permissões por módulo

##### **`subscriptions`** - Sistema de Assinaturas SaaS
Tabelas:
- `subscriptions_plan` - Planos de assinatura (Básico, Pro, Enterprise)
- `subscriptions_feature` - Funcionalidades disponíveis
- `subscriptions_subscription` - Assinaturas ativas de cada tenant
- `subscriptions_quotausage` - Uso de quotas (contadores de uso)

##### **`payments`** - Sistema de Pagamentos (Stripe)
Tabelas:
- `payments_paymentmethod` - Métodos de pagamento dos tenants
- `payments_payment` - Histórico de pagamentos
- `payments_invoice` - Faturas geradas

##### **`public`** - Páginas Públicas
Tabelas:
- `public_emailsettings` - Configurações de email

---

## 🏢 Schemas dos Tenants

Cada tenant tem seu **próprio schema** no PostgreSQL. Quando um tenant é criado, o django-tenants cria automaticamente um schema com o nome definido em `Tenant.schema_name`.

### Apps nos Schemas dos Tenants (TENANT_APPS)

Baseado em `siscr/settings.py`, os seguintes apps estão configurados como `TENANT_APPS`:

#### 1. **`tenants`** - Dados do Tenant
**IMPORTANTE**: Embora o app `tenants` esteja em `SHARED_APPS`, os modelos `Empresa` e `Filial` são criados nos schemas dos tenants porque eles fazem referência a `Tenant` (que está no schema público).

Tabelas em cada schema de tenant:
- `tenants_empresa` - Empresas do tenant (cada tenant pode ter múltiplas empresas)
- `tenants_filial` - Filiais das empresas (cada empresa pode ter múltiplas filiais)

**Por que estão nos schemas dos tenants?**
- `Empresa` tem `ForeignKey` para `Tenant` (referência ao schema público)
- `Filial` tem `ForeignKey` para `Empresa` (que está no schema do tenant)
- Os dados de empresas e filiais são específicos de cada tenant

#### 2. **`core`** - Funcionalidades Core
Tabelas:
- `core_*` - Tabelas específicas do app core (se houver)

#### 3. **`cadastros`** - Cadastros Gerais
Tabelas:
- `cadastros_pessoa` - Pessoas (clientes, fornecedores, etc.)
- `cadastros_produto` - Produtos
- `cadastros_servico` - Serviços
- `cadastros_contareceber` - Contas a receber
- `cadastros_contapagar` - Contas a pagar

**Características**:
- Cada tenant tem seus próprios cadastros
- Podem estar vinculados a `Empresa` ou `Filial` específicas
- Dados completamente isolados entre tenants

#### 4. **`estoque`** - Gestão de Estoque
Tabelas:
- `estoque_location` - Localizações físicas (lojas, almoxarifados, etc.)
- `estoque_estoque` - Estoque físico de produtos
- `estoque_movimentacaoestoque` - Histórico de movimentações
- `estoque_reservaestoque` - Reservas de estoque (SOFT/HARD)
- `estoque_previsaomovimentacao` - Previsões de movimentação
- `estoque_grupofilial` - Grupos de filiais para estoque consolidado

**Características**:
- Cada tenant tem seu próprio estoque
- Estoque pode ser vinculado a `Location` → `Filial` → `Empresa`
- Dados completamente isolados entre tenants

---

## 🔄 Como Funciona na Prática

### 1. **Criação de um Tenant**

Quando um novo tenant é criado:

```python
# 1. Cria registro no schema público
tenant = Tenant.objects.create(
    schema_name='empresa_abc',
    name='Empresa ABC'
)

# 2. django-tenants cria automaticamente o schema 'empresa_abc'
# 3. Aplica migrações no novo schema
# 4. Cria todas as tabelas dos TENANT_APPS no schema 'empresa_abc'
```

### 2. **Acesso aos Dados**

#### Schema Público:
```python
# Sempre acessa o schema público
from django_tenants.utils import schema_context

with schema_context('public'):
    tenants = Tenant.objects.all()  # Todos os tenants
    plans = Plan.objects.all()  # Todos os planos
    subscriptions = Subscription.objects.all()  # Todas as assinaturas
```

#### Schema do Tenant:
```python
# Acessa dados do tenant específico
with schema_context('empresa_abc'):
    empresas = Empresa.objects.all()  # Empresas do tenant 'empresa_abc'
    produtos = Produto.objects.all()  # Produtos do tenant 'empresa_abc'
    estoques = Estoque.objects.all()  # Estoque do tenant 'empresa_abc'
```

### 3. **Middleware Automático**

O middleware `TenantMainMiddleware` identifica automaticamente o tenant pela URL/domínio e configura o schema correto:

```python
# Requisição: https://empresa_abc.siscr.com.br/api/produtos/
# → Middleware identifica tenant 'empresa_abc'
# → Configura schema_context automaticamente
# → Todas as queries usam o schema do tenant
```

---

## 📋 Resumo das Tabelas

### Schema Público (`public`)

| App | Tabela | Descrição |
|-----|--------|-----------|
| `tenants` | `tenants_tenant` | Lista de tenants |
| `tenants` | `tenants_domain` | Domínios dos tenants |
| `accounts` | `auth_user` | Usuários do sistema (Django) |
| `accounts` | `accounts_userprofile` | Perfis de usuários |
| `accounts` | `accounts_tenantmembership` | Relação User ↔ Tenant |
| `accounts` | `accounts_customrole` | Roles customizadas |
| `accounts` | `accounts_modulepermission` | Permissões por módulo |
| `subscriptions` | `subscriptions_plan` | Planos de assinatura |
| `subscriptions` | `subscriptions_feature` | Funcionalidades |
| `subscriptions` | `subscriptions_subscription` | Assinaturas ativas |
| `subscriptions` | `subscriptions_quotausage` | Uso de quotas |
| `payments` | `payments_paymentmethod` | Métodos de pagamento |
| `payments` | `payments_payment` | Pagamentos |
| `payments` | `payments_invoice` | Faturas |
| `public` | `public_emailsettings` | Configurações de email |

### Schema de Cada Tenant (ex: `empresa_abc`)

| App | Tabela | Descrição |
|-----|--------|-----------|
| `tenants` | `tenants_empresa` | Empresas do tenant |
| `tenants` | `tenants_filial` | Filiais das empresas |
| `cadastros` | `cadastros_pessoa` | Pessoas (clientes, fornecedores) |
| `cadastros` | `cadastros_produto` | Produtos |
| `cadastros` | `cadastros_servico` | Serviços |
| `cadastros` | `cadastros_contareceber` | Contas a receber |
| `cadastros` | `cadastros_contapagar` | Contas a pagar |
| `estoque` | `estoque_location` | Localizações físicas |
| `estoque` | `estoque_estoque` | Estoque físico |
| `estoque` | `estoque_movimentacaoestoque` | Movimentações |
| `estoque` | `estoque_reservaestoque` | Reservas |
| `estoque` | `estoque_previsaomovimentacao` | Previsões |
| `estoque` | `estoque_grupofilial` | Grupos de filiais |

---

## ⚠️ Pontos Importantes

### 1. **Isolamento de Dados**
- Cada tenant tem seus próprios dados completamente isolados
- Não há risco de um tenant acessar dados de outro
- Backup e restore podem ser feitos por tenant

### 2. **Referências entre Schemas**
- `Empresa` (schema tenant) referencia `Tenant` (schema público) via `ForeignKey`
- `Subscription` (schema público) referencia `Tenant` (schema público) via `ForeignKey`
- O django-tenants gerencia essas referências automaticamente

### 3. **Migrações**
```bash
# Aplicar migrações no schema público
python manage.py migrate_schemas --shared

# Aplicar migrações em todos os schemas de tenants
python manage.py migrate_schemas

# Aplicar migrações em um tenant específico
python manage.py migrate_schemas --schema=empresa_abc
```

### 4. **Tarefas Celery**
- Tarefas que processam dados de tenants devem iterar sobre todos os tenants
- Usar `schema_context` para alternar entre schemas
- Verificar se tabelas existem antes de acessá-las (para tenants novos)

---

## 🔍 Verificando Schemas no PostgreSQL

```sql
-- Listar todos os schemas
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema');

-- Listar tabelas do schema público
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Listar tabelas de um tenant específico
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'empresa_abc';
```

---

## 📚 Referências

- [Django Tenants Documentation](https://django-tenants.readthedocs.io/)
- [PostgreSQL Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- `siscr/settings.py` - Configuração de SHARED_APPS e TENANT_APPS
- `core/base_models.py` - Modelos base do sistema

