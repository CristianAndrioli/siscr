# Diagnóstico de Webhooks do Stripe

## Problema: Subscription permanece "pending" após pagamento

Se a subscription permanece com status "pending" após o pagamento, significa que o webhook `checkout.session.completed` não está sendo processado.

## Verificações

### 1. Verificar se o Stripe CLI está rodando

O Stripe CLI precisa estar rodando para encaminhar webhooks do Stripe para o localhost:

```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe/
```

Você deve ver uma mensagem como:
```
> Ready! Your webhook signing secret is whsec_xxxxx
```

### 2. Verificar se o webhook secret está configurado

O webhook secret do Stripe CLI deve estar configurado no `docker-compose.yml` ou nas variáveis de ambiente:

```yaml
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx  # O secret do Stripe CLI
```

### 3. Verificar logs do webhook

Após fazer um pagamento, você deve ver logs como:

```
[WEBHOOK] Requisição recebida de 127.0.0.1
[WEBHOOK] ✅ Evento recebido: checkout.session.completed (ID: evt_xxx)
[WEBHOOK] [checkout.session.completed] Processando session_id=cs_test_xxx
[WEBHOOK] [checkout.session.completed] ✅ Status alterado de 'pending' para 'active'
```

**Se não aparecer nenhum log de webhook**, significa que:
- O Stripe CLI não está rodando
- O webhook não está sendo encaminhado corretamente
- O endpoint não está acessível

### 4. Testar webhook manualmente

Você pode testar o webhook manualmente usando o Stripe CLI:

```bash
stripe trigger checkout.session.completed
```

Isso deve gerar um evento de teste e você deve ver os logs no Docker.

### 5. Verificar se o metadata está sendo enviado

O checkout session precisa incluir metadata com `tenant_id` e `plan_id`. Verifique em `payments/api/views.py` se o `create_checkout_session` está incluindo o metadata:

```python
metadata={
    'tenant_id': str(tenant.id),
    'plan_id': str(plan.id),
    'billing_cycle': billing_cycle,
}
```

## Solução para usuários sem usuário no schema do tenant

Se um usuário não consegue fazer login porque não existe no schema do tenant, o sistema agora tenta criar automaticamente. Verifique os logs:

```
[LOGIN] 🔍 Verificando usuário no schema do tenant: username="xxx", tenant="xxx", existe=False
[LOGIN] Usuário "xxx" não existe no schema do tenant "xxx". Criando usuário no schema do tenant...
[LOGIN] ✅ Usuário "xxx" criado no schema do tenant "xxx"
```

Se esses logs não aparecerem, pode ser que:
- O usuário não existe no schema público (sem membership)
- O tenant não está sendo identificado corretamente
- Há um erro ao criar o usuário no schema do tenant

## Comandos úteis

### Verificar subscriptions pendentes

```bash
docker-compose exec web python manage.py shell
```

```python
from subscriptions.models import Subscription
from tenants.models import Tenant

# Listar todas as subscriptions pendentes
pending = Subscription.objects.filter(status='pending')
for sub in pending:
    print(f"Tenant: {sub.tenant.name}, Status: {sub.status}, Plan: {sub.plan.name}")
```

### Atualizar manualmente uma subscription

```python
from subscriptions.models import Subscription

# Encontrar a subscription
sub = Subscription.objects.get(tenant__schema_name='unusual_advancementbiz')
sub.status = 'active'
sub.save()
print(f"Subscription {sub.id} atualizada para 'active'")
```

### Verificar se o webhook endpoint está acessível

```bash
curl -X POST http://localhost:8000/api/webhooks/stripe/ \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Se retornar um erro de assinatura, o endpoint está funcionando (só precisa da assinatura correta do Stripe).

