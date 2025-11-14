# 🧪 Guia de Testes Manuais - Sistema SaaS

Este guia fornece instruções passo a passo para testar todas as funcionalidades do sistema SaaS.

---

## 📋 Pré-requisitos

1. **Docker rodando** com os serviços:
   - `siscr_db` (PostgreSQL)
   - `siscr_redis` (Redis)
   - `siscr_web` (Django)

2. **Verificar se está tudo rodando:**
   ```powershell
   docker-compose ps
   ```

3. **Acessar o container:**
   ```powershell
   docker-compose exec web bash
   ```

---

## 🎯 TESTE 1: Listagem de Planos (Público)

### Onde testar:
- **URL:** `http://localhost:8000/api/public/plans/`
- **Método:** GET
- **Autenticação:** Não requerida

### Como testar:

**Opção 1 - PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/public/plans/" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Opção 2 - Navegador:**
- Abra: `http://localhost:8000/api/public/plans/`
- Deve retornar JSON com lista de planos

**Opção 3 - curl:**
```powershell
curl http://localhost:8000/api/public/plans/
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON com array de planos contendo:
  - `id`, `name`, `slug`, `description`
  - `price_monthly`, `price_yearly`
  - `max_users`, `max_empresas`, `max_filiais`
  - `features` (array)

---

## 🎯 TESTE 2: Verificação de Domínio (Público)

### Onde testar:
- **URL:** `http://localhost:8000/api/public/check-domain/`
- **Método:** POST
- **Autenticação:** Não requerida

### Como testar:

**PowerShell:**
```powershell
$headers = @{"Content-Type"="application/json"}
$body = '{"domain":"meu-tenant-teste"}'
Invoke-WebRequest -Uri "http://localhost:8000/api/public/check-domain/" -Method POST -Headers $headers -Body $body -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON: `{"available": true}` ou `{"available": false, "message": "Domínio já está em uso"}`

---

## 🎯 TESTE 3: Cadastro Público (Signup)

### Onde testar:
- **URL:** `http://localhost:8000/api/public/signup/`
- **Método:** POST
- **Autenticação:** Não requerida

### Como testar:

**PowerShell:**
```powershell
$headers = @{"Content-Type"="application/json"}
$body = @{
    tenant_name = "Meu Tenant Teste"
    domain = "meu-tenant-teste"
    plan_id = 1
    admin_username = "admin_teste"
    admin_email = "admin@teste.com"
    admin_password = "senha123456"
    admin_first_name = "Admin"
    admin_last_name = "Teste"
    empresa_nome = "Empresa Teste LTDA"
    empresa_cnpj = "12345678000190"
    empresa_razao_social = "Empresa Teste LTDA"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/public/signup/" -Method POST -Headers $headers -Body $body -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 201 Created
- JSON com:
  - `success: true`
  - `message: "Cadastro realizado com sucesso!"`
  - `tenant: {id, name, domain}`
  - `user: {username, email}`
  - `subscription: {plan, status, expires_at}`
  - `login_url`

### ⚠️ Possíveis erros:
- **400:** Campos obrigatórios faltando
- **400:** Domínio já em uso
- **400:** Email/username já cadastrado
- **500:** Erro interno (verificar logs do Docker)

---

## 🎯 TESTE 4: Criar Tenant de Teste Manualmente

### Onde executar:
- **Dentro do container Docker**

### Como executar:

1. **Acessar o container:**
   ```powershell
   docker-compose exec web bash
   ```

2. **Executar o comando:**
   ```bash
   python manage.py create_test_tenant
   ```

### ✅ Resultado esperado:
- Mensagens de sucesso:
  - ✅ Tenant criado
  - ✅ Domínio criado
  - ✅ Usuário público criado
  - ✅ Membership criado
  - ✅ Usuário no tenant criado
  - ✅ Empresa criada

### 📝 Credenciais criadas:
- **Username:** `teste_user`
- **Password:** `senha123`
- **Domínio:** `teste-tenant.localhost`

---

## 🎯 TESTE 5: Login Multi-Tenant

### Onde testar:
- **URL:** `http://teste-tenant.localhost:8000/api/auth/login/`
- **Método:** POST
- **Autenticação:** Não requerida (mas retorna token)

### ⚠️ IMPORTANTE - Configurar hosts:

