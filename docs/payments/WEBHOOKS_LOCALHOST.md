# 🔔 Webhooks do Stripe em Localhost

## 📡 Como Funciona

### 1. **Endpoint do Webhook**

O webhook está configurado em:
```
POST http://localhost:8000/api/webhooks/stripe/
```

Este endpoint está registrado em `siscr/public_urls.py` e é acessível sem autenticação (público).

### 2. **Stripe CLI para Desenvolvimento Local**

Como a aplicação roda em `localhost`, o Stripe não consegue enviar webhooks diretamente. Para isso, você precisa usar o **Stripe CLI**.

#### Instalação do Stripe CLI

**Windows:**
```powershell
# Via Scoop
scoop install stripe

# Ou baixar de: https://github.com/stripe/stripe-cli/releases
```

**Linux/Mac:**
```bash
# Via Homebrew (Mac)
brew install stripe/stripe-cli/stripe

# Via Snap (Linux)
snap install stripe
```

#### Login no Stripe CLI

```bash
stripe login
```

Isso abrirá o navegador para autenticar e vincular sua conta Stripe.

#### Escutar Webhooks Localmente

```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe/
```

Este comando:
- ✅ Cria um túnel que recebe webhooks do Stripe
- ✅ Encaminha para `localhost:8000/api/webhooks/stripe/`
- ✅ Mostra todos os eventos recebidos no terminal
- ✅ Gera um webhook secret (começa com `whsec_...`)

**Exemplo de saída:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
> 2025-12-20 01:30:15   --> checkout.session.completed [evt_xxxxx]
> 2025-12-20 01:30:15  <--  [200] POST http://localhost:8000/api/webhooks/stripe/ [evt_xxxxx]
```

### 3. **Configurar Webhook Secret (Opcional)**

Se quiser validar a assinatura dos webhooks (recomendado), copie o secret do Stripe CLI e adicione ao `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Nota:** Em desenvolvimento, o código aceita webhooks sem verificação se o secret não estiver configurado, mas isso é apenas para facilitar testes.

---

## 📝 Logging de Webhooks

### Onde os Webhooks são Logados?

Os webhooks são logados em **3 lugares**:

### 1. **Console do Stripe CLI** ✅
Quando você roda `stripe listen`, todos os eventos aparecem no terminal:
```
> 2025-12-20 01:30:15   --> checkout.session.completed [evt_xxxxx]
> 2025-12-20 01:30:15  <--  [200] POST http://localhost:8000/api/webhooks/stripe/ [evt_xxxxx]
```

### 2. **Logs do Django** ✅
O código agora loga todos os webhooks usando `logging`:

```python
logger.info(f"[WEBHOOK] ✅ Evento recebido: {event_type} (ID: {event_id})")
logger.info(f"[WEBHOOK] ✅ Evento {event_type} processado com sucesso")
logger.error(f"[WEBHOOK] ❌ Erro ao processar webhook {event_type}: {erro}")
```

**Onde ver os logs:**
- **Docker**: `docker-compose logs -f web`
- **Terminal**: Se rodar `python manage.py runserver`, aparecem no console
- **Arquivo de log**: Se configurar `LOGGING` no `settings.py`

### 3. **Banco de Dados** ✅
Os eventos são processados e salvos no banco:
- `Payment` - Pagamentos processados
- `Invoice` - Faturas criadas/pagas
- `Subscription` - Assinaturas atualizadas
- `PaymentMethod` - Métodos de pagamento

---

## 🔍 Verificar Webhooks Recebidos

### 1. **Via Stripe CLI**

O Stripe CLI mostra todos os eventos em tempo real:
```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe/
```

### 2. **Via Logs do Django**

```bash
# Ver logs do container
docker-compose logs -f web | grep WEBHOOK

# Ou ver todos os logs
docker-compose logs -f web
```

### 3. **Via Django Admin**

Acesse `http://localhost:8000/admin/` e verifique:
- **Payments** → Ver pagamentos processados
- **Invoices** → Ver faturas criadas
- **Subscriptions** → Ver assinaturas atualizadas

### 4. **Via API**

```bash
# Ver pagamentos
curl http://localhost:8000/api/payments/payments/ \
  -H "Authorization: Bearer SEU_TOKEN"

# Ver subscription
curl http://localhost:8000/api/subscriptions/subscription/ \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## 🧪 Testar Webhooks Manualmente

### 1. **Usando Stripe CLI**

```bash
# Enviar evento de teste
stripe trigger checkout.session.completed

# Ou eventos específicos
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
```

### 2. **Via Stripe Dashboard**

1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Clique em um evento
3. Clique em "Send test webhook"
4. O Stripe CLI receberá e encaminhará para sua aplicação

---

## ⚠️ IMPORTANTE

### Em Desenvolvimento

- ✅ Use Stripe CLI para receber webhooks
- ✅ Webhooks são logados no console e no Django logging
- ✅ Não precisa configurar webhook secret (mas é recomendado)

### Em Produção

- ⚠️ Configure webhook endpoint no Stripe Dashboard
- ⚠️ Configure `STRIPE_WEBHOOK_SECRET` no ambiente
- ⚠️ Webhooks devem ser validados (código já faz isso)
- ⚠️ Configure logging adequado (arquivo, Sentry, etc.)

---

## 📊 Eventos Suportados

| Evento | Handler | Logado? |
|--------|---------|---------|
| `checkout.session.completed` | ✅ | ✅ Sim |
| `payment_intent.succeeded` | ✅ | ✅ Sim |
| `payment_intent.payment_failed` | ✅ | ✅ Sim |
| `invoice.payment_succeeded` | ✅ | ✅ Sim |
| `invoice.payment_failed` | ✅ | ✅ Sim |
| `customer.subscription.created` | ✅ | ✅ Sim |
| `customer.subscription.updated` | ✅ | ✅ Sim |
| `customer.subscription.deleted` | ✅ | ✅ Sim |
| `payment_method.attached` | ✅ | ✅ Sim |
| `payment_method.detached` | ✅ | ✅ Sim |

---

## 🚀 Quick Start

```bash
# 1. Instalar Stripe CLI (se ainda não tiver)
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# 2. Login no Stripe
stripe login

# 3. Iniciar escuta de webhooks
stripe listen --forward-to localhost:8000/api/webhooks/stripe/

# 4. Em outro terminal, iniciar aplicação
docker-compose up

# 5. Fazer um pagamento de teste
# Os webhooks aparecerão no terminal do Stripe CLI e nos logs do Django
```

---

**Última atualização**: 2025-01-27

