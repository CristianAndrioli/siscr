# 🗄️ Django ORM - Object-Relational Mapping

## ✅ ORM Já Está Presente no Projeto!

O **Django ORM** (Object-Relational Mapping) é o ORM nativo do Django e já está sendo usado extensivamente no projeto. Não é necessário instalar nenhuma biblioteca adicional.

---

## 📊 O que é o Django ORM?

O Django ORM é um sistema que permite:
- **Definir modelos** (tabelas) usando classes Python
- **Criar, ler, atualizar e deletar** dados sem escrever SQL manual
- **Fazer queries complexas** usando métodos Python
- **Gerenciar relacionamentos** entre tabelas (ForeignKey, ManyToMany, etc.)
- **Criar migrations** automaticamente baseadas nos modelos

---

## 🔍 Como Está Sendo Usado no Projeto

### 1. Definição de Modelos (Tabelas)

**Exemplo:** `cadastros/models.py`

```python
from django.db import models

class Pessoa(models.Model):
    codigo_cadastro = models.IntegerField(primary_key=True)
    nome_completo = models.CharField(max_length=255)
    cpf_cnpj = models.CharField(max_length=18, unique=True)
    tipo = models.CharField(max_length=2, choices=TIPO_CHOICES)
    cidade = models.CharField(max_length=100)
    estado = models.CharField(max_length=2)
    # ... outros campos
    
    class Meta:
        verbose_name = 'Pessoa'
        verbose_name_plural = 'Pessoas'
```

**Isso automaticamente cria uma tabela no banco:**
```sql
CREATE TABLE cadastros_pessoa (
    codigo_cadastro INTEGER PRIMARY KEY,
    nome_completo VARCHAR(255),
    cpf_cnpj VARCHAR(18) UNIQUE,
    tipo VARCHAR(2),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    ...
);
```

---

### 2. Operações CRUD (Create, Read, Update, Delete)

#### **CREATE (Criar)**
```python
# Exemplo em cadastros/views.py
pessoa = PessoaForm(request.POST)
if form.is_valid():
    form.save()  # Cria novo registro no banco
```

Ou diretamente:
```python
pessoa = Pessoa.objects.create(
    codigo_cadastro=1,
    nome_completo="João Silva",
    cpf_cnpj="123.456.789-00",
    tipo="PF",
    cidade="Florianópolis",
    estado="SC"
)
```

#### **READ (Ler)**
```python
# Buscar todas as pessoas (exemplo em cadastros/views.py linha 115)
pessoas = Pessoa.objects.all()

# Buscar uma pessoa específica (linha 329)
pessoa = Pessoa.objects.get(codigo_cadastro=codigo)

# Filtrar pessoas (linha 109-114)
pessoas = Pessoa.objects.filter(
    models.Q(cpf_cnpj__icontains=termo_busca) |
    models.Q(nome_completo__icontains=termo_busca)
).order_by('codigo_cadastro')
```

#### **UPDATE (Atualizar)**
```python
# Via form (linha 42-85 em cadastros/views.py)
pessoa = get_object_or_404(Pessoa, codigo_cadastro=codigo_cadastro)
form = PessoaForm(request.POST, instance=pessoa)
if form.is_valid():
    form.save()  # Atualiza o registro

# Ou diretamente:
pessoa = Pessoa.objects.get(codigo_cadastro=1)
pessoa.nome_completo = "João Silva Santos"
pessoa.save()
```

#### **DELETE (Deletar)**
```python
# Exemplo em cadastros/views.py linha 89-96
pessoa = get_object_or_404(Pessoa, codigo_cadastro=codigo_cadastro)
pessoa.delete()  # Remove o registro do banco
```

---

### 3. Queries Avançadas

#### **Agregações**
```python
# Exemplo em cadastros/views.py linha 21
from django.db.models import Max

max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
proximo_codigo = (max_id or 0) + 1
```

#### **Filtros com Q (OR, AND)**
```python
from django.db import models

# Busca com OR (linha 109-114)
pessoas = Pessoa.objects.filter(
    models.Q(cpf_cnpj__icontains=termo_busca) |
    models.Q(nome_completo__icontains=termo_busca) |
    models.Q(razao_social__icontains=termo_busca)
)
```

#### **Ordenação**
```python
# Ordenar por código (linha 115)
pessoas = Pessoa.objects.all().order_by('codigo_cadastro')

# Ordenar por nome (linha 211)
produtos = Produto.objects.all().order_by('nome')
```

#### **Limitar resultados**
```python
# Primeiros 10 registros
pessoas = Pessoa.objects.all()[:10]

# Últimos 5 registros
pessoas = Pessoa.objects.all().order_by('-codigo_cadastro')[:5]
```

