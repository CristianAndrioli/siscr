# 🔧 Variáveis de Ambiente por Ambiente

## 📋 Ambientes Suportados

1. **development** - Desenvolvimento local (localhost)
2. **homologation** - Homologação (para analistas)
3. **preprod** - Pré-produção (entre cliente e analistas)
4. **production** - Produção

---

## 🔑 Variáveis por Ambiente

### 1. DEVELOPMENT (localhost)

```bash
ENVIRONMENT=development
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Stripe - Modo Simulado
STRIPE_MODE=simulated
STRIPE_SECRET_KEY_TEST=sk_test_...  # Opcional (para testes reais)
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...  # Opcional
STRIPE_WEBHOOK_SECRET_TEST=whsec_...  # Opcional

# Database
DB_NAME=siscr_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432

# Email (console)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Frontend
FRONTEND_URL=http://localhost:5173
```

**Características:**
- ✅ Stripe em modo **simulado** (não faz chamadas reais)
- ✅ Email no console
- ✅ Debug habilitado
- ✅ Permite localhost

---

### 2. HOMOLOGATION (analistas)

```bash
ENVIRONMENT=homologation
DEBUG=False
ALLOWED_HOSTS=homolog.siscr.com.br

# Stripe - Modo Test
STRIPE_MODE=test
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...

# Database
DB_NAME=siscr_db_homolog
DB_USER=postgres
DB_PASSWORD=senha_segura_homolog
DB_HOST=db_homolog
DB_PORT=5432

# Email (SMTP real)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@siscr.com.br
EMAIL_HOST_PASSWORD=senha_app
DEFAULT_FROM_EMAIL=SISCR <noreply@siscr.com.br>

# Frontend
FRONTEND_URL=https://homolog.siscr.com.br
```

**Características:**
- ✅ Stripe em modo **test** (usa chaves de teste)
- ✅ Email SMTP real
- ✅ Debug desabilitado
- ✅ Domínio específico

---

### 3. PREPROD (cliente + analistas)

```bash
ENVIRONMENT=preprod
DEBUG=False
ALLOWED_HOSTS=preprod.siscr.com.br

# Stripe - Modo Test
STRIPE_MODE=test
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...

# Database
DB_NAME=siscr_db_preprod
DB_USER=postgres
DB_PASSWORD=senha_segura_preprod
DB_HOST=db_preprod
DB_PORT=5432

# Email (SMTP real)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@siscr.com.br
EMAIL_HOST_PASSWORD=senha_app
DEFAULT_FROM_EMAIL=SISCR <noreply@siscr.com.br>

# Frontend
FRONTEND_URL=https://preprod.siscr.com.br
```

**Características:**
- ✅ Stripe em modo **test** (usa chaves de teste)
- ✅ Email SMTP real
- ✅ Debug desabilitado
- ✅ Domínio específico

---

### 4. PRODUCTION

```bash
ENVIRONMENT=production
DEBUG=False
ALLOWED_HOSTS=siscr.com.br,www.siscr.com.br,*.siscr.com.br

# Stripe - Modo Live
STRIPE_MODE=live
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DB_NAME=siscr_db_prod
DB_USER=postgres
DB_PASSWORD=senha_ultra_segura_prod
DB_HOST=db_prod
DB_PORT=5432

# Email (SMTP real)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@siscr.com.br
EMAIL_HOST_PASSWORD=senha_app
DEFAULT_FROM_EMAIL=SISCR <noreply@siscr.com.br>

# Frontend
FRONTEND_URL=https://siscr.com.br
```

**Características:**
- ✅ Stripe em modo **live** (chaves de produção)
- ✅ Email SMTP real
- ✅ Debug desabilitado
- ✅ Domínios de produção

---

## 🔐 Segurança

### Variáveis Sensíveis

**NUNCA** commitar no Git:
- `SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `DB_PASSWORD`
- `EMAIL_HOST_PASSWORD`

### Como Gerenciar

1. **Development**: Use `.env` local (já no `.gitignore`)
2. **Homologation/Preprod/Production**: Use variáveis de ambiente do servidor/container

---

## 📝 Exemplo de .env para Development

```bash
# .env (não commitar)
ENVIRONMENT=development
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

STRIPE_MODE=simulated

DB_NAME=siscr_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432

EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
FRONTEND_URL=http://localhost:5173
SECRET_KEY=django-insecure-dev-key-change-in-production
```

---

## 🐳 Docker Compose

Para Docker, configure no `docker-compose.yml`:

```yaml
services:
  web:
    environment:
      - ENVIRONMENT=development
      - DEBUG=True
      - STRIPE_MODE=simulated
      - DB_NAME=siscr_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
```

Ou use arquivo `.env`:

```yaml
services:
  web:
    env_file:
      - .env
```

---

## ✅ Checklist por Ambiente

### Development
- [x] ENVIRONMENT=development
- [x] STRIPE_MODE=simulated
- [x] DEBUG=True
- [x] Email no console

### Homologation
- [ ] ENVIRONMENT=homologation
- [ ] STRIPE_MODE=test
- [ ] DEBUG=False
- [ ] Email SMTP configurado
- [ ] Domínio configurado

### Preprod
- [ ] ENVIRONMENT=preprod
- [ ] STRIPE_MODE=test
- [ ] DEBUG=False
- [ ] Email SMTP configurado
- [ ] Domínio configurado

### Production
- [ ] ENVIRONMENT=production
- [ ] STRIPE_MODE=live
- [ ] DEBUG=False
- [ ] Email SMTP configurado
- [ ] Domínios de produção
- [ ] Chaves Stripe de produção

---

**Última atualização**: 2025-11-14

