# 🏢 Estratégia de Separação de Dados por Filial

## ❌ Problema Atual

Dentro do mesmo **Tenant** (mesmo schema), os dados de diferentes **Filiais** **NÃO estão isolados**.

### Exemplo do Problema:

```
Tenant: "Grupo ABC"
Schema: grupo_abc
│
└── Empresa: "ABC Comércio Ltda"
    ├── Filial 1: "Matriz - Centro"
    ├── Filial 2: "Loja Norte"
    └── Filial 3: "Loja Sul"
```

**Situação atual:**
- Uma `Pessoa` cadastrada na "Matriz" aparece também na "Loja Norte" e "Loja Sul"
- Um `Produto` cadastrado na "Loja Norte" aparece em todas as filiais
- Uma `ContaReceber` da "Matriz" aparece no relatório da "Loja Sul"

**Por quê?**
- Os modelos (`Pessoa`, `Produto`, `Servico`, `ContaReceber`, `ContaPagar`) **não têm campos** `empresa` ou `filial`
- Todas as queries retornam **todos os dados do tenant**, sem filtro por filial

---

## ✅ Estratégias de Solução

### **Estratégia 1: Foreign Key para Empresa/Filial (RECOMENDADA)**

Adicionar campos `empresa` e/ou `filial` em todos os modelos que precisam ser separados.

#### Vantagens:
- ✅ Isolamento claro e explícito
- ✅ Queries simples e performáticas
- ✅ Fácil de implementar
- ✅ Suporta relatórios consolidados (filtrar por empresa)
- ✅ Permite dados compartilhados (empresa=None = compartilhado)

#### Desvantagens:
- ⚠️ Requer migration dos dados existentes
- ⚠️ Precisa decidir: separar por empresa ou filial?

#### Implementação:

```python
# cadastros/models.py

class Pessoa(models.Model):
    # ... campos existentes ...
    
    # NOVO: Vínculo com Empresa/Filial
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pessoas',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pessoas',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
        ]

class Produto(models.Model):
    # ... campos existentes ...
    
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='produtos',
        verbose_name='Empresa'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='produtos',
        verbose_name='Filial'
    )

class ContaReceber(models.Model):
    # ... campos existentes ...
    
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Empresa'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Filial'
    )
```

#### Uso nas Views:

```python
# cadastros/views.py

def list_pessoas(request):
    profile = request.user.profile
    
    # Filtrar por empresa/filial atual do usuário
    queryset = Pessoa.objects.all()
    
    if profile.current_filial:
        # Se tem filial selecionada, mostrar apenas dados dessa filial
        queryset = queryset.filter(filial=profile.current_filial)
    elif profile.current_empresa:
        # Se tem empresa selecionada, mostrar dados da empresa (todas as filiais)
        queryset = queryset.filter(empresa=profile.current_empresa)
    else:
        # Se não tem empresa/filial, mostrar todos (ou nada, dependendo da regra)
        queryset = queryset.filter(empresa__isnull=True)  # Apenas compartilhados
    
    return queryset
```

---

### **Estratégia 2: Middleware/Manager Customizado**

Criar um Manager customizado que automaticamente filtra por `current_empresa`/`current_filial` do usuário.

#### Vantagens:
- ✅ Transparente para o desenvolvedor
- ✅ Não precisa modificar todas as queries
- ✅ Centraliza a lógica de filtro

#### Desvantagens:
- ⚠️ Mais complexo de implementar
- ⚠️ Pode ser confuso (filtro "mágico")
- ⚠️ Dificulta queries que precisam ver todos os dados

#### Implementação:

```python
# cadastros/managers.py

from django.db import models
from django.db.models import Manager

class FilialScopedManager(Manager):
    """
    Manager que automaticamente filtra por empresa/filial do usuário atual
    """
    def get_queryset(self):
        from django_tenants.utils import get_current_tenant
        from accounts.models import UserProfile
        
        queryset = super().get_queryset()
        
        # Obter empresa/filial do request atual (via thread-local ou context)
        # Isso requer middleware customizado
        
        return queryset

# Uso no modelo:
class Pessoa(models.Model):
    # ... campos ...
    empresa = models.ForeignKey(...)
    filial = models.ForeignKey(...)
    
    objects = FilialScopedManager()  # Filtra automaticamente
    all_objects = Manager()  # Para queries que precisam ver tudo
```

