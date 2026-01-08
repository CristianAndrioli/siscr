# 🛡️ Rate Limiting para Segurança

## ✅ O que foi implementado

### 1. Biblioteca django-ratelimit
- ✅ Instalada e configurada
- ✅ Integrada com cache do Django

### 2. Rate Limits Configurados

#### Login (`/api/auth/login/`)
- **Limite**: 5 tentativas por 15 minutos por IP
- **Objetivo**: Prevenir brute force attacks

#### Password Reset (`/api/auth/password-reset/`)
- **Limite**: 3 tentativas por hora por IP
- **Objetivo**: Prevenir spam de emails

#### Password Reset Confirm (`/api/auth/password-reset-confirm/`)
- **Limite**: 3 tentativas por hora por IP
- **Objetivo**: Prevenir tentativas de reset maliciosas

#### Signup (`/api/public/signup/`)
- **Limite**: 3 tentativas por hora por IP
- **Objetivo**: Prevenir criação massiva de contas

---

## 🔧 Como Funciona

### Decoradores Aplicados

```python
# accounts/views.py
@rate_limit_login  # 5 tentativas / 15 minutos
def login(request):
    ...

@rate_limit_password_reset  # 3 tentativas / hora
def password_reset_request(request):
    ...

# public/views.py
@ratelimit(key='ip', rate='3/h', method='POST', block=True)
def signup(request):
    ...
```

### Chave de Identificação

- **IP Address**: Usado como chave padrão
- **Método**: Apenas requisições POST são limitadas
- **Bloqueio**: `block=True` retorna erro 429 quando limite excedido

---

## 🧪 Como Testar

### 1. Testar Rate Limit de Login

```bash
# Tentar fazer login 6 vezes rapidamente
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/auth/login/ \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done
```

**Resultado esperado:**
- Primeiras 5 tentativas: Erro 401 (credenciais inválidas)
- 6ª tentativa: Erro 429 (Too Many Requests)

### 2. Testar Rate Limit de Signup

```bash
# Tentar criar conta 4 vezes rapidamente
for i in {1..4}; do
  curl -X POST http://localhost:8000/api/public/signup/ \
    -H "Content-Type: application/json" \
    -d '{"tenant_name":"test","domain":"test'$i'",...}'
done
```

**Resultado esperado:**
- Primeiras 3 tentativas: Sucesso ou erro de validação
- 4ª tentativa: Erro 429 (Too Many Requests)

### 3. Verificar Resposta de Rate Limit

Quando o limite é excedido, a resposta é:

```json
{
  "detail": "Request was throttled. Expected available in X seconds."
}
```

Status: **429 Too Many Requests**

---

## ⚙️ Configuração

### Settings (`siscr/settings.py`)

```python
# Rate Limiting
RATELIMIT_USE_CACHE = 'default'  # Usa cache padrão
RATELIMIT_ENABLE = True
RATELIMIT_SWITCH_OFF = False
```

### Cache (Recomendado: Redis em Produção)

Para produção, configure Redis:

```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

Para desenvolvimento, pode usar cache em memória:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
```

---

## 📊 Limites Configurados

| Endpoint | Limite | Período | Objetivo |
|----------|--------|---------|----------|
| `/api/auth/login/` | 5 | 15 minutos | Prevenir brute force |
| `/api/auth/password-reset/` | 3 | 1 hora | Prevenir spam de emails |
| `/api/auth/password-reset-confirm/` | 3 | 1 hora | Prevenir tentativas maliciosas |
| `/api/public/signup/` | 3 | 1 hora | Prevenir criação massiva |

---

## 🔍 Personalização

### Ajustar Limites

Edite os decoradores em `accounts/decorators.py`:

```python
# Exemplo: Aumentar limite de login
@ratelimit(key='ip', rate='10/15m', method='POST', block=True)
def login(request):
    ...
```

### Rate Limit por Usuário (em vez de IP)

```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='user', rate='5/15m', method='POST', block=True)
def login(request):
    ...
```

### Rate Limit por Email

```python
@ratelimit(key='post:email', rate='3/h', method='POST', block=True)
def password_reset_request(request):
    ...
```

---

## ⚠️ Importante

### Desenvolvimento

Em desenvolvimento, o rate limiting pode ser desabilitado:

```python
# settings.py
RATELIMIT_SWITCH_OFF = True  # Desabilita rate limiting
```

### Produção

Em produção:
- ✅ Use Redis para cache (melhor performance)
- ✅ Configure limites apropriados
- ✅ Monitore logs de rate limiting
- ✅ Ajuste limites baseado em uso real

### Mensagens de Erro

O django-ratelimit retorna erro 429 automaticamente quando o limite é excedido. A mensagem padrão é:

```
"Request was throttled. Expected available in X seconds."
```

---

## ✅ Checklist

- [x] django-ratelimit instalado
- [x] Rate limit em login (5/15m)
- [x] Rate limit em password reset (3/h)
- [x] Rate limit em signup (3/h)
- [x] Cache configurado
- [x] Documentação criada

---

**Última atualização**: 2025-11-14

