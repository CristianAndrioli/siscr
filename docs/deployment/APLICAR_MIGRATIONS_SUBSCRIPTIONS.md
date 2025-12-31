# 🔄 Aplicar Migrations e Criar Dados de Assinaturas

## 🚀 Passo a Passo

### 1. Certifique-se que o Docker está rodando

```bash
# Verificar se os containers estão rodando
docker-compose ps
```

Se não estiverem rodando:
```bash
docker-compose up -d
```

### 2. Aplicar Migrations no Schema Público

```bash
# Windows (PowerShell ou CMD)
docker-compose exec web python manage.py migrate_schemas --shared

# Linux/Mac
docker compose exec web python manage.py migrate_schemas --shared
```

### 3. Criar Dados de Exemplo

```bash
# Windows
docker-compose exec web python manage.py seed_subscriptions

# Linux/Mac
docker compose exec web python manage.py seed_subscriptions
```

### 4. Verificar no Admin

Acesse: http://localhost:8000/admin/subscriptions/

Você deve ver:
- ✅ **Features**: 10 funcionalidades criadas
- ✅ **Plans**: 4 planos criados (Trial, Básico, Pro, Enterprise)
- ✅ **Subscriptions**: Assinaturas criadas para tenants existentes
- ✅ **Quota Usages**: Quotas de uso criadas

---

## 📋 O que será criado

### Funcionalidades (10)
- Cadastro de Pessoas
- Cadastro de Produtos
- Cadastro de Serviços
- Faturamento
- Financeiro
- Serviços Logísticos
- Relatórios Avançados
- API Access
- Suporte Prioritário
- Backup Automatizado

### Planos (4)

**1. Trial (Gratuito - 14 dias)**
- R$ 0,00
- 2 usuários
- 1 empresa
- 1 filial
- 1 GB de armazenamento

**2. Básico**
- R$ 99,00/mês ou R$ 990,00/ano
- 3 usuários
- 1 empresa
- 2 filiais
- 5 GB de armazenamento

**3. Pro**
- R$ 199,00/mês ou R$ 1.990,00/ano
- 10 usuários
- 3 empresas
- 10 filiais
- 20 GB de armazenamento

**4. Enterprise**
- R$ 499,00/mês ou R$ 4.990,00/ano
- 100 usuários
- 10 empresas
- 50 filiais
- 100 GB de armazenamento

### Assinaturas
- Serão criadas automaticamente para todos os tenants existentes
- O primeiro tenant recebe plano Trial
- Os demais recebem planos distribuídos (Básico, Pro, Enterprise)

---

## 🐛 Solução de Problemas

### Erro: "relation does not exist"
**Causa**: Migrations não foram aplicadas
**Solução**: Execute o passo 2 acima

### Erro: "could not translate host name 'db'"
**Causa**: Container do banco não está rodando
**Solução**: 
```bash
docker-compose up -d db
# Aguarde alguns segundos e tente novamente
```

### Erro: "No tenant found"
**Causa**: Não há tenants criados
**Solução**: Crie tenants primeiro no admin:
1. Acesse http://localhost:8000/admin/tenants/tenant/
2. Crie pelo menos um tenant
3. Execute o seed novamente

---

## 🔄 Limpar e Recriar Dados

Se quiser limpar e recriar todos os dados:

```bash
docker-compose exec web python manage.py seed_subscriptions --clear
```

Isso vai:
1. Deletar todas as quotas de uso
2. Deletar todas as assinaturas
3. Deletar todos os planos
4. Deletar todas as funcionalidades
5. Recriar tudo do zero

---

## ✅ Verificação Final

Após executar os comandos, verifique:

1. **Admin Django**: http://localhost:8000/admin/subscriptions/
   - Deve mostrar planos, features, subscriptions e quotas

2. **Sem erros**: As páginas não devem mais dar erro "relation does not exist"

3. **Dados criados**: 
   - 10 funcionalidades
   - 4 planos
   - Assinaturas para cada tenant
   - Quotas de uso para cada tenant

---

**Última atualização**: 2025-11-14

