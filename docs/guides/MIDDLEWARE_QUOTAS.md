# 🛡️ Middleware e Decoradores de Quotas

## ✅ O que foi implementado

### 1. Middleware de Quotas
- ✅ Verifica se assinatura está ativa antes de processar requisições
- ✅ Bloqueia requisições POST/PUT/PATCH se assinatura expirada
- ✅ Retorna erro 402 (Payment Required) quando assinatura inativa

### 2. Decoradores de Quotas
- ✅ `@check_quota()` - Verifica quota antes de executar view
- ✅ `@update_quota_after_create()` - Atualiza quota após criar recurso
- ✅ `@update_quota_after_delete()` - Atualiza quota após deletar recurso

### 3. Signals Automáticos
- ✅ Atualiza quota de usuários automaticamente
- ✅ Atualiza quota de empresas automaticamente
- ✅ Atualiza quota de filiais automaticamente

---

## 🔧 Como Usar

### Middleware Automático

O middleware já está configurado e funciona automaticamente. Ele verifica:
- Se a assinatura está ativa antes de processar requisições POST/PUT/PATCH
- Retorna erro 402 se assinatura expirada

**Não precisa fazer nada** - já está funcionando!

### Decoradores em Views/ViewSets

#### Exemplo 1: Verificar quota antes de criar usuário

```python
from subscriptions.decorators import check_quota, update_quota_after_create

@api_view(['POST'])
@check_quota('users')
@update_quota_after_create('users')
def create_user(request):
    # Criar usuário...
    pass
```

#### Exemplo 2: Verificar quota em ViewSet

```python
from subscriptions.decorators import check_quota, update_quota_after_create, update_quota_after_delete

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    
    @check_quota('empresas')
    @update_quota_after_create('empresas')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @update_quota_after_delete('empresas')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
```

#### Exemplo 3: Verificar múltiplas quotas

```python
@check_quota('users', value=5)  # Verifica se pode criar 5 usuários
def create_multiple_users(request):
    # Criar múltiplos usuários...
    pass
```

---

## 📊 Signals Automáticos

Os signals já estão configurados e atualizam quotas automaticamente quando:

1. **Usuário criado/deletado** → Atualiza `users_count`
2. **Empresa criada/deletada** → Atualiza `empresas_count`
3. **Filial criada/deletada** → Atualiza `filiais_count`

**Não precisa fazer nada** - funciona automaticamente!

---

## 🧪 Como Testar

### 1. Testar Middleware (Assinatura Expirada)

1. No admin, expire uma assinatura:
   - Vá em `Subscriptions > Subscriptions`
   - Edite uma assinatura
   - Altere `current_period_end` para uma data passada
   - Salve

2. Tente criar um recurso:
   ```bash
   POST http://localhost:8000/api/cadastros/pessoas/
   ```

3. Deve retornar:
   ```json
   {
     "error": "Assinatura inativa ou expirada",
     "message": "Sua assinatura expirou. Renove para continuar usando o sistema.",
     "subscription_status": "expired"
   }
   ```
   Status: **402 Payment Required**

### 2. Testar Decorador de Quota

Adicione o decorador a uma view e tente criar recursos além do limite:

```python
from subscriptions.decorators import check_quota

@check_quota('users')
def create_user(request):
    # ...
```

Se o limite for excedido, retorna:
```json
{
  "error": "Limite de users atingido (3/3)",
  "quota_type": "users",
  "quota_exceeded": true
}
```
Status: **403 Forbidden**

### 3. Verificar Quotas no Admin

1. Acesse: `http://localhost:8000/admin/subscriptions/quotausage/`
2. Veja o uso atual de cada tenant
3. O resumo mostra percentuais de uso vs limites

---

## 🔍 Verificações Automáticas

### Middleware verifica:
- ✅ Assinatura ativa antes de POST/PUT/PATCH
- ✅ Retorna erro 402 se expirada

### Signals atualizam:
- ✅ `users_count` quando usuários são criados/deletados
- ✅ `empresas_count` quando empresas são criadas/deletadas
- ✅ `filiais_count` quando filiais são criadas/deletadas

### Decoradores permitem:
- ✅ Verificação manual de quotas antes de criar recursos
- ✅ Atualização manual de quotas após criar/deletar

---

## 📝 Exemplo Completo

```python
# views.py
from rest_framework import viewsets
from subscriptions.decorators import check_quota, update_quota_after_create
from .models import Empresa
from .serializers import EmpresaSerializer

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
    
    @check_quota('empresas')
    @update_quota_after_create('empresas')
    def create(self, request, *args, **kwargs):
        # Verifica quota antes de criar
        # Atualiza quota após criar
        return super().create(request, *args, **kwargs)
```

---

## ⚠️ Importante

### Middleware vs Decoradores

- **Middleware**: Verifica assinatura ativa (automático, todas as requisições)
- **Decoradores**: Verifica quotas específicas (opcional, apenas onde usar)

### Quando Usar Decoradores

Use decoradores quando:
- Quer verificar quota específica antes de criar recurso
- Quer controle granular sobre quais recursos verificam quotas
- Quer mensagens de erro personalizadas

Não precisa usar decoradores se:
- Os signals já atualizam as quotas automaticamente
- O middleware já verifica assinatura ativa

---

## ✅ Checklist

- [x] Middleware de quotas implementado
- [x] Decoradores de quotas criados
- [x] Signals automáticos configurados
- [x] Middleware adicionado ao settings
- [x] App config configurado para signals

---

**Última atualização**: 2025-11-14

