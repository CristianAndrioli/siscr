# 🔗 URLs Públicas e por Tenant

## ✅ O que foi implementado

### 1. Separação de URLs
- ✅ `siscr/public_urls.py` - URLs para schema público
- ✅ `siscr/tenant_urls.py` - URLs para schemas de tenants
- ✅ Configuração no `settings.py`

### 2. Configuração no Settings
- ✅ `PUBLIC_SCHEMA_URLCONF = 'siscr.public_urls'`
- ✅ `TENANT_SCHEMA_URLCONF = 'siscr.tenant_urls'`

---

## 📋 Estrutura de URLs

### Schema Público (`public_urls.py`)

**Acessível quando:**
- Não há tenant identificado na URL
- Acessando domínio público (ex: `siscr.com.br`)

**Rotas disponíveis:**
- `/admin/` - Admin do schema público
- `/api/public/plans/` - Listar planos disponíveis
- `/api/public/check-domain/` - Verificar disponibilidade de domínio
- `/api/public/signup/` - Cadastro de novos clientes
- `/api/auth/token/refresh/` - Refresh token
- `/api/auth/token/verify/` - Verificar token

### Schema de Tenant (`tenant_urls.py`)

**Acessível quando:**
- Tenant identificado pela URL/subdomínio
- Acessando domínio do tenant (ex: `tenant1.siscr.com.br`)

**Rotas disponíveis:**
- `/admin/` - Admin do tenant
- `/api/auth/login/` - Login multi-tenant
- `/api/auth/select-empresa/` - Selecionar empresa/filial
- `/api/auth/me/` - Informações do usuário atual
- `/api/auth/password-reset/` - Solicitar reset de senha
- `/api/auth/password-reset-confirm/` - Confirmar reset de senha
- `/api/auth/token/refresh/` - Refresh token
- `/api/auth/token/verify/` - Verificar token
- `/api/cadastros/` - APIs de cadastros (pessoas, produtos, etc.)
- `/api/` - APIs do core

---

## 🔍 Como Funciona

### Identificação Automática

O `django-tenants` identifica automaticamente qual schema usar baseado na URL:

1. **Schema Público:**
   - Acessando `http://siscr.com.br/` (sem subdomínio)
   - Acessando `http://localhost:8000/` (sem tenant identificado)
   - Usa `public_urls.py`

2. **Schema de Tenant:**
   - Acessando `http://tenant1.siscr.com.br/` (com subdomínio)
   - Acessando `http://tenant1.localhost:8000/` (com subdomínio)
   - Usa `tenant_urls.py`

### Middleware do django-tenants

O `TenantMainMiddleware` (já configurado) faz:
1. Identifica tenant pela URL/domínio
2. Define o schema atual
3. Carrega as URLs apropriadas (`PUBLIC_SCHEMA_URLCONF` ou `TENANT_SCHEMA_URLCONF`)

---

## 🧪 Como Testar

### 1. Testar URLs Públicas

```bash
# Listar planos (schema público)
GET http://localhost:8000/api/public/plans/

# Verificar domínio (schema público)
POST http://localhost:8000/api/public/check-domain/
Body: {"domain": "teste123"}

# Cadastro público (schema público)
POST http://localhost:8000/api/public/signup/
Body: {...}
```

### 2. Testar URLs de Tenant

```bash
# Login (schema do tenant)
POST http://teste123.localhost:8000/api/auth/login/
Body: {"username": "admin", "password": "senha"}

# Cadastros (schema do tenant)
GET http://teste123.localhost:8000/api/cadastros/pessoas/
```

---

## ⚠️ Importante

### Desenvolvimento Local

Para desenvolvimento local, você pode:
1. **Usar subdomínios locais:**
   - Adicionar ao `/etc/hosts` (Linux/Mac) ou `C:\Windows\System32\drivers\etc\hosts` (Windows):
     ```
     127.0.0.1 teste123.localhost
     ```
   - Acessar: `http://teste123.localhost:8000/`

2. **Usar parâmetro na URL:**
   - O django-tenants pode ser configurado para aceitar `?tenant=teste123`
   - Verifique a configuração do `TenantMainMiddleware`

### Produção

Em produção, configure:
1. **DNS wildcard:**
   - `*.siscr.com.br` → IP do servidor

2. **Nginx/Apache:**
   - Proxy reverso para Django
   - Passa o subdomínio para o Django

3. **Django:**
   - `SHOW_PUBLIC_IF_NO_TENANT_FOUND = False` (em produção)
   - `PUBLIC_SCHEMA_URLCONF` e `TENANT_SCHEMA_URLCONF` configurados

---

## 📝 Arquivos Criados

- ✅ `siscr/public_urls.py` - URLs públicas
- ✅ `siscr/tenant_urls.py` - URLs por tenant
- ✅ Configuração em `siscr/settings.py`

---

## ✅ Checklist

- [x] Arquivo `public_urls.py` criado
- [x] Arquivo `tenant_urls.py` criado
- [x] `PUBLIC_SCHEMA_URLCONF` configurado
- [x] `TENANT_SCHEMA_URLCONF` configurado
- [x] Rotas públicas separadas
- [x] Rotas de tenant separadas
- [x] Documentação criada

---

**Última atualização**: 2025-11-14

