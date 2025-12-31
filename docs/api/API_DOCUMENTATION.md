# 📚 Documentação da API SISCR

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [APIs Públicas](#apis-públicas)
4. [APIs de Autenticação](#apis-de-autenticação)
5. [APIs de Cadastros](#apis-de-cadastros)
6. [APIs de Pagamentos](#apis-de-pagamentos)
7. [APIs do Core](#apis-do-core)
8. [Códigos de Status HTTP](#códigos-de-status-http)
9. [Tratamento de Erros](#tratamento-de-erros)
10. [Rate Limiting](#rate-limiting)

---

## 🌐 Visão Geral

A API SISCR é uma API RESTful baseada em Django REST Framework que suporta multi-tenancy. Todas as respostas são em formato JSON.

### Base URL

- **Desenvolvimento**: `http://localhost:8000`
- **Produção**: `https://api.siscr.com.br` (a definir)

### Formato de Resposta

Todas as respostas são em JSON com a seguinte estrutura:

```json
{
  "data": {...},
  "message": "Mensagem opcional"
}
```

### Headers Comuns

```
Content-Type: application/json
Authorization: Bearer <token>
X-Tenant-Domain: <domain> (opcional, para identificar tenant)
```

---

## 🔐 Autenticação

A API usa **JWT (JSON Web Tokens)** para autenticação. Existem dois tipos de autenticação:

1. **Autenticação Multi-Tenant**: Login com identificação de tenant por domínio
2. **Autenticação JWT Padrão**: Para uso interno

### Como Obter um Token

1. Faça login através do endpoint `/api/auth/login/`
2. Receba o token de acesso (`access`) e refresh (`refresh`)
3. Use o token no header `Authorization: Bearer <access_token>`

### Renovação de Token

Quando o token expirar, use o endpoint `/api/auth/token/refresh/` com o token `refresh`.

---

## 🌍 APIs Públicas

Endpoints públicos que não requerem autenticação.

### 1. Listar Planos Disponíveis

**GET** `/api/public/plans/`

Lista todos os planos disponíveis para cadastro.

**Resposta 200 OK:**
```json
[
  {
    "id": 1,
    "name": "Plano Básico",
    "slug": "basico",
    "description": "Plano básico para pequenas empresas",
    "price_monthly": "99.00",
    "price_yearly": "990.00",
    "max_users": 5,
    "max_empresas": 1,
    "max_filiais": 0,
    "max_storage_gb": 10,
    "is_trial": false,
    "trial_days": null,
    "features": [
      {
        "name": "Cadastros básicos",
        "description": "Pessoas, produtos e serviços",
        "icon": "users"
      }
    ]
  }
]
```

### 2. Verificar Disponibilidade de Domínio

**POST** `/api/public/check-domain/`

Verifica se um domínio/subdomínio está disponível.

**Request Body:**
```json
{
  "domain": "minha-empresa"
}
```

**Resposta 200 OK:**
```json
{
  "domain": "minha-empresa",
  "available": true,
  "message": "Domínio disponível"
}
```

**Resposta 200 OK (domínio ocupado):**
```json
{
  "domain": "minha-empresa",
  "available": false,
  "message": "Domínio já está em uso"
}
```

**Validação:**
- Domínio deve conter apenas letras, números e hífens
- Mínimo de 3 caracteres

### 3. Cadastro de Novo Cliente

**POST** `/api/public/signup/`

Cria uma nova conta (tenant) com usuário administrador.

**Request Body:**
```json
{
  "tenant_name": "Minha Empresa LTDA",
  "domain": "minha-empresa",
  "plan_id": 1,
  "admin_username": "admin",
  "admin_email": "admin@empresa.com",
  "admin_password": "senhaSegura123",
  "admin_first_name": "João",
  "admin_last_name": "Silva",
  "empresa_nome": "Minha Empresa LTDA",
  "empresa_cnpj": "12.345.678/0001-90",
  "empresa_razao_social": "Minha Empresa LTDA ME"
}
```

**Campos Obrigatórios:**
- `tenant_name`: Nome da empresa/tenant
- `domain`: Domínio/subdomínio (deve estar disponível)
- `plan_id`: ID do plano escolhido
- `admin_username`: Username do administrador
- `admin_email`: Email do administrador
- `admin_password`: Senha (mínimo 8 caracteres)
- `empresa_nome`: Nome da primeira empresa

**Campos Opcionais:**
- `admin_first_name`: Primeiro nome
- `admin_last_name`: Sobrenome
- `empresa_cnpj`: CNPJ da empresa
- `empresa_razao_social`: Razão social

**Resposta 201 Created:**
```json
{
  "tenant": {
    "id": 1,
    "name": "Minha Empresa LTDA",
    "domain": "minha-empresa",
    "schema_name": "minha_empresa"
  },
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@empresa.com"
  },
  "subscription": {
    "id": 1,
    "plan_id": 1,
    "status": "active",
    "is_trial": false,
    "expires_at": "2025-12-31T23:59:59Z"
  },
  "message": "Conta criada com sucesso"
}
```

**Erros Comuns:**
- `400 Bad Request`: Dados inválidos ou domínio já em uso
- `429 Too Many Requests`: Rate limit excedido (3 tentativas/hora)

**Rate Limit:** 3 tentativas por hora por IP

---

## 🔑 APIs de Autenticação

### 1. Login Multi-Tenant

**POST** `/api/auth/login/`

Faz login identificando o tenant pelo domínio ou username.

**Request Body:**
```json
{
  "username": "admin",
  "password": "senhaSegura123",
  "domain": "minha-empresa"  // Opcional
}
```

**Resposta 200 OK:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@empresa.com",
    "first_name": "João",
    "last_name": "Silva"
  },
  "tenant": {
    "id": 1,
    "name": "Minha Empresa LTDA",
    "domain": "minha-empresa"
  }
}
```

**Erros:**
- `400 Bad Request`: Credenciais inválidas ou campos faltando
- `401 Unauthorized`: Usuário não encontrado ou senha incorreta
- `429 Too Many Requests`: Rate limit excedido (5 tentativas/15min em produção)

**Rate Limit:** 
- Desenvolvimento: 20 tentativas por 15 minutos
- Produção: 5 tentativas por 15 minutos

### 2. Obter Usuário Atual

**GET** `/api/auth/me/`

Retorna informações do usuário autenticado.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Resposta 200 OK:**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@empresa.com",
  "first_name": "João",
  "last_name": "Silva",
  "profile": {
    "current_tenant": {
      "id": 1,
      "name": "Minha Empresa LTDA",
      "domain": "minha-empresa"
    },
    "memberships": [
      {
        "tenant": {
          "id": 1,
          "name": "Minha Empresa LTDA"
        },
        "role": "admin"
      }
    ]
  }
}
```

### 3. Selecionar Empresa/Filial

**POST** `/api/auth/select-empresa/`

Seleciona a empresa/filial ativa para o usuário.

**Request Body:**
```json
{
  "empresa_id": 1
}
```

**Resposta 200 OK:**
```json
{
  "message": "Empresa selecionada com sucesso",
  "empresa": {
    "id": 1,
    "nome": "Minha Empresa LTDA",
    "cnpj": "12.345.678/0001-90"
  }
}
```

### 4. Solicitar Reset de Senha

**POST** `/api/auth/password-reset/`

Solicita reset de senha via email.

**Request Body:**
```json
{
  "email": "admin@empresa.com"
}
```

**Resposta 200 OK:**
```json
{
  "message": "Email de recuperação enviado"
}
```

**Rate Limit:** 3 tentativas por hora por IP

### 5. Confirmar Reset de Senha

**POST** `/api/auth/password-reset-confirm/`

Confirma o reset de senha com o token recebido por email.

**Request Body:**
```json
{
  "uid": "base64_encoded_user_id",
  "token": "password_reset_token",
  "new_password": "novaSenhaSegura123"
}
```

**Resposta 200 OK:**
```json
{
  "message": "Senha alterada com sucesso"
}
```

**Rate Limit:** 3 tentativas por hora por IP

### 6. Refresh Token

**POST** `/api/auth/token/refresh/`

Renova o token de acesso usando o refresh token.

**Request Body:**
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Resposta 200 OK:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 7. Verificar Token

**POST** `/api/auth/token/verify/`

Verifica se um token é válido.

**Request Body:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Resposta 200 OK:**
```json
{}
```

---

## 📝 APIs de Cadastros

Endpoints para gerenciar cadastros (Pessoas, Produtos, Serviços, Contas a Receber/Pagar).

**Base URL:** `/api/cadastros/`

Todos os endpoints requerem autenticação.

### Pessoas

#### Listar Pessoas

**GET** `/api/cadastros/pessoas/`

**Query Parameters:**
- `search`: Busca por nome, email, cpf/cnpj
- `page`: Número da página
- `page_size`: Itens por página

**Resposta 200 OK:**
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/cadastros/pessoas/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "nome": "João Silva",
      "tipo": "F",
      "cpf": "123.456.789-00",
      "email": "joao@email.com",
      "telefone": "(11) 99999-9999"
    }
  ]
}
```

#### Criar Pessoa

**POST** `/api/cadastros/pessoas/`

**Request Body:**
```json
{
  "nome": "João Silva",
  "tipo": "F",
  "cpf": "123.456.789-00",
  "email": "joao@email.com",
  "telefone": "(11) 99999-9999"
}
```

#### Obter Pessoa

**GET** `/api/cadastros/pessoas/{id}/`

#### Atualizar Pessoa

**PUT** `/api/cadastros/pessoas/{id}/` ou **PATCH** `/api/cadastros/pessoas/{id}/`

#### Deletar Pessoa

**DELETE** `/api/cadastros/pessoas/{id}/`

### Produtos

Endpoints similares para produtos:

- **GET** `/api/cadastros/produtos/` - Listar
- **POST** `/api/cadastros/produtos/` - Criar
- **GET** `/api/cadastros/produtos/{id}/` - Obter
- **PUT/PATCH** `/api/cadastros/produtos/{id}/` - Atualizar
- **DELETE** `/api/cadastros/produtos/{id}/` - Deletar

### Serviços

Endpoints similares para serviços:

- **GET** `/api/cadastros/servicos/` - Listar
- **POST** `/api/cadastros/servicos/` - Criar
- **GET** `/api/cadastros/servicos/{id}/` - Obter
- **PUT/PATCH** `/api/cadastros/servicos/{id}/` - Atualizar
- **DELETE** `/api/cadastros/servicos/{id}/` - Deletar

### Contas a Receber

- **GET** `/api/cadastros/contas-receber/` - Listar
- **POST** `/api/cadastros/contas-receber/` - Criar
- **GET** `/api/cadastros/contas-receber/{id}/` - Obter
- **PUT/PATCH** `/api/cadastros/contas-receber/{id}/` - Atualizar
- **DELETE** `/api/cadastros/contas-receber/{id}/` - Deletar

### Contas a Pagar

- **GET** `/api/cadastros/contas-pagar/` - Listar
- **POST** `/api/cadastros/contas-pagar/` - Criar
- **GET** `/api/cadastros/contas-pagar/{id}/` - Obter
- **PUT/PATCH** `/api/cadastros/contas-pagar/{id}/` - Atualizar
- **DELETE** `/api/cadastros/contas-pagar/{id}/` - Deletar

---

## 💳 APIs de Pagamentos

**Base URL:** `/api/payments/`

Todos os endpoints requerem autenticação.

### 1. Listar Métodos de Pagamento

**GET** `/api/payments/payment-methods/`

Retorna os métodos de pagamento cadastrados do usuário.

### 2. Criar Método de Pagamento

**POST** `/api/payments/payment-methods/create/`

Cria um novo método de pagamento (cartão de crédito).

### 3. Listar Pagamentos

**GET** `/api/payments/payments/`

Lista histórico de pagamentos.

### 4. Listar Faturas

**GET** `/api/payments/invoices/`

Lista faturas/invoices.

### 5. Criar Sessão de Checkout

**POST** `/api/payments/checkout/create/`

Cria uma sessão de checkout no Stripe.

**Request Body:**
```json
{
  "plan_id": 1,
  "success_url": "https://app.siscr.com.br/checkout/success",
  "cancel_url": "https://app.siscr.com.br/checkout/cancel"
}
```

**Resposta 200 OK:**
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_test_..."
}
```

### 6. Obter Sessão de Checkout

**GET** `/api/payments/checkout/session/{session_id}/`

Retorna informações de uma sessão de checkout.

### 7. Obter Assinatura Atual

**GET** `/api/payments/subscriptions/current/`

Retorna a assinatura ativa do tenant.

### 8. Atualizar Assinatura

**POST** `/api/payments/subscriptions/update/`

Atualiza o plano da assinatura.

### 9. Cancelar Assinatura

**POST** `/api/payments/subscriptions/cancel/`

Cancela a assinatura atual.

### 10. Reativar Assinatura

**POST** `/api/payments/subscriptions/reactivate/`

Reativa uma assinatura cancelada.

---

## ⚙️ APIs do Core

### 1. Health Check

**GET** `/api/health/`

Verifica o status dos serviços (banco de dados, cache, etc.).

**Resposta 200 OK:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "cache": {
      "status": "healthy",
      "message": "Cache (Redis) connection successful"
    },
    "configuration": {
      "status": "healthy",
      "message": "Required settings are configured"
    }
  }
}
```

**Resposta 503 Service Unavailable:**
Retornada quando algum serviço está indisponível.

### 2. API Root

**GET** `/api/`

Endpoint raiz da API (requer autenticação).

**Resposta 200 OK:**
```json
{
  "message": "SISCR API",
  "version": "1.0.0",
  "user": "admin",
  "endpoints": {
    "auth": "/api/auth/",
    "health": "/api/health/"
  }
}
```

### 3. Backup do Tenant

**POST** `/api/tenant/backup/`

Cria um backup do tenant atual (apenas para admins do tenant).

**Resposta 200 OK:**
Retorna um arquivo ZIP para download.

### 4. Informações de Backup

**GET** `/api/tenant/backup-info/`

Retorna informações sobre backups disponíveis.

---

## 📊 Códigos de Status HTTP

| Código | Significado | Quando Usar |
|--------|-------------|-------------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Dados inválidos na requisição |
| 401 | Unauthorized | Token inválido ou ausente |
| 403 | Forbidden | Sem permissão para acessar o recurso |
| 404 | Not Found | Recurso não encontrado |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro interno do servidor |
| 503 | Service Unavailable | Serviço temporariamente indisponível |

---

## ⚠️ Tratamento de Erros

Todas as respostas de erro seguem o formato:

```json
{
  "error": "Mensagem de erro",
  "detail": "Detalhes adicionais (em modo DEBUG)"
}
```

### Exemplos de Erros

**400 Bad Request:**
```json
{
  "error": "Campos obrigatórios faltando: email, password"
}
```

**401 Unauthorized:**
```json
{
  "error": "Credenciais inválidas"
}
```

**403 Forbidden:**
```json
{
  "error": "Você não tem permissão para executar essa ação."
}
```

**404 Not Found:**
```json
{
  "error": "Recurso não encontrado"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Request was throttled. Expected available in 300 seconds."
}
```

---

## 🚦 Rate Limiting

A API implementa rate limiting para proteger contra abuso:

| Endpoint | Limite | Período |
|----------|--------|---------|
| `/api/auth/login/` | 5 (prod) / 20 (dev) | 15 minutos |
| `/api/auth/password-reset/` | 3 | 1 hora |
| `/api/auth/password-reset-confirm/` | 3 | 1 hora |
| `/api/public/signup/` | 3 | 1 hora |

Quando o limite é excedido, a API retorna `429 Too Many Requests` com a mensagem indicando quando a requisição estará disponível novamente.

---

## 📖 Exemplos de Uso

### Exemplo Completo: Criar Conta e Fazer Login

```bash
# 1. Verificar disponibilidade de domínio
curl -X POST http://localhost:8000/api/public/check-domain/ \
  -H "Content-Type: application/json" \
  -d '{"domain": "minha-empresa"}'

# 2. Criar conta
curl -X POST http://localhost:8000/api/public/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Minha Empresa",
    "domain": "minha-empresa",
    "plan_id": 1,
    "admin_username": "admin",
    "admin_email": "admin@empresa.com",
    "admin_password": "senhaSegura123",
    "empresa_nome": "Minha Empresa LTDA"
  }'

# 3. Fazer login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "senhaSegura123",
    "domain": "minha-empresa"
  }'

# 4. Usar token para acessar API
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer <access_token>"
```

---

## 🔗 Links Úteis

- [Django REST Framework Documentation](https://www.django-rest-framework.org/)
- [JWT Authentication](https://django-rest-framework-simplejwt.readthedocs.io/)
- [Multi-Tenancy with django-tenants](https://django-tenants.readthedocs.io/)

---

**Última atualização:** 2025-01-15