---

### **Estratégia 3: Schema por Filial (NÃO RECOMENDADO)**

Criar um schema separado para cada filial.

#### Vantagens:
- ✅ Isolamento total (como tenants)

#### Desvantagens:
- ❌ Muito complexo
- ❌ Limite de schemas no PostgreSQL (~1000)
- ❌ Dificulta relatórios consolidados
- ❌ Overhead de gerenciamento

---

## 🎯 Recomendação Final

### **Usar Estratégia 1: Foreign Key para Empresa/Filial**

**Por quê?**
1. **Simples e clara**: Fácil de entender e manter
2. **Flexível**: Permite dados compartilhados (empresa=None)
3. **Performática**: Índices no banco de dados
4. **Relatórios**: Fácil fazer relatórios consolidados ou por filial

### **Decisão Importante: Empresa ou Filial?**

**Opção A: Separar apenas por Empresa**
- Mais simples
- Adequado se filiais compartilham dados (ex: produtos, clientes)
- Relatórios por empresa

**Opção B: Separar por Filial**
- Mais granular
- Adequado se cada filial é independente
- Relatórios por filial

**Opção C: Ambos (Recomendado)**
- Campo `empresa` (obrigatório ou opcional)
- Campo `filial` (opcional)
- Se `filial=None`: dados compartilhados na empresa
- Se `empresa=None`: dados compartilhados no tenant

---

## 📋 Plano de Implementação

### Fase 1: Adicionar Campos
1. Adicionar `empresa` e `filial` nos modelos
2. Criar migration
3. Tornar campos opcionais (null=True) para compatibilidade

### Fase 2: Migrar Dados Existentes
1. Script para associar dados existentes à primeira empresa/filial
2. Ou marcar como compartilhados (empresa=None)

### Fase 3: Atualizar Views/APIs
1. Filtrar queries por `current_empresa`/`current_filial`
2. Atualizar serializers para incluir empresa/filial
3. Validar que novos registros sejam associados à empresa/filial atual

### Fase 4: Frontend
1. Mostrar seletor de empresa/filial
2. Filtrar listagens automaticamente
3. Permitir criar dados compartilhados (opcional)

---

## 🔍 Exemplo Prático

### Cenário: Grupo ABC com 3 Filiais

```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   ├── Filial: "Matriz"
│   ├── Filial: "Loja Norte"
│   └── Filial: "Loja Sul"
```

### Dados:

**Pessoa (Cliente):**
- `João Silva` → `empresa=ABC Comércio, filial=Matriz`
- `Maria Santos` → `empresa=ABC Comércio, filial=Loja Norte`
- `Pedro Costa` → `empresa=ABC Comércio, filial=None` (compartilhado)

**Produto:**
- `Notebook Dell` → `empresa=ABC Comércio, filial=None` (compartilhado)
- `Mouse Logitech` → `empresa=ABC Comércio, filial=Matriz` (apenas Matriz)

**ContaReceber:**
- `CR-001` → `empresa=ABC Comércio, filial=Matriz`
- `CR-002` → `empresa=ABC Comércio, filial=Loja Norte`

### Queries:

```python
# Usuário na Filial "Matriz" vê:
pessoas = Pessoa.objects.filter(
    models.Q(filial=matriz) | models.Q(filial__isnull=True)
)
# Resultado: João Silva, Pedro Costa

# Usuário na Filial "Loja Norte" vê:
pessoas = Pessoa.objects.filter(
    models.Q(filial=loja_norte) | models.Q(filial__isnull=True)
# Resultado: Maria Santos, Pedro Costa

# Admin da Empresa vê tudo:
pessoas = Pessoa.objects.filter(empresa=abc_comercio)
# Resultado: João, Maria, Pedro
```

---

## ✅ Conclusão

**Recomendação**: Implementar **Estratégia 1** com campos `empresa` e `filial` opcionais em todos os modelos que precisam ser separados.

Isso permite:
- ✅ Isolamento por filial quando necessário
- ✅ Dados compartilhados quando empresa/filial=None
- ✅ Relatórios consolidados ou por filial
- ✅ Flexibilidade para diferentes necessidades de negócio

