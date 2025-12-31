# 🔧 Troubleshooting - Erro 500 no Checkout

## Erro: "Erro ao criar checkout. Verifique se está logado e tente novamente."

Este erro geralmente ocorre por um dos seguintes motivos:

### 1. **Stripe não está configurado** ❌

**Sintoma**: Erro 500 ao criar checkout session

**Solução**:
1. Configure as chaves do Stripe no `docker-compose.yml` ou via variáveis de ambiente:

```yaml
# docker-compose.yml
environment:
  - STRIPE_SECRET_KEY_TEST=sk_test_...  # Sua chave secreta do Stripe
  - STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...  # Sua chave pública do Stripe
  - STRIPE_MODE=test
```

**⚠️ IMPORTANTE**: Obtenha suas chaves no [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) e configure-as via variáveis de ambiente ou arquivo `.env` (não commite no repositório).

2. Reinicie os containers:
```bash
docker-compose down
docker-compose up -d
```

### 2. **Plano não tem Stripe Price ID configurado** ❌

**Sintoma**: Erro 400 com mensagem "Plano não tem Stripe Price ID configurado"

**Solução**:
1. Execute o comando para atualizar planos:
```bash
docker-compose exec web python manage.py update_stripe_price_ids
```

2. Ou configure manualmente no Django Admin:
   - Acesse: http://localhost:8000/admin/subscriptions/plan/
   - Edite cada plano
   - Adicione o Stripe Price ID correspondente:
     - **Enterprise**: `price_1Sf4JfJcxPm9Lx7v6TTz8Cnw`
     - **Pro**: `price_1Sf4J9JcxPm9Lx7v9NtCcRVD`
     - **Básico**: `price_1Sf4IvJcxPm9Lx7vXxU5I1GR`
     - **Trial**: `price_1Sf4IGJcxPm9Lx7vn3fxiwGo`

### 3. **Tenant não identificado** ❌

**Sintoma**: Erro 400 "Tenant não identificado"

**Solução**:
- Certifique-se de estar logado
- Verifique se o header `X-Tenant-Domain` está sendo enviado
- Verifique se o tenant está ativo no banco de dados

### 4. **Verificar Logs do Django** 🔍

Para ver o erro completo:

```bash
# Ver logs em tempo real
docker-compose logs -f web

# Ou acessar diretamente o container
docker-compose exec web python manage.py shell
```

### 5. **Testar Configuração** ✅

Execute o script de diagnóstico:

```bash
docker-compose exec web python scripts/check_stripe_config.py
```

---

## 📋 Checklist de Verificação

Antes de testar o checkout, verifique:

- [ ] Chaves do Stripe configuradas no `docker-compose.yml`
- [ ] Containers reiniciados após adicionar variáveis
- [ ] Planos têm `stripe_price_id_monthly` configurado
- [ ] Usuário está autenticado
- [ ] Tenant está ativo no banco de dados
- [ ] Stripe CLI rodando (para webhooks): `stripe listen --forward-to http://localhost:8000/api/webhooks/stripe/`

---

## 🧪 Teste Rápido

1. **Verificar configuração**:
```bash
docker-compose exec web python manage.py shell
>>> from django.conf import settings
>>> print(settings.STRIPE_SECRET_KEY_TEST[:20] if settings.STRIPE_SECRET_KEY_TEST else 'NÃO CONFIGURADO')
```

2. **Verificar planos**:
```bash
docker-compose exec web python manage.py shell
>>> from subscriptions.models import Plan
>>> for p in Plan.objects.all():
...     print(f"{p.name}: {p.stripe_price_id_monthly or 'SEM PRICE ID'}")
```

3. **Atualizar planos**:
```bash
docker-compose exec web python manage.py update_stripe_price_ids
```

---

**Última atualização**: 2025-01-27

