# 🧪 Guia: Testar Página de Signup

Este guia mostra como testar a página de signup em `http://localhost:5173/signup` e verificar se tudo está funcionando corretamente.

---

## ✅ Pré-requisitos

1. **Backend Django rodando** em `http://localhost:8000`
2. **Frontend React rodando** em `http://localhost:5173`
3. **Planos cadastrados** no banco de dados

---

## 🚀 Passo 1: Verificar se os Serviços Estão Rodando

### Backend (Django)
```bash
# Verificar se está rodando
curl http://localhost:8000/api/public/plans/
```

Se retornar uma lista de planos (mesmo que vazia), está funcionando!

### Frontend (React/Vite)
Abra no navegador: `http://localhost:5173/signup`

Se a página carregar, está funcionando!

---

## 🚀 Passo 2: Criar Planos (Se Não Existirem)

Antes de testar o signup, você precisa ter planos cadastrados:

```bash
# Via Django
python manage.py seed_subscriptions

# Ou via Docker
docker-compose exec web python manage.py seed_subscriptions
```

Isso criará 4 planos:
- **Trial** (ID: 1) - Gratuito, 14 dias
- **Básico** (ID: 2) - R$ 99/mês
- **Pro** (ID: 3) - R$ 199/mês
- **Enterprise** (ID: 4) - R$ 499/mês

---

## 🧪 Passo 3: Testar a Página de Signup

### 1. Acesse a Página

Abra no navegador:
```
http://localhost:5173/signup
```

### 2. Preencha o Formulário

Use os seguintes dados de exemplo:

#### **Seção: Plano**
- **Plano:** Selecione qualquer plano disponível (ex: "Trial" ou "Básico")

#### **Seção: Dados da Empresa**
- **Nome da Empresa:** `Minha Empresa Teste`
- **Domínio/Subdomínio:** `minha-empresa-teste`
  - Clique em **"Verificar"** para verificar se está disponível
  - Deve aparecer: ✓ Domínio disponível

#### **Seção: Dados do Administrador**
- **Username:** `admin_teste`
- **Email:** `admin@teste.com`
- **Senha:** `Senha123456!` (mínimo 8 caracteres)
- **Nome:** `João` (opcional)
- **Sobrenome:** `Silva` (opcional)

#### **Seção: Dados da Primeira Empresa**
- **Nome da Empresa:** `Minha Empresa Teste LTDA`
- **CNPJ:** `12.345.678/0001-90` (opcional)
- **Razão Social:** `Minha Empresa Teste LTDA` (opcional)

### 3. Submeter o Formulário

Clique em **"Criar Conta"**

---

## ✅ O que Deve Acontecer

### **Sucesso:**
1. Aparece uma mensagem: **"Conta Criada com Sucesso!"**
2. Após 3 segundos, redireciona para a página de login
3. O tenant foi criado no banco de dados

### **Verificar no Admin Django:**
1. Acesse: `http://localhost:8000/admin/`
2. Vá em **Tenants > Tenants**
3. Deve aparecer o novo tenant: "Minha Empresa Teste"
4. Vá em **Tenants > Domains**
5. Deve aparecer o domínio: "minha-empresa-teste"
6. Vá em **Subscriptions > Subscriptions**
7. Deve aparecer uma nova assinatura vinculada ao tenant

---

## 🔍 Verificar o que Foi Criado

### Via Admin Django

1. **Tenant:**
   - `http://localhost:8000/admin/tenants/tenant/`
   - Deve ter: Nome, Schema Name, Status Ativo

2. **Domain:**
   - `http://localhost:8000/admin/tenants/domain/`
   - Deve ter: Domain, Tenant vinculado, Is Primary

3. **Subscription:**
   - `http://localhost:8000/admin/subscriptions/subscription/`
   - Deve ter: Tenant, Plan, Status, Datas de início/fim

4. **User (no schema público):**
   - `http://localhost:8000/admin/auth/user/`
   - Deve ter o usuário admin criado

### Via Banco de Dados