---

### 4. Relacionamentos

O projeto já usa relacionamentos do Django ORM:

**Exemplo:** `tenants/models.py`

```python
class Empresa(models.Model):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='empresas'
    )
    nome = models.CharField(max_length=255)
    # ...

class Filial(models.Model):
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE
    )
    nome = models.CharField(max_length=255)
    # ...
```

**Uso:**
```python
# Acessar empresas de um tenant
tenant = Tenant.objects.get(name="Empresa X")
empresas = tenant.empresas.all()  # Via related_name

# Acessar filiais de uma empresa
empresa = Empresa.objects.get(nome="Matriz")
filiais = Filial.objects.filter(empresa=empresa)
```

---

## 📋 Exemplos Práticos no Código

### Exemplo 1: Calcular próximo código
```python
# cadastros/views.py linha 19-22
def _calcular_proximo_codigo_cadastro():
    max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
    return (max_id or 0) + 1
```

### Exemplo 2: Buscar com filtros
```python
# cadastros/views.py linha 109-114
if termo_busca:
    pessoas = Pessoa.objects.filter(
        models.Q(cpf_cnpj__icontains=termo_busca) |
        models.Q(nome_completo__icontains=termo_busca) |
        models.Q(razao_social__icontains=termo_busca)
    ).order_by('codigo_cadastro')
```

### Exemplo 3: API REST com ORM
```python
# cadastros/api/viewsets.py linha 12-13
class PessoaViewSet(viewsets.ModelViewSet):
    queryset = Pessoa.objects.all()  # Usa ORM para buscar dados
    serializer_class = PessoaSerializer
```

---

## 🎯 Migrations (ORM → Banco de Dados)

O Django ORM gerencia migrations automaticamente:

### Criar migration
```bash
python manage.py makemigrations cadastros
```

### Aplicar migration
```bash
python manage.py migrate
```

**O que acontece:**
1. Django lê os modelos Python (`models.py`)
2. Gera arquivos SQL automaticamente (`migrations/`)
3. Aplica no banco de dados PostgreSQL

**Exemplo:** `cadastros/migrations/0001_initial.py` foi criado automaticamente pelo ORM!

---

## 💡 Vantagens do Django ORM

✅ **Não precisa escrever SQL manualmente**
✅ **Código Python puro, mais legível**
✅ **Migrations automáticas**
✅ **Validação de dados**
✅ **Proteção contra SQL Injection (automática)**
✅ **Suporte a relacionamentos complexos**
✅ **Queries otimizadas**
✅ **Suporte a múltiplos bancos de dados**

---

## 🔧 Comandos Úteis do ORM

### Shell Interativo do Django
```bash
# Entrar no shell do Django
python manage.py shell

# Dentro do shell:
from cadastros.models import Pessoa

# Ver todas as pessoas
Pessoa.objects.all()

# Criar uma pessoa
p = Pessoa.objects.create(
    codigo_cadastro=1,
    nome_completo="Teste",
    cpf_cnpj="123.456.789-00",
    tipo="PF",
    cidade="São Paulo",
    estado="SP"
)

# Buscar por código
p = Pessoa.objects.get(codigo_cadastro=1)

# Filtrar
pessoas_sp = Pessoa.objects.filter(estado="SP")

# Atualizar
p.nome_completo = "Teste Atualizado"
p.save()

# Deletar
p.delete()
```

---

## 📚 Recursos Adicionais

### Documentação Oficial
- **Django ORM**: https://docs.djangoproject.com/en/stable/topics/db/
- **Queries**: https://docs.djangoproject.com/en/stable/topics/db/queries/
- **Migrations**: https://docs.djangoproject.com/en/stable/topics/migrations/

### Tipos de Campos Disponíveis
- `CharField` - Texto curto
- `TextField` - Texto longo
- `IntegerField` - Números inteiros
- `DecimalField` - Números decimais
- `BooleanField` - True/False
- `DateField` - Data
- `DateTimeField` - Data e hora
- `EmailField` - Email validado
- `ForeignKey` - Relacionamento 1-N
- `ManyToManyField` - Relacionamento N-N
- E muitos outros...

---

## ✅ Conclusão

**O projeto JÁ USA Django ORM** e está funcionando perfeitamente! Não é necessário instalar nenhuma biblioteca adicional. Todo o código já está usando o ORM para:

- ✅ Definir modelos (tabelas)
- ✅ Criar migrations
- ✅ Fazer queries (SELECT, INSERT, UPDATE, DELETE)
- ✅ Gerenciar relacionamentos
- ✅ Validação de dados

O Django ORM é uma das principais vantagens do Django e está sendo aproveitado ao máximo no projeto! 🚀

