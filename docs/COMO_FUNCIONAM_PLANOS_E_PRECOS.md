# 📋 Como Funcionam Planos e Preços no Sistema

## 🔍 Situação Atual

### **Planos com Sincronização Automática** ✅

Os planos e preços são armazenados no banco de dados local (model `Plan`), mas **são sincronizados automaticamente com o Stripe** quando você altera preços no Stripe Dashboard.

**📖 Veja documentação completa em**: [`docs/SINCRONIZACAO_PRECOS_STRIPE.md`](./SINCRONIZACAO_PRECOS_STRIPE.md)

### Estrutura:

1. **Model `Plan`** (banco local):
   - `name`: Nome do plano (ex: "Pro", "Enterprise")
   - `price_monthly`: Preço mensal em R$ (ex: 99.00)
   - `price_yearly`: Preço anual em R$ (ex: 990.00)
   - `stripe_price_id_monthly`: ID do preço no Stripe (ex: `price_1Sf4J9JcxPm9Lx7v9NtCcRVD`)
   - `stripe_price_id_yearly`: ID do preço anual no Stripe

2. **Fluxo de Funcionamento**:
   ```
   Frontend → GET /api/public/plans/
              ↓
   Backend → Plan.objects.filter(is_active=True)  [Busca do BANCO LOCAL]
              ↓
   Retorna: { name, price_monthly, price_yearly, ... }
   ```

3. **Quando cria checkout**:
   ```
   Frontend → POST /api/payments/checkout/create/
              { plan_id: 2, billing_cycle: 'monthly' }
              ↓
   Backend → Busca Plan no banco local
              ↓
   Pega stripe_price_id_monthly do plano
              ↓
   Stripe → Cria checkout session com price_id
   ```

---

## ✅ Sincronização Automática Implementada

### **Solução**: Preços são sincronizados automaticamente

- ✅ Se você mudar o preço no **Stripe Dashboard**, o sistema **sincroniza automaticamente** (até 5 minutos)
- ✅ Preços são atualizados nas telas de planos e configurações
- ✅ Cache inteligente evita muitas chamadas ao Stripe

### **Como funciona**:
1. Você muda o preço do plano "Pro" no Stripe de R$ 99 para R$ 149
2. O sistema sincroniza automaticamente na próxima listagem de planos (ou após 5 minutos)
3. A página de planos mostra R$ 149,00
4. O checkout usa o preço correto do Stripe

---

## ✅ Vantagens da Abordagem Atual

1. **Controle Total**: Você controla exatamente o que é exibido
2. **Performance**: Não precisa fazer chamadas ao Stripe para listar planos
3. **Flexibilidade**: Pode ter preços diferentes no sistema vs Stripe (útil para promoções)
4. **Offline**: Funciona mesmo se Stripe estiver temporariamente indisponível

---

## 🔄 Alternativa: Sincronizar com Stripe

Se quiser que os preços venham do Stripe automaticamente, pode implementar:

### **Opção 1: Buscar Preços do Stripe ao Listar Planos**

```python
# public/views.py
@api_view(['GET'])
@permission_classes([AllowAny])
def available_plans(request):
    plans = Plan.objects.filter(is_active=True)
    
    result = []
    for plan in plans:
        plan_data = {
            'id': plan.id,
            'name': plan.name,
            # ... outros campos ...
        }
        
        # Buscar preço atual do Stripe
        if plan.stripe_price_id_monthly:
            try:
                import stripe
                price = stripe.Price.retrieve(plan.stripe_price_id_monthly)
                # Converter de centavos para reais
                plan_data['price_monthly'] = str(price.unit_amount / 100)
            except:
                # Fallback para preço do banco
                plan_data['price_monthly'] = str(plan.price_monthly)
        else:
            plan_data['price_monthly'] = str(plan.price_monthly)
        
        result.append(plan_data)
    
    return Response(result)
```