```sql
-- Verificar tenant criado
SELECT * FROM public.tenants_tenant WHERE name = 'Minha Empresa Teste';

-- Verificar domínio
SELECT * FROM public.tenants_domain WHERE domain = 'minha-empresa-teste';

-- Verificar schema criado
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'minha_empresa_teste%';
```

---

## ⚠️ Problemas Comuns e Soluções

### **Erro: "Erro ao carregar planos"**

**Causa:** Backend não está rodando ou não há planos cadastrados

**Solução:**
1. Verifique se o backend está rodando: `curl http://localhost:8000/api/public/plans/`
2. Se não houver planos, execute: `python manage.py seed_subscriptions`

---

### **Erro: "Domínio já está em uso"**

**Causa:** O domínio escolhido já foi usado em outro teste

**Solução:**
- Escolha outro domínio (ex: `minha-empresa-teste-2`, `teste-123`)

---

### **Erro: "Email já está cadastrado"**

**Causa:** O email já foi usado em outro tenant

**Solução:**
- Use outro email (ex: `admin2@teste.com`, `teste@empresa.com`)

---

### **Erro: "Username já está cadastrado"**

**Causa:** O username já foi usado

**Solução:**
- Use outro username (ex: `admin_teste_2`, `admin_empresa`)

---

### **Erro: CORS ou Network Error**

**Causa:** Problema de comunicação entre frontend e backend

**Solução:**
1. Verifique se o backend está rodando em `http://localhost:8000`
2. Verifique se o frontend está rodando em `http://localhost:5173`
3. Verifique o console do navegador (F12) para ver o erro específico
4. Verifique se o proxy do Vite está configurado corretamente

---

### **Erro: "Plano inválido ou inativo"**

**Causa:** O `plan_id` não existe ou está inativo

**Solução:**
1. Verifique os planos disponíveis: `http://localhost:8000/api/public/plans/`
2. Certifique-se de que há pelo menos um plano ativo
3. Se necessário, crie planos: `python manage.py seed_subscriptions`

---

## 🧪 Teste Completo - Checklist

- [ ] Backend rodando em `http://localhost:8000`
- [ ] Frontend rodando em `http://localhost:5173`
- [ ] Planos cadastrados no banco
- [ ] Página `/signup` carrega corretamente
- [ ] Lista de planos aparece no formulário
- [ ] Verificação de domínio funciona
- [ ] Formulário valida campos obrigatórios
- [ ] Submissão cria tenant com sucesso
- [ ] Redireciona para login após sucesso
- [ ] Tenant aparece no admin Django
- [ ] Domain aparece no admin Django
- [ ] Subscription aparece no admin Django
- [ ] Schema PostgreSQL foi criado

---

## 📝 Dados de Teste Sugeridos

Para facilitar os testes, use estes dados:

```json
{
  "tenant_name": "Empresa Teste 1",
  "domain": "empresa-teste-1",
  "plan_id": 1,
  "admin_username": "admin_teste_1",
  "admin_email": "admin1@teste.com",
  "admin_password": "Senha123456!",
  "admin_first_name": "João",
  "admin_last_name": "Silva",
  "empresa_nome": "Empresa Teste 1 LTDA",
  "empresa_cnpj": "11.222.333/0001-44",
  "empresa_razao_social": "Empresa Teste 1 LTDA"
}
```

Para cada novo teste, altere:
- `domain`: `empresa-teste-2`, `empresa-teste-3`, etc.
- `admin_username`: `admin_teste_2`, `admin_teste_3`, etc.
- `admin_email`: `admin2@teste.com`, `admin3@teste.com`, etc.

---

## 🎯 Próximos Passos Após Criar o Tenant

1. **Fazer Login:**
   - Acesse: `http://localhost:5173/login`
   - Use as credenciais criadas

2. **Verificar Empresa:**
   - Após login, verifique se a empresa foi criada automaticamente

3. **Criar Filiais (se necessário):**
   - Via admin Django ou API

4. **Adicionar Mais Usuários:**
   - Via admin Django ou API

---

**Última atualização:** 2025-01-14

