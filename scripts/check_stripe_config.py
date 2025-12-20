"""
Script para verificar configuração do Stripe
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.conf import settings
from subscriptions.models import Plan

print("=" * 60)
print("VERIFICAÇÃO DE CONFIGURAÇÃO DO STRIPE")
print("=" * 60)

# Verificar variáveis de ambiente
print("\n1. Variáveis de Ambiente:")
print(f"   ENVIRONMENT: {getattr(settings, 'ENVIRONMENT', 'N/A')}")
print(f"   STRIPE_MODE: {getattr(settings, 'STRIPE_MODE', 'N/A')}")
print(f"   STRIPE_SECRET_KEY_TEST: {'✅ Configurado' if getattr(settings, 'STRIPE_SECRET_KEY_TEST', '') else '❌ NÃO CONFIGURADO'}")
print(f"   STRIPE_PUBLISHABLE_KEY_TEST: {'✅ Configurado' if getattr(settings, 'STRIPE_PUBLISHABLE_KEY_TEST', '') else '❌ NÃO CONFIGURADO'}")

# Verificar configuração do Stripe
print("\n2. Configuração do Stripe:")
try:
    import stripe
    stripe_mode = getattr(settings, 'STRIPE_MODE', 'simulated')
    if stripe_mode == 'test':
        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY_TEST', '')
        if stripe.api_key:
            print(f"   ✅ Stripe API Key configurado: {stripe.api_key[:20]}...")
        else:
            print(f"   ❌ Stripe API Key NÃO configurado")
    elif stripe_mode == 'simulated':
        print(f"   ⚠️  Modo SIMULADO - Stripe não será usado")
    else:
        print(f"   ⚠️  Modo desconhecido: {stripe_mode}")
except Exception as e:
    print(f"   ❌ Erro ao verificar Stripe: {e}")

# Verificar planos e price IDs
print("\n3. Planos e Stripe Price IDs:")
try:
    plans = Plan.objects.all()
    if not plans.exists():
        print("   ⚠️  Nenhum plano encontrado no banco de dados")
    else:
        for plan in plans:
            price_monthly = plan.stripe_price_id_monthly or '❌ NÃO CONFIGURADO'
            price_yearly = plan.stripe_price_id_yearly or '❌ NÃO CONFIGURADO'
            print(f"\n   Plano: {plan.name} (ID: {plan.id}, Slug: {plan.slug})")
            print(f"      Price ID Mensal: {price_monthly}")
            print(f"      Price ID Anual: {price_yearly}")
            
            # Verificar se tem price_id para mensal
            if not plan.stripe_price_id_monthly:
                print(f"      ⚠️  ATENÇÃO: Plano {plan.name} não tem Stripe Price ID configurado!")
except Exception as e:
    print(f"   ❌ Erro ao verificar planos: {e}")

print("\n" + "=" * 60)
print("RECOMENDAÇÕES:")
print("=" * 60)

if not getattr(settings, 'STRIPE_SECRET_KEY_TEST', ''):
    print("\n1. Configure as chaves do Stripe via variáveis de ambiente:")
    print("   export STRIPE_SECRET_KEY_TEST='sk_test_...'")
    print("   export STRIPE_PUBLISHABLE_KEY_TEST='pk_test_...'")
    print("\n   Ou adicione ao docker-compose.yml na seção environment do serviço web")

# Verificar planos sem price_id
try:
    plans_sem_price = Plan.objects.filter(stripe_price_id_monthly__isnull=True) | Plan.objects.filter(stripe_price_id_monthly='')
    if plans_sem_price.exists():
        print("\n2. Execute o comando para atualizar planos com Price IDs:")
        print("   python manage.py update_stripe_price_ids")
except:
    pass

print("\n" + "=" * 60)

