# 🧪 Teste do Cadastro Público

## ✅ O que foi implementado

### 1. App `public` criado
- ✅ Views para cadastro público
- ✅ API REST pública (sem autenticação)
- ✅ URLs configuradas
- ✅ Serializers para validação

### 2. Endpoints Criados

#### **GET `/api/public/plans/`**
Lista todos os planos disponíveis para cadastro.

**Resposta:**
```json
[
  {
    "id": 1,
    "name": "Básico",
    "slug": "basico",
    "description": "...",
    "price_monthly": "99.00",
    "price_yearly": "990.00",
    "max_users": 3,
    "max_empresas": 1,
    "max_filiais": 2,
    "max_storage_gb": 5,
    "is_trial": false,
    "trial_days": 0,
    "features": [...]
  }
]
```

#### **POST `/api/public/check-domain/`**
Verifica se um domínio está disponível.

**Request:**
```json
{
  "domain": "minhaempresa"
}
```

**Resposta:**
```json
{
  "domain": "minhaempresa",
  "available": true,
  "message": "Domínio disponível"
}
```

#### **POST `/api/public/signup/`**
Cria um novo cliente (tenant) completo.

**Request:**
```json
{
  "tenant_name": "Minha Empresa",
  "domain": "minhaempresa",
  "plan_id": 1,
  "admin_username": "admin",
  "admin_email": "admin@minhaempresa.com",
  "admin_password": "senha123456",
  "admin_first_name": "João",
  "admin_last_name": "Silva",
  "empresa_nome": "Minha Empresa Ltda",
  "empresa_cnpj": "12.345.678/0001-90",
  "empresa_razao_social": "Minha Empresa Ltda"
}
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "message": "Cadastro realizado com sucesso!",
  "tenant": {
    "id": 2,
    "name": "Minha Empresa",
    "domain": "minhaempresa"
  },
  "user": {
    "username": "admin",
    "email": "admin@minhaempresa.com"
  },
  "subscription": {
    "plan": "Básico",
    "status": "active",
    "expires_at": "2025-12-14T13:30:00Z"
  },
  "login_url": "http://minhaempresa/login/"
}
```

---

## 🧪 Como Testar

### 1. Testar Listagem de Planos

```bash
curl http://localhost:8000/api/public/plans/
```

Ou acesse no navegador:
http://localhost:8000/api/public/plans/

### 2. Testar Verificação de Domínio

```bash
curl -X POST http://localhost:8000/api/public/check-domain/ \
  -H "Content-Type: application/json" \
  -d '{"domain": "teste123"}'
```

### 3. Testar Cadastro Completo

```bash
curl -X POST http://localhost:8000/api/public/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Empresa Teste",
    "domain": "teste123",
    "plan_id": 1,
    "admin_username": "admin_teste",
    "admin_email": "admin@teste.com",
    "admin_password": "senha123456",
    "admin_first_name": "Admin",
    "admin_last_name": "Teste",
    "empresa_nome": "Empresa Teste Ltda",
    "empresa_cnpj": "11.222.333/0001-44",
    "empresa_razao_social": "Empresa Teste Ltda"
  }'
```

---

## ✅ O que é criado automaticamente

Quando um novo cliente se cadastra, o sistema cria:

1. **Tenant** - Cliente principal
2. **Domain** - Domínio/subdomínio
3. **Schema** - Schema no banco de dados (isolado)
4. **User** - Usuário administrador (no schema do tenant)
5. **Empresa** - Primeira empresa do tenant
6. **Subscription** - Assinatura vinculada ao plano escolhido
7. **QuotaUsage** - Controle de quotas

---

## 🔍 Verificações

Após criar um cadastro, verifique:

1. **Admin Django**: http://localhost:8000/admin/
   - Ver novo tenant em `Tenants > Tenants`
   - Ver nova assinatura em `Subscriptions > Subscriptions`
   - Ver quota usage em `Subscriptions > Quota Usages`

2. **Schema criado**: O schema do tenant deve existir no banco

3. **Usuário criado**: O usuário admin deve existir no schema do tenant

---

## 🐛 Problemas Conhecidos

### Erro: "Domain already exists"
- **Causa**: Domínio já está em uso
- **Solução**: Escolha outro domínio

### Erro: "Email already exists"
- **Causa**: Email já está cadastrado
- **Solução**: Use outro email

### Erro: "Plan does not exist"
- **Causa**: Plano não existe ou está inativo
- **Solução**: Verifique se o plano existe e está ativo no admin

---

## 📝 Próximos Passos

1. ✅ Cadastro público implementado
2. ⏭️ Criar página frontend de signup
3. ⏭️ Expandir app accounts para multi-tenant
4. ⏭️ Implementar login multi-tenant

---

**Última atualização**: 2025-11-14