**Vantagens**:
- ✅ Preços sempre sincronizados com Stripe
- ✅ Mudanças no Stripe refletem automaticamente

**Desvantagens**:
- ⚠️ Mais lento (chamadas ao Stripe)
- ⚠️ Depende da API do Stripe estar disponível
- ⚠️ Pode ter problemas de rate limiting

---

### **Opção 2: Sincronização Periódica (Celery)**

Criar uma tarefa Celery que sincroniza preços do Stripe periodicamente:

```python
# subscriptions/tasks.py
@shared_task
def sync_plan_prices_from_stripe():
    """
    Sincroniza preços dos planos com o Stripe
    Executa diariamente
    """
    plans = Plan.objects.filter(is_active=True)
    
    for plan in plans:
        if plan.stripe_price_id_monthly:
            try:
                price = stripe.Price.retrieve(plan.stripe_price_id_monthly)
                # Atualizar preço no banco
                plan.price_monthly = Decimal(price.unit_amount) / 100
                plan.save()
            except Exception as e:
                logger.error(f"Erro ao sincronizar preço do plano {plan.name}: {e}")
```

**Vantagens**:
- ✅ Preços sincronizados automaticamente
- ✅ Performance boa (cache no banco)
- ✅ Não depende de API em tempo real

**Desvantagens**:
- ⚠️ Pode ter delay (até 24h se rodar diariamente)
- ⚠️ Precisa configurar Celery

---

### **Opção 3: Híbrida (Recomendada)**

Manter preços no banco local, mas validar com Stripe:

1. **Preços no banco**: Fonte principal (rápido, confiável)
2. **Validação periódica**: Celery verifica se preços mudaram no Stripe
3. **Alerta**: Se detectar diferença, notifica admin para revisar

---

## 🎯 Recomendação

**Manter como está** (preços estáticos) por enquanto, porque:

1. ✅ É mais simples e rápido
2. ✅ Você tem controle total
3. ✅ Não depende de API externa
4. ✅ Funciona bem para a maioria dos casos

**Implementar sincronização** apenas se:
- Você mudar preços frequentemente no Stripe
- Quiser automatizar completamente
- Tiver muitos planos para gerenciar

---

## 📝 Como Atualizar Preços Atualmente

### **1. Atualizar no Django Admin**:
```
1. Acesse /admin/subscriptions/plan/
2. Edite o plano desejado
3. Altere price_monthly ou price_yearly
4. Salve
```

### **2. Atualizar no Stripe** (se necessário):
```
1. Acesse Stripe Dashboard
2. Vá em Products → Seu Produto
3. Edite o Price
4. OU crie um novo Price e atualize stripe_price_id no Django Admin
```

### **3. Manter Sincronizados**:
- Sempre atualize em ambos os lugares
- Use o mesmo valor (ou ajuste conforme necessário)

---

## 🔧 Comando Útil: Verificar Sincronização

Você pode criar um comando Django para verificar se preços estão sincronizados:

```python
# subscriptions/management/commands/check_price_sync.py
from django.core.management.base import BaseCommand
from subscriptions.models import Plan
import stripe

class Command(BaseCommand):
    def handle(self, *args, **options):
        plans = Plan.objects.filter(is_active=True)
        
        for plan in plans:
            if plan.stripe_price_id_monthly:
                try:
                    price = stripe.Price.retrieve(plan.stripe_price_id_monthly)
                    stripe_price = price.unit_amount / 100
                    local_price = float(plan.price_monthly)
                    
                    if abs(stripe_price - local_price) > 0.01:
                        self.stdout.write(
                            self.style.WARNING(
                                f'⚠️  {plan.name}: Local R$ {local_price} vs Stripe R$ {stripe_price}'
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(f'✅ {plan.name}: Sincronizado')
                        )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'❌ {plan.name}: Erro ao verificar - {e}')
                    )
```

---

**Última atualização**: 2025-12-20

