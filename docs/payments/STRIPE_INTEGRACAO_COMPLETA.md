# 💳 Integração Completa com Stripe

## 📋 Configuração Inicial

### 1. Chaves do Stripe

Configure as chaves via variáveis de ambiente:

**Desenvolvimento/Homologação:**
- Configure `STRIPE_SECRET_KEY_TEST` e `STRIPE_PUBLISHABLE_KEY_TEST` no `.env` ou variáveis de ambiente
- Obtenha as chaves no [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)

**Produção:**
- Configure `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY` via variáveis de ambiente
- Obtenha as chaves no [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

**⚠️ IMPORTANTE**: Nunca commite chaves secretas no repositório. Use variáveis de ambiente ou arquivos `.env` (que devem estar no `.gitignore`).

### 2. Stripe Price IDs dos Planos

Os seguintes Price IDs estão configurados no Stripe:

| Plano | Price ID |
|-------|----------|
| **Enterprise** | `price_1Sf4JfJcxPm9Lx7v6TTz8Cnw` |
| **Pro** | `price_1Sf4J9JcxPm9Lx7v9NtCcRVD` |
| **Básico** | `price_1Sf4IvJcxPm9Lx7vXxU5I1GR` |
| **Trial** | `price_1Sf4IGJcxPm9Lx7vn3fxiwGo` |

**⚠️ IMPORTANTE**: Você precisa atualizar os planos no banco de dados para associar esses Price IDs.

---

## 🔧 Configuração dos Planos no Banco de Dados

### Atualizar Planos com Stripe Price IDs

Execute no Django Admin ou via shell:

```python
from subscriptions.models import Plan

# Atualizar plano Básico
basico = Plan.objects.get(slug='basico')
basico.stripe_price_id_monthly = 'price_1Sf4IvJcxPm9Lx7vXxU5I1GR'
basico.save()

# Atualizar plano Pro
pro = Plan.objects.get(slug='pro')
pro.stripe_price_id_monthly = 'price_1Sf4J9JcxPm9Lx7v9NtCcRVD'
pro.save()

# Atualizar plano Enterprise
enterprise = Plan.objects.get(slug='enterprise')
enterprise.stripe_price_id_monthly = 'price_1Sf4JfJcxPm9Lx7v6TTz8Cnw'
enterprise.save()

# Atualizar plano Trial
trial = Plan.objects.get(slug='trial')
trial.stripe_price_id_monthly = 'price_1Sf4IGJcxPm9Lx7vn3fxiwGo'
trial.save()
```

---

## 🧪 Testando com Stripe CLI (Desenvolvimento Local)

### 1. Instalar Stripe CLI

**Windows:**
```powershell
# Baixar de https://github.com/stripe/stripe-cli/releases
# Ou usar Scoop:
scoop install stripe
```

**Linux/Mac:**
```bash
# Usar Homebrew (Mac) ou baixar binário
brew install stripe/stripe-cli/stripe
```

### 2. Autenticar Stripe CLI

```bash
stripe login
```

Isso abrirá o navegador para autenticar com sua conta Stripe.

### 3. Encaminhar Webhooks para Localhost

Em um terminal separado, execute:

```bash
stripe listen --forward-to http://localhost:8000/api/webhooks/stripe/
```

O Stripe CLI mostrará algo como:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**⚠️ IMPORTANTE**: Copie esse secret (`whsec_...`) e adicione ao `.env` ou `settings.py`:

```python
STRIPE_WEBHOOK_SECRET_TEST = 'whsec_xxxxxxxxxxxxx'
```

### 4. Disparar Eventos de Teste

Em outro terminal, você pode disparar eventos de teste:

```bash
# Disparar evento de checkout concluído
stripe trigger checkout.session.completed

# Disparar evento de assinatura criada
stripe trigger customer.subscription.created

# Disparar evento de pagamento bem-sucedido
stripe trigger payment_intent.succeeded

# Disparar evento de falha no pagamento
stripe trigger payment_intent.payment_failed
```

---

## 🔄 Fluxo de Checkout Completo

### 1. Cliente Seleciona Plano

O frontend chama:
```
POST /api/payments/checkout/create/
Body: {
  "plan_id": 1,
  "billing_cycle": "monthly"
}
```

**Resposta:**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

### 2. Redirecionar Cliente para Checkout

O frontend redireciona o cliente para `checkout_url`.

### 3. Cliente Completa Pagamento no Stripe

O Stripe processa o pagamento e redireciona de volta para:
- **Sucesso**: `http://localhost:5173/checkout/success?session_id=cs_test_...`
- **Cancelamento**: `http://localhost:5173/checkout/cancel`

### 4. Webhook Processa Evento

O Stripe envia webhook `checkout.session.completed` para:
```
POST http://localhost:8000/api/webhooks/stripe/
```

O webhook:
1. Cria/atualiza `PaymentMethod` com `customer_id`
2. Cria/atualiza `Subscription` vinculada ao plano
3. Atualiza status da assinatura para `active`

### 5. Frontend Verifica Status

O frontend pode verificar o status da sessão:
```
GET /api/payments/checkout/session/{session_id}/
```

---

## 📡 Eventos de Webhook Suportados

| Evento | Handler | Ação |
|--------|---------|------|
| `checkout.session.completed` | `handle_checkout_session_completed` | Cria/atualiza subscription |
| `payment_intent.succeeded` | `handle_payment_intent_succeeded` | Marca pagamento como pago |
| `payment_intent.payment_failed` | `handle_payment_intent_failed` | Marca pagamento como falhado |
| `invoice.payment_succeeded` | `handle_invoice_payment_succeeded` | Marca fatura como paga |
| `invoice.payment_failed` | `handle_invoice_payment_failed` | Marca subscription como `past_due` |
| `customer.subscription.created` | `handle_subscription_created` | Atualiza subscription |
| `customer.subscription.updated` | `handle_subscription_updated` | Atualiza períodos e status |
| `customer.subscription.deleted` | `handle_subscription_deleted` | Cancela subscription |
| `payment_method.attached` | `handle_payment_method_attached` | Atualiza payment method |
| `payment_method.detached` | `handle_payment_method_detached` | Desativa payment method |

---

## 🧪 Testando Pagamentos

### Cartões de Teste do Stripe

Use estes cartões para testar diferentes cenários:

| Cenário | Número do Cartão | CVV | Data |
|---------|------------------|-----|------|
| **Sucesso** | `4242 4242 4242 4242` | Qualquer | Qualquer data futura |
| **Falha** | `4000 0000 0000 0002` | Qualquer | Qualquer data futura |
| **3D Secure** | `4000 0025 0000 3155` | Qualquer | Qualquer data futura |
| **Insufficient Funds** | `4000 0000 0000 9995` | Qualquer | Qualquer data futura |

### Testar Checkout Completo

1. **Iniciar Stripe CLI**:
   ```bash
   stripe listen --forward-to http://localhost:8000/api/webhooks/stripe/
   ```

2. **Criar checkout session** (via API ou frontend):
   ```bash
   curl -X POST http://localhost:8000/api/payments/checkout/create/ \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "plan_id": 1,
       "billing_cycle": "monthly"
     }'
   ```

3. **Acessar checkout_url** no navegador

4. **Usar cartão de teste**: `4242 4242 4242 4242`

5. **Verificar webhook** no terminal do Stripe CLI

6. **Verificar subscription** no Django Admin ou API

---

## 🔐 Segurança

### Verificação de Assinatura de Webhook

Em **produção**, sempre configure `STRIPE_WEBHOOK_SECRET` para verificar a assinatura dos webhooks.

Em **desenvolvimento local com Stripe CLI**, o secret é fornecido pelo CLI (`whsec_...`).

### Modo Simulado

Para desenvolvimento sem Stripe real, configure:
```python
STRIPE_MODE = 'simulated'
```

Isso simula todas as respostas do Stripe sem fazer chamadas reais.

---

## 📝 Próximos Passos

1. ✅ Configurar Price IDs nos planos
2. ✅ Testar checkout com Stripe CLI
3. ⏳ Implementar renovação automática (Celery)
4. ⏳ Criar interface frontend de checkout
5. ⏳ Dashboard de pagamentos para cliente
6. ⏳ Notificações de pagamento falhado

---

## 🐛 Troubleshooting

### Webhook não está sendo recebido

1. Verificar se Stripe CLI está rodando:
   ```bash
   stripe listen --forward-to http://localhost:8000/api/webhooks/stripe/
   ```

2. Verificar se o endpoint está acessível:
   ```bash
   curl http://localhost:8000/api/webhooks/stripe/
   ```

3. Verificar logs do Django para erros

### Erro de assinatura de webhook

1. Verificar se `STRIPE_WEBHOOK_SECRET` está configurado
2. Em desenvolvimento local, usar o secret do Stripe CLI (`whsec_...`)
3. Verificar se o secret está correto

### Subscription não está sendo criada

1. Verificar se o webhook `checkout.session.completed` está sendo processado
2. Verificar logs do Django
3. Verificar se `metadata` do checkout session contém `tenant_id` e `plan_id`

---

**Última atualização**: 2025-01-27

