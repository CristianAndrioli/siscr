# 📝 Guia: Criar Novo Tenant Manualmente (Simulando Compra)

Este guia mostra como criar manualmente um novo tenant, simulando que você está comprando o sistema.

---

## 🎯 Pré-requisitos

1. **Servidor Django rodando** (geralmente `http://localhost:8000`)
2. **Banco de dados configurado** e migrations aplicadas
3. **Planos cadastrados** no sistema (ver passo 0)

---

## ⚠️ PASSO 0: Criar Planos (Se Não Existirem)

Se você ainda não tem planos cadastrados, crie-os primeiro:

**Opção 1: Via Comando Django (Recomendado)**
```bash
# Windows (PowerShell)
python manage.py seed_subscriptions

# Ou via Docker
docker-compose exec web python manage.py seed_subscriptions
```

Isso criará 4 planos:
- **Trial** (Gratuito - 14 dias) - ID geralmente 1
- **Básico** (R$ 99/mês) - ID geralmente 2
- **Pro** (R$ 199/mês) - ID geralmente 3
- **Enterprise** (R$ 499/mês) - ID geralmente 4

**Opção 2: Via Admin Django**
1. Acesse: `http://localhost:8000/admin/`
2. Vá em **Subscriptions > Plans**
3. Clique em **Add Plan**
4. Preencha os dados do plano

---

## 📋 Passo a Passo

### **PASSO 1: Verificar Planos Disponíveis**

Primeiro, você precisa saber qual `plan_id` usar. Liste os planos disponíveis:

**Método 1: Via Navegador**
```
http://localhost:8000/api/public/plans/
```

**Método 2: Via cURL (PowerShell)**
```powershell
curl http://localhost:8000/api/public/plans/
```

**Método 3: Via Postman/Insomnia**
- **GET** `http://localhost:8000/api/public/plans/`
- Sem autenticação necessária

**Resposta esperada:**
```json
[
  {
    "id": 1,
    "name": "Básico",
    "slug": "basico",
    "description": "Plano básico para pequenas empresas",
    "price_monthly": "99.00",
    "price_yearly": "990.00",
    "max_users": 3,
    "max_empresas": 1,
    "max_filiais": 2,
    "max_storage_gb": 5,
    "is_trial": false,
    "trial_days": 0,
    "features": []
  }
]
```

**Anote o `id` do plano que você quer usar!** (exemplo: `plan_id: 1`)

---

### **PASSO 2: Verificar Disponibilidade do Domínio (Opcional)**

Antes de criar, você pode verificar se o domínio/subdomínio está disponível:

**Via cURL (PowerShell):**
```powershell
curl -X POST http://localhost:8000/api/public/check-domain/ `
  -H "Content-Type: application/json" `
  -d '{\"domain\": \"minhaempresa\"}'
```

**Via Postman/Insomnia:**
- **POST** `http://localhost:8000/api/public/check-domain/`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "domain": "minhaempresa"
}
```

**Resposta esperada:**
```json
{
  "domain": "minhaempresa",
  "available": true,
  "message": "Domínio disponível"
}
```

**⚠️ IMPORTANTE:** 
- Em desenvolvimento, você pode usar qualquer domínio (ex: `minhaempresa`, `teste123`)
- Em produção, o domínio será um subdomínio (ex: `minhaempresa.siscr.com.br`)
- O domínio não pode conter espaços ou caracteres especiais (exceto `-` e `.`)

---

### **PASSO 3: Criar o Novo Tenant (Cadastro Completo)**

Agora vamos criar o tenant completo com todos os dados.

**Endpoint:** `POST http://localhost:8000/api/public/signup/`

**Via cURL (PowerShell):**
```powershell
curl -X POST http://localhost:8000/api/public/signup/ `
  -H "Content-Type: application/json" `
  -d '{
    \"tenant_name\": \"Minha Empresa LTDA\",
    \"domain\": \"minhaempresa\",
    \"plan_id\": 1,
    \"admin_username\": \"admin\",
    \"admin_email\": \"admin@minhaempresa.com\",
    \"admin_password\": \"SenhaSegura123!\",
    \"admin_first_name\": \"João\",
    \"admin_last_name\": \"Silva\",
    \"empresa_nome\": \"Minha Empresa LTDA\",
    \"empresa_cnpj\": \"12.345.678/0001-90\",
    \"empresa_razao_social\": \"Minha Empresa LTDA\"
  }'
```