**Windows:**
1. Abra o Notepad como Administrador
2. Abra o arquivo: `C:\Windows\System32\drivers\etc\hosts`
3. Adicione a linha:
   ```
   127.0.0.1    teste-tenant.localhost
   ```
4. Salve o arquivo

**Alternativa (sem modificar hosts):**
- Use path-based: `http://localhost:8000/teste-tenant/api/auth/login/`
- Mas precisa configurar django-tenants para path-based routing

### Como testar:

**PowerShell:**
```powershell
$headers = @{"Content-Type"="application/json"}
$body = '{"username":"teste_user","password":"senha123"}'
$response = Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/login/" -Method POST -Headers $headers -Body $body -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON com:
  - `access`: Token JWT de acesso
  - `refresh`: Token JWT de refresh
  - `user`: {id, username, email, first_name, last_name}
  - `tenant`: {id, name, schema_name}
  - `role`: "admin"
  - `empresa`: {id, nome, razao_social} (se apenas uma)
  - `filial`: {id, nome} (se apenas uma)
  - `requires_selection`: true/false

### ⚠️ Possíveis erros:
- **400:** Tenant não identificado (verificar domínio/hosts)
- **401:** Credenciais inválidas
- **403:** Usuário não tem acesso a este tenant
- **403:** Tenant inativo

---

## 🎯 TESTE 6: Informações do Usuário Atual (/api/auth/me/)

### Onde testar:
- **URL:** `http://teste-tenant.localhost:8000/api/auth/me/`
- **Método:** GET
- **Autenticação:** **REQUERIDA** (Bearer Token)

### Como testar:

1. **Primeiro, faça login (TESTE 5)** e copie o `access` token

2. **Fazer requisição:**
```powershell
$headers = @{
    "Content-Type"="application/json"
    "Authorization"="Bearer SEU_ACCESS_TOKEN_AQUI"
}
Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/me/" -Method GET -Headers $headers -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON com informações completas do usuário:
  - `id`, `username`, `email`
  - `profile`: {current_tenant, current_empresa, current_filial}
  - `tenant_memberships`: [array de tenants do usuário]

---

## 🎯 TESTE 7: Seleção de Empresa/Filial

### Onde testar:
- **URL:** `http://teste-tenant.localhost:8000/api/auth/select-empresa/`
- **Método:** POST
- **Autenticação:** **REQUERIDA** (Bearer Token)

### Como testar:

```powershell
$headers = @{
    "Content-Type"="application/json"
    "Authorization"="Bearer SEU_ACCESS_TOKEN_AQUI"
}
$body = '{"empresa_id":1,"filial_id":null}'
Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/select-empresa/" -Method POST -Headers $headers -Body $body -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON com:
  - `empresa`: {id, nome, razao_social}
  - `filial`: {id, nome} (se informado)

---

## 🎯 TESTE 8: Recuperação de Senha - Solicitar Reset

### Onde testar:
- **URL:** `http://teste-tenant.localhost:8000/api/auth/password-reset/`
- **Método:** POST
- **Autenticação:** Não requerida

### Como testar:

```powershell
$headers = @{"Content-Type"="application/json"}
$body = '{"email":"teste@teste.com"}'
Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/password-reset/" -Method POST -Headers $headers -Body $body -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON: `{"message": "Email de recuperação enviado"}`
- **Verificar console do Docker** (em desenvolvimento, email é exibido no console)

### 📧 Email no console:
- Procure no log do Docker: `docker-compose logs web | Select-String "password"`
- Deve mostrar o link de reset com token

---

## 🎯 TESTE 9: Recuperação de Senha - Confirmar Reset

### Onde testar:
- **URL:** `http://teste-tenant.localhost:8000/api/auth/password-reset-confirm/`
- **Método:** POST
- **Autenticação:** Não requerida

### Como testar:

1. **Primeiro, faça TESTE 8** e copie o token do email/console

