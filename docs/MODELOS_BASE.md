# 🏗️ Modelos Base do Sistema SISCR

## 📋 Visão Geral

O sistema agora utiliza uma hierarquia de modelos base inspirada no modelo de objetos do **Salesforce**, garantindo consistência e facilitando a manutenção futura.

## 🔄 Hierarquia de Modelos

```
ModelBase (classe base fundamental)
    └── SiscrModelBase (adiciona campos obrigatórios)
        └── Todos os modelos do sistema
```

### 1. **ModelBase**

Classe base fundamental que contém apenas o campo `id` (auto-incremento padrão do Django).

**Localização:** `core/base_models.py`

```python
class ModelBase(models.Model):
    """Classe base fundamental para todos os modelos."""
    class Meta:
        abstract = True
```

### 2. **SiscrModelBase**

Herda de `ModelBase` e adiciona campos obrigatórios comuns a todos os modelos do sistema.

**Localização:** `core/base_models.py`

**Campos Adicionados:**

| Campo | Tipo | Descrição | Inspiração Salesforce |
|-------|------|-----------|----------------------|
| `created_at` | DateTimeField | Data de criação | `CreatedDate` |
| `updated_at` | DateTimeField | Data de última modificação | `LastModifiedDate` |
| `created_by` | ForeignKey(User) | Usuário que criou | `CreatedBy` |
| `updated_by` | ForeignKey(User) | Usuário que modificou | `LastModifiedBy` |
| `owner` | ForeignKey(User) | Proprietário do registro | `OwnerId` |
| `is_deleted` | BooleanField | Soft delete | `IsDeleted` |
| `deleted_at` | DateTimeField | Data de exclusão | - |
| `deleted_by` | ForeignKey(User) | Usuário que deletou | - |

**Funcionalidades:**

1. **Soft Delete**: Método `delete()` marca como excluído ao invés de remover do banco
2. **Hard Delete**: Método `hard_delete()` remove permanentemente
3. **Restore**: Método `restore()` restaura um registro excluído
4. **Auto-fill**: Método `save()` preenche automaticamente `created_by`, `updated_by` e `owner`
5. **Manager Customizado**: Filtra automaticamente registros excluídos

## 📦 Modelos Atualizados

Todos os modelos do sistema agora herdam de `SiscrModelBase`:

### Cadastros (`cadastros/models.py`)
- ✅ `Pessoa`
- ✅ `Produto`
- ✅ `Servico`
- ✅ `ContaReceber`
- ✅ `ContaPagar`

### Tenants (`tenants/models.py`)
- ✅ `Empresa`
- ✅ `Filial`
- ⚠️ `Tenant` (herda de `TenantMixin`, não pode herdar de `SiscrModelBase`)
- ⚠️ `Domain` (herda de `DomainMixin`, não pode herdar de `SiscrModelBase`)

### Accounts (`accounts/models.py`)
- ✅ `UserProfile`
- ✅ `TenantMembership`

### Subscriptions (`subscriptions/models.py`)
- ✅ `Plan`
- ✅ `Feature`
- ✅ `Subscription`
- ✅ `QuotaUsage`

### Payments (`payments/models.py`)
- ✅ `PaymentMethod`
- ✅ `Payment`
- ✅ `Invoice`

## 🔧 Middleware de Auditoria

**Localização:** `core/middleware.py`

O middleware `AuditMiddleware` captura automaticamente o usuário autenticado e disponibiliza para os modelos preencherem os campos de auditoria.

**Configuração:** Adicionado em `siscr/settings.py` após `AuthenticationMiddleware`.

```python
MIDDLEWARE = [
    # ...
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.AuditMiddleware',  # ← Adicionado aqui
    # ...
]
```

## 🎯 Como Usar

### 1. Criar um Novo Modelo

```python
from core.base_models import SiscrModelBase

class MeuModelo(SiscrModelBase):
    nome = models.CharField(max_length=100)
    # ... outros campos
    
    class Meta:
        verbose_name = 'Meu Modelo'
```

### 2. Soft Delete (Padrão)

```python
# Marca como excluído (não remove do banco)
pessoa.delete()

# Remove permanentemente
pessoa.hard_delete()

# Restaura
pessoa.restore()
```

### 3. Querysets

```python
# Retorna apenas registros não excluídos (padrão)
pessoas = Pessoa.objects.all()

# Retorna todos, incluindo excluídos
pessoas = Pessoa.all_objects.all()

# Retorna apenas excluídos
pessoas = Pessoa.objects.deleted_only()
```

### 4. Campos de Auditoria

Os campos `created_by`, `updated_by` e `owner` são preenchidos automaticamente quando:
- Um objeto é criado via API (com usuário autenticado)
- Um objeto é atualizado via API (com usuário autenticado)

**Nota:** Em scripts de migração ou comandos de gerenciamento, você pode definir manualmente:

```python
pessoa = Pessoa.objects.create(
    nome="João",
    created_by=user,
    owner=user
)
```

## 📊 Índices de Performance

O `SiscrModelBase` inclui índices automáticos para:
- `created_at`
- `updated_at`
- `is_deleted`
- `owner`

## ⚠️ Observações Importantes

1. **Primary Keys Customizados**: Modelos com `primary_key=True` em campos específicos (como `Pessoa.codigo_cadastro`) continuam funcionando normalmente. O Django não cria o campo `id` quando há um `primary_key` customizado.

2. **Tenant e Domain**: Não podem herdar de `SiscrModelBase` porque já herdam de `TenantMixin` e `DomainMixin` respectivamente. Eles mantêm seus próprios campos de auditoria.

3. **Compatibilidade**: Modelos existentes que já tinham `created_at` e `updated_at` tiveram esses campos removidos para evitar duplicação (agora vêm do `SiscrModelBase`).

## 🚀 Próximos Passos

1. ✅ Criar migrations para os novos campos
2. ⏳ Atualizar serializers para incluir novos campos (opcional)
3. ⏳ Atualizar viewsets para usar soft delete
4. ⏳ Atualizar admin para mostrar campos de auditoria

## 📚 Referências

- [Django Models Documentation](https://docs.djangoproject.com/en/stable/topics/db/models/)
- [Salesforce Object Model](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/)

