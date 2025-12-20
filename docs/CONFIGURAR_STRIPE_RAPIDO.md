# ⚡ Configuração Rápida do Stripe

## 🔧 Passo a Passo

### 1. Adicionar Chaves no docker-compose.yml

As chaves já foram adicionadas ao `docker-compose.yml`. Se não estiverem lá, adicione:

```yaml
environment:
  - STRIPE_SECRET_KEY_TEST=sk_test_...
  - STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
  - STRIPE_MODE=test
```

### 2. Reiniciar Containers

```bash
docker-compose down
docker-compose up -d
```

### 3. Configurar Planos com Price IDs

```bash
docker-compose exec web python manage.py update_stripe_price_ids
```

### 4. Verificar Configuração

```bash
docker-compose exec web python manage.py shell
```

No shell do Django:
```python
from django.conf import settings
print("STRIPE_MODE:", settings.STRIPE_MODE)
print("STRIPE_SECRET_KEY_TEST:", "✅ Configurado" if settings.STRIPE_SECRET_KEY_TEST else "❌ Não configurado")

from subscriptions.models import Plan
for p in Plan.objects.all():
    print(f"{p.name}: {p.stripe_price_id_monthly or 'SEM PRICE ID'}")
```

---

## ✅ Pronto!

Agora você pode testar o checkout:
1. Acesse http://localhost:5173/plans
2. Faça login
3. Clique em "🧪 Teste Rápido - Checkout Pro (Mensal)"
4. Será redirecionado para Stripe Checkout

---

**Última atualização**: 2025-01-27