**Via Postman/Insomnia:**
- **POST** `http://localhost:8000/api/public/signup/`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "tenant_name": "Minha Empresa LTDA",
  "domain": "minhaempresa",
  "plan_id": 1,
  "admin_username": "admin",
  "admin_email": "admin@minhaempresa.com",
  "admin_password": "SenhaSegura123!",
  "admin_first_name": "João",
  "admin_last_name": "Silva",
  "empresa_nome": "Minha Empresa LTDA",
  "empresa_cnpj": "12.345.678/0001-90",
  "empresa_razao_social": "Minha Empresa LTDA"
}
```

---

## 📝 Campos do Formulário (Explicação)

### **Campos Obrigatórios:**

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `tenant_name` | string | Nome do cliente/tenant | `"Minha Empresa LTDA"` |
| `domain` | string | Subdomínio único (sem espaços) | `"minhaempresa"` |
| `plan_id` | integer | ID do plano escolhido | `1` |
| `admin_username` | string | Username do admin | `"admin"` |
| `admin_email` | string | Email do admin | `"admin@minhaempresa.com"` |
| `admin_password` | string | Senha do admin | `"SenhaSegura123!"` |
| `empresa_nome` | string | Nome da empresa | `"Minha Empresa LTDA"` |

### **Campos Opcionais:**

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `admin_first_name` | string | Primeiro nome do admin | `"João"` |
| `admin_last_name` | string | Sobrenome do admin | `"Silva"` |
| `empresa_cnpj` | string | CNPJ da empresa | `"12.345.678/0001-90"` |
| `empresa_razao_social` | string | Razão social | `"Minha Empresa LTDA"` |

---

## ✅ Resposta de Sucesso

Se tudo der certo, você receberá:

```json
{
  "success": true,
  "message": "Cadastro realizado com sucesso!",
  "tenant": {
    "id": 2,
    "name": "Minha Empresa LTDA",
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

## 🔍 O que foi criado automaticamente?

Quando o cadastro é bem-sucedido, o sistema cria:

1. ✅ **Tenant** - Cliente principal no schema público
2. ✅ **Domain** - Domínio/subdomínio vinculado
3. ✅ **Schema PostgreSQL** - Schema isolado no banco (ex: `minhaempresa`)
4. ✅ **User (Admin)** - Usuário administrador no schema do tenant
5. ✅ **Empresa** - Primeira empresa do tenant
6. ✅ **Subscription** - Assinatura vinculada ao plano
7. ✅ **QuotaUsage** - Controle de quotas e limites

---

## 🧪 Como Testar o Cadastro

### **1. Verificar no Admin Django**

Acesse: `http://localhost:8000/admin/`

- **Tenants > Tenants** - Deve aparecer o novo tenant
- **Tenants > Domains** - Deve aparecer o novo domínio
- **Subscriptions > Subscriptions** - Deve aparecer a nova assinatura
- **Subscriptions > Quota Usages** - Deve aparecer o controle de quotas

### **2. Fazer Login no Tenant**

**Em desenvolvimento (localhost):**

Se você configurou hosts locais, acesse:
```
http://minhaempresa.localhost:8000/api/auth/login/
```

Ou use o domínio diretamente (se configurado):
```
http://minhaempresa:8000/api/auth/login/
```

**Dados de login:**
- **Username:** `admin` (ou o que você definiu)
- **Password:** `SenhaSegura123!` (ou o que você definiu)

**Request de Login:**
```json
{
  "username": "admin",
  "password": "SenhaSegura123!"
}
```

---

## ⚠️ Erros Comuns e Soluções

### **Erro: "Campos obrigatórios não preenchidos"**
- **Causa:** Algum campo obrigatório está faltando ou vazio
- **Solução:** Verifique se todos os campos obrigatórios estão preenchidos

### **Erro: "Domínio já está em uso"**
- **Causa:** O domínio escolhido já existe
- **Solução:** Escolha outro domínio (ex: `minhaempresa2`, `teste123`)

### **Erro: "Email já está cadastrado"**
- **Causa:** O email já está em uso por outro tenant
- **Solução:** Use outro email (ex: `admin2@minhaempresa.com`)

### **Erro: "Username já está cadastrado"**
- **Causa:** O username já está em uso
- **Solução:** Use outro username (ex: `admin_minhaempresa`)

### **Erro: "Plano inválido ou inativo"**
- **Causa:** O `plan_id` não existe ou está inativo
- **Solução:** Verifique os planos disponíveis no passo 1 e use um `plan_id` válido

---

## 📋 Exemplo Completo de Dados

Aqui está um exemplo completo que você pode copiar e colar:

```json
{
  "tenant_name": "Prefeitura Municipal de Teste",
  "domain": "prefeitura-teste",
  "plan_id": 1,
  "admin_username": "admin_prefeitura",
  "admin_email": "admin@prefeitura-teste.com.br",
  "admin_password": "Admin@123456",
  "admin_first_name": "Maria",
  "admin_last_name": "Santos",
  "empresa_nome": "Prefeitura Municipal de Teste",
  "empresa_cnpj": "12.345.678/0001-90",
  "empresa_razao_social": "Prefeitura Municipal de Teste"
}
```

---

## 🎯 Próximos Passos Após Criar

1. ✅ **Fazer login** no tenant criado
2. ✅ **Verificar empresa** criada automaticamente
3. ✅ **Criar filiais** (se necessário)
4. ✅ **Adicionar mais usuários** ao tenant
5. ✅ **Configurar dados** da empresa

---

## 💡 Dicas

- **Domínios em desenvolvimento:** Use nomes simples sem pontos (ex: `minhaempresa`, `teste123`)
- **Senhas:** Use senhas fortes para produção
- **Emails:** Em desenvolvimento, pode usar emails fictícios
- **CNPJ:** Em desenvolvimento, pode usar CNPJs fictícios (formato válido)

---

**Última atualização:** 2025-01-14

