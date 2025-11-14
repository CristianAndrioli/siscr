# 🔔 Webhooks do Stripe

## ✅ O que foi implementado

### 1. Webhook Handler
- ✅ Endpoint: `/api/webhooks/stripe/`
- ✅ Processa eventos do Stripe
- ✅ Suporta modo simulado e real
- ✅ Verificação de assinatura (em produção/test)

### 2. Eventos Processados

| Evento | Handler | Ação |
|--------|---------|------|
| `payment_intent.succeeded` | `handle_payment_intent_succeeded` | Marca pagamento como pago |
| `payment_intent.payment_failed` | `handle_payment_intent_failed` | Marca pagamento como falhado |
| `invoice.payment_succeeded` | `handle_invoice_payment_succeeded` | Marca fatura como paga |
| `invoice.payment_failed` | `handle_invoice_payment_failed` | Marca fatura como não paga |
| `customer.subscription.created` | `handle_subscription_created` | Atualiza subscription |
| `customer.subscription.updated` | `handle_subscription_updated` | Atualiza subscription |
| `customer.subscription.deleted` | `handle_subscription_deleted` | Cancela subscription |
| `payment_method.attached` | `handle_payment_method_attached` | Atualiza payment method |
| `payment_method.detached` | `handle_payment_method_detached` | Desativa payment method |

---

## 🔧 Configuração

### 1. Configurar Webhook no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"
3. URL: `https://seu-dominio.com/api/webhooks/stripe/`
4. Selecione eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_method.attached`
   - `payment_method.detached`

5. Copie o **Signing secret** (começa com `whsec_`)
6. Adicione ao `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 2. Variáveis de Ambiente

```bash
# Development (modo simulado - não precisa)
STRIPE_MODE=simulated

# Homologation/Preprod (modo test)
STRIPE_MODE=test
STRIPE_WEBHOOK_SECRET_TEST=whsec_...

# Production (modo live)
STRIPE_MODE=live
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🧪 Como Testar

### 1. Testar em Modo Simulado

```bash
# Fazer POST para webhook com evento simulado
curl -X POST http://localhost:8000/api/webhooks/stripe/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_123",
        "amount": 10000,
        "currency": "brl",
        "customer": "cus_test_123"
      }
    }
  }'
```

### 2. Testar com Stripe CLI

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Fazer forward de webhooks para localhost
stripe listen --forward-to http://localhost:8000/api/webhooks/stripe/

# Disparar evento de teste
stripe trigger payment_intent.succeeded
```

### 3. Testar em Produção

1. Configure webhook no Stripe Dashboard
2. Adicione `STRIPE_WEBHOOK_SECRET` ao ambiente
3. O Stripe enviará eventos automaticamente

---

## 🔍 Fluxo de Eventos

### Pagamento Bem-Sucedido

1. Cliente faz pagamento
2. Stripe processa
3. Stripe envia `payment_intent.succeeded`
4. Webhook atualiza `Payment` como `succeeded`
5. Se houver invoice, marca como paga

### Assinatura Atualizada

1. Assinatura é modificada no Stripe
2. Stripe envia `customer.subscription.updated`
3. Webhook atualiza `Subscription` no banco
4. Status, períodos e cancelamento sincronizados

### Falha no Pagamento

1. Pagamento falha
2. Stripe envia `payment_intent.payment_failed`
3. Webhook marca `Payment` como `failed`
4. Se for invoice, marca subscription como `past_due`

---

## ⚠️ Importante

### Segurança

- ✅ Verificação de assinatura em produção/test
- ✅ CSRF desabilitado (webhook precisa)
- ✅ Processamento transacional (rollback em erro)

### Modo Simulado

- ⚠️ Em desenvolvimento, não verifica assinatura
- ⚠️ Aceita qualquer payload JSON
- ⚠️ Use apenas para testes locais

### Logs

Em produção, configure logging adequado:

```python
import logging

logger = logging.getLogger(__name__)

# No webhook handler
try:
    # processar evento
except Exception as e:
    logger.error(f"Erro ao processar webhook: {str(e)}", exc_info=True)
```

---

## ✅ Checklist

- [x] Webhook handler criado
- [x] Eventos principais implementados
- [x] Modo simulado suportado
- [x] Verificação de assinatura
- [x] Processamento transacional
- [x] URLs configuradas
- [x] Documentação criada

---

**Última atualização**: 2025-11-14

