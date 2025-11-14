# 🧪 Teste do Login Multi-Tenant

## ✅ O que foi implementado

### 1. Login Multi-Tenant
- ✅ Identificação automática de tenant pela URL/subdomínio
- ✅ Verificação de acesso do usuário ao tenant
- ✅ Autenticação no schema do tenant
- ✅ Geração de tokens JWT com informações do tenant

### 2. Seleção de Empresa/Filial
- ✅ Detecção automática se usuário tem múltiplas empresas/filiais
- ✅ Retorno de lista para seleção quando necessário
- ✅ Seleção automática quando há apenas uma opção
- ✅ Endpoint para selecionar empresa/filial após login

### 3. Endpoints Criados

#### **POST `/api/auth/login/`**
Login multi-tenant com identificação automática de tenant.

**Request:**
```json
{
  "username": "admin",
  "password": "senha123"
}
```

**Resposta (sucesso - múltiplas empresas):**
```json
{
  "access": "token...",
  "refresh": "token...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "tenant": {
    "id": 1,
    "name": "Tenant Teste",
    "schema_name": "teste"
  },
  "empresas": [
    {
      "id": 1,
      "nome": "Empresa 1",
      "filiais": [...]
    }
  ],
  "requires_selection": true
}
```

**Resposta (sucesso - empresa única):**
```json
{
  "access": "token...",
  "refresh": "token...",
  "user": {...},
  "tenant": {...},
  "empresa": {
    "id": 1,
    "nome": "Empresa 1"
  },
  "filial": {
    "id": 1,
    "nome": "Filial Central"
  },
  "requires_selection": false
}
```

#### **POST `/api/auth/select-empresa/`**
Seleciona empresa e filial após login (quando múltiplas opções).

**Request:**
```json
{
  "empresa_id": 1,
  "filial_id": 2
}
```

**Resposta:**
```json
{
  "empresa": {
    "id": 1,
    "nome": "Empresa 1"
  },
  "filial": {
    "id": 2,
    "nome": "Filial 2"
  }
}
```

#### **GET `/api/auth/me/`**
Retorna informações do usuário atual e contexto.

**Resposta:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "tenant": {
    "id": 1,
    "name": "Tenant Teste"
  },
  "empresa": {...},
  "filial": {...}
}
```

---

## 🧪 Como Testar

### 1. Testar Login (via domínio do tenant)

**Importante**: O login precisa ser feito através do domínio do tenant!

```bash
# Se o tenant tem domínio "teste123", acesse:
POST http://teste123.localhost:8000/api/auth/login/

# Ou se estiver usando subdomínios:
POST http://teste123.siscr.com.br/api/auth/login/
```

**Request:**
```json
{
  "username": "admin_teste",
  "password": "senha123456"
}
```

### 2. Testar Seleção de Empresa/Filial

Após login com múltiplas empresas:

```bash
POST http://teste123.localhost:8000/api/auth/select-empresa/
Headers: Authorization: Bearer <access_token>
Body: {
  "empresa_id": 1,
  "filial_id": 2
}
```

### 3. Testar Informações do Usuário

```bash
GET http://teste123.localhost:8000/api/auth/me/
Headers: Authorization: Bearer <access_token>
```

---

## 🔍 Fluxo Completo

1. **Usuário acessa domínio do tenant**
   - Ex: `http://teste123.localhost:8000/login`

2. **Sistema identifica tenant automaticamente**
   - Pelo subdomínio ou parâmetro na URL

3. **Usuário faz login**
   - Credenciais são validadas no schema do tenant
   - Membership é verificado no schema público

4. **Sistema verifica empresas/filiais**
   - Se múltiplas: retorna lista para seleção
   - Se única: define automaticamente

5. **Usuário é redirecionado**
   - Para dashboard com contexto correto

---

## ⚠️ Importante

### Identificação de Tenant

O sistema identifica o tenant automaticamente pela URL usando `django-tenants`. 

**Para desenvolvimento local:**
- Use parâmetro na URL: `?tenant=teste123`
- Ou configure hosts locais: `teste123.localhost`

**Para produção:**
- Use subdomínios: `teste123.siscr.com.br`
- Configure DNS e Nginx

### Usuários Duplicados

O sistema cria usuários em dois lugares:
- **Schema público**: Para TenantMembership e UserProfile
- **Schema do tenant**: Para autenticação dentro do tenant

Isso é necessário porque:
- TenantMembership precisa referenciar User no schema público
- Autenticação precisa verificar senha no schema do tenant

---

## 🐛 Problemas Conhecidos

### Erro: "Tenant não identificado"
**Causa**: Acessando URL sem identificar tenant
**Solução**: Acesse através do domínio/subdomínio do tenant

### Erro: "Usuário não tem acesso a este tenant"
**Causa**: TenantMembership não existe ou está inativo
**Solução**: Verifique no admin se o usuário tem membership ativo

### Erro: "Credenciais inválidas"
**Causa**: Senha incorreta ou usuário não existe no schema do tenant
**Solução**: Verifique se o usuário foi criado no schema do tenant

---

## ✅ Checklist de Funcionalidades

- [x] Identificação automática de tenant
- [x] Verificação de acesso ao tenant
- [x] Autenticação no schema do tenant
- [x] Geração de tokens JWT
- [x] Detecção de múltiplas empresas/filiais
- [x] Seleção automática quando única opção
- [x] Endpoint de seleção manual
- [x] Endpoint de informações do usuário

---

**Última atualização**: 2025-11-14

