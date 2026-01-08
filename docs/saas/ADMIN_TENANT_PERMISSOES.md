# 🔐 Sistema de Permissões do Admin do Tenant

## 📋 Visão Geral

Quando um tenant é criado, o usuário criado durante o signup é configurado como **admin do tenant** com permissões absolutas **apenas dentro do seu tenant**. Este usuário **NÃO** tem acesso ao Django Admin global (`/admin/`) que mostra dados de todos os tenants.

## ✅ O que foi implementado

### 1. **Remoção de Superuser no Signup**

O usuário criado durante o signup **não é mais criado como superuser** (`is_superuser=False`), evitando acesso ao Django Admin global que mostra dados de todos os tenants.

**Arquivo:** `public/views.py`

### 2. **Sistema de Permissões do Admin do Tenant**

O admin do tenant tem permissões absolutas em:
- ✅ Todas as empresas e filiais do tenant
- ✅ Gerenciamento de usuários do tenant
- ✅ Configurações do sistema do tenant
- ✅ Integração com Stripe e recorrência de pagamento
- ✅ Todas as operações CRUD em todos os módulos do tenant

**Arquivos:**
- `accounts/models.py` - Método `is_tenant_admin()` e `has_permission()` expandido
- `accounts/permissions.py` - Classes de permissão `IsTenantAdmin` e `HasTenantPermission`

### 3. **Filtro de Dados por Tenant**

O admin do tenant vê **todos os dados** do tenant (todas empresas e filiais), enquanto outros usuários veem apenas os dados da empresa/filial atual.

**Arquivos:**
- `cadastros/utils.py` - Função `filter_by_empresa_filial()` atualizada
- `cadastros/api/viewsets.py` - Viewsets atualizados para passar o usuário

## 🎯 Permissões do Admin do Tenant

### Permissões Básicas CRUD
- `view` - Visualizar dados
- `add` - Criar novos registros
- `change` - Editar registros existentes
- `delete` - Excluir registros

### Permissões de Gerenciamento
- `manage_users` - Gerenciar usuários do tenant
- `manage_permissions` - Gerenciar permissões de usuários
- `manage_roles` - Gerenciar roles (admin, manager, user, viewer)
- `manage_empresas` - Gerenciar empresas do tenant
- `manage_filiais` - Gerenciar filiais do tenant

### Permissões de Configuração
- `manage_settings` - Configurar sistema do tenant
- `manage_configurations` - Configurações gerais
- `manage_stripe` - Configurar integração Stripe
- `manage_subscriptions` - Gerenciar assinaturas e recorrência
- `manage_payments` - Gerenciar pagamentos

### Permissão Total
- `full_access` - Acesso total ao sistema do tenant

## 🔧 Como Funciona

### Verificação de Permissões

```python
from accounts.permissions import is_tenant_admin

# Verificar se usuário é admin do tenant
if is_tenant_admin(request.user):
    # Admin do tenant tem acesso total
    pass
```

### Uso em Views/ViewSets

```python
from accounts.permissions import IsTenantAdmin, HasTenantPermission

class MinhaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsTenantAdmin]  # Apenas admin do tenant
    # ou
    permission_classes = [HasTenantPermission]  # Baseado em role
```

### Filtro de Dados

```python
from cadastros.utils import filter_by_empresa_filial

def get_queryset(self):
    queryset = super().get_queryset()
    empresa, filial = get_current_empresa_filial(self.request.user)
    # Admin do tenant vê todos os dados, outros usuários veem apenas empresa/filial atual
    return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial, user=self.request.user)
```

## 📝 Próximos Passos

### 1. Criar API para Gerenciamento de Usuários

Criar endpoints para o admin do tenant gerenciar usuários:
- `GET /api/tenant/users/` - Listar usuários do tenant
- `POST /api/tenant/users/` - Criar novo usuário
- `PUT /api/tenant/users/{id}/` - Editar usuário
- `DELETE /api/tenant/users/{id}/` - Remover usuário
- `POST /api/tenant/users/{id}/change-role/` - Alterar role do usuário

### 2. Criar API para Configurações do Tenant

Criar endpoints para configurações:
- `GET /api/tenant/settings/` - Obter configurações
- `PUT /api/tenant/settings/` - Atualizar configurações

### 3. Criar API para Integração Stripe

Criar endpoints para Stripe:
- `GET /api/tenant/stripe/config/` - Obter configuração Stripe
- `POST /api/tenant/stripe/connect/` - Conectar conta Stripe
- `GET /api/tenant/stripe/subscription/` - Obter assinatura atual
- `POST /api/tenant/stripe/subscription/update/` - Atualizar assinatura
- `GET /api/tenant/stripe/payments/` - Listar pagamentos

### 4. Criar Interface no Frontend

Criar páginas no frontend para:
- Gerenciamento de usuários
- Configurações do sistema
- Integração Stripe
- Assinaturas e recorrência

## ⚠️ Importante

1. **Admin do tenant NÃO tem acesso ao Django Admin global** (`/admin/`)
2. **Admin do tenant vê TODOS os dados do tenant** (todas empresas e filiais)
3. **Outros usuários veem apenas dados da empresa/filial atual**
4. **Permissões são verificadas em cada requisição** via JWT token

## 🔒 Segurança

- Usuários não são mais criados como superuser no signup
- Permissões são verificadas em cada requisição
- Admin do tenant só tem acesso aos dados do seu tenant
- Isolamento total entre tenants via django-tenants