2. **Fazer requisição:**
```powershell
$headers = @{"Content-Type"="application/json"}
$body = @{
    uid = "UID_DO_USUARIO"
    token = "TOKEN_DO_EMAIL"
    new_password = "novaSenha123456"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/password-reset-confirm/" -Method POST -Headers $headers -Body $body -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 200 OK
- JSON: `{"message": "Senha redefinida com sucesso"}`

### ⚠️ Nota:
- `uid` e `token` vêm do email de recuperação
- Em desenvolvimento, verifique o console do Docker

---

## 🎯 TESTE 10: Middleware de Quotas

### Onde testar:
- Qualquer endpoint do tenant após expirar assinatura

### Como testar:

1. **Criar tenant com assinatura expirada:**
   ```bash
   # No container Docker
   python manage.py shell
   ```
   ```python
   from tenants.models import Tenant
   from subscriptions.models import Subscription
   from django.utils import timezone
   from datetime import timedelta
   
   tenant = Tenant.objects.get(schema_name='teste_tenant')
   subscription = tenant.subscriptions.first()
   subscription.status = 'expired'
   subscription.expires_at = timezone.now() - timedelta(days=1)
   subscription.save()
   ```

2. **Tentar acessar qualquer endpoint:**
```powershell
$headers = @{"Authorization"="Bearer SEU_TOKEN"}
Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/me/" -Method GET -Headers $headers -UseBasicParsing
```

### ✅ Resultado esperado:
- Status: 403 Forbidden
- JSON: `{"error": "Assinatura expirada ou inativa"}`

---

## 🎯 TESTE 11: Rate Limiting

### Onde testar:
- Endpoints com rate limiting:
  - `/api/auth/login/` (5 tentativas / 15 minutos)
  - `/api/auth/password-reset/` (3 tentativas / hora)
  - `/api/public/signup/` (3 tentativas / hora)

### Como testar:

**Teste de login com muitas tentativas:**
```powershell
# Executar 6 vezes seguidas com senha errada
for ($i=1; $i -le 6; $i++) {
    $headers = @{"Content-Type"="application/json"}
    $body = '{"username":"teste_user","password":"senha_errada"}'
    try {
        Invoke-WebRequest -Uri "http://teste-tenant.localhost:8000/api/auth/login/" -Method POST -Headers $headers -Body $body -UseBasicParsing
    } catch {
        Write-Host "Tentativa $i : $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 1
}
```

### ✅ Resultado esperado:
- Primeiras 5 tentativas: 401 Unauthorized
- 6ª tentativa: 429 Too Many Requests ou bloqueio

---

## 📊 Checklist de Testes

Marque conforme for testando:

- [ ] **TESTE 1:** Listagem de planos
- [ ] **TESTE 2:** Verificação de domínio
- [ ] **TESTE 3:** Cadastro público (signup)
- [ ] **TESTE 4:** Criar tenant manualmente
- [ ] **TESTE 5:** Login multi-tenant
- [ ] **TESTE 6:** Informações do usuário (/api/auth/me/)
- [ ] **TESTE 7:** Seleção de empresa/filial
- [ ] **TESTE 8:** Recuperação de senha - solicitar
- [ ] **TESTE 9:** Recuperação de senha - confirmar
- [ ] **TESTE 10:** Middleware de quotas
- [ ] **TESTE 11:** Rate limiting

---

## 🔍 Verificar Logs

Para ver logs do Django em tempo real:

```powershell
docker-compose logs -f web
```

Para ver apenas erros:

```powershell
docker-compose logs web | Select-String -Pattern "Error|Exception|Traceback" -Context 5
```

---

## 🐛 Troubleshooting

### Erro: "Tenant não identificado"
- Verificar se o domínio está no arquivo `hosts`
- Verificar se o domínio existe no banco: `SELECT * FROM tenants_domain;`

### Erro: "relation does not exist"
- Aplicar migrações: `docker-compose exec web python manage.py migrate_schemas --shared`

### Erro: "Connection refused"
- Verificar se o container está rodando: `docker-compose ps`
- Reiniciar: `docker-compose restart web`

### Erro 500 no signup
- Verificar logs: `docker-compose logs web --tail 50`
- Verificar se todas as migrações foram aplicadas

---

## 📝 Notas Importantes

1. **Em desenvolvimento**, emails são exibidos no console do Docker
2. **Tokens JWT** expiram em 60 minutos (configurável)
3. **Rate limiting** usa Redis, verifique se está rodando
4. **Tenants** precisam ter domínios configurados para funcionar
5. **Schema público** vs **Schema do tenant**: dados são isolados

---

**Última atualização:** 2025-11-14


