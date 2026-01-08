"""
Comando Django para sincronizar assinaturas do Stripe para o banco de dados local
"""
import stripe
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django_tenants.utils import schema_context
from datetime import datetime
from tenants.models import Tenant
from subscriptions.models import Subscription, Plan
from payments.models import PaymentMethod, Payment, Invoice


class Command(BaseCommand):
    help = 'Sincroniza assinaturas do Stripe para o banco de dados local'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Número máximo de assinaturas para sincronizar (padrão: 100)',
        )
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='Sincronizar apenas assinaturas de um tenant específico',
        )

    def handle(self, *args, **options):
        limit = options.get('limit', 100)
        tenant_id = options.get('tenant_id')
        
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'simulated')
        
        if stripe_mode == 'simulated':
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  Modo simulado ativo. Configure STRIPE_MODE=test ou STRIPE_MODE=live para sincronizar'
                )
            )
            return
        
        # Configurar Stripe
        if stripe_mode == 'live':
            stripe.api_key = settings.STRIPE_SECRET_KEY
        else:
            stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY_TEST', '')
        
        stripe.api_version = getattr(settings, 'STRIPE_API_VERSION', '2024-11-20.acacia')
        
        if not stripe.api_key:
            self.stdout.write(
                self.style.ERROR('❌ Stripe não está configurado. Configure STRIPE_SECRET_KEY_TEST ou STRIPE_SECRET_KEY')
            )
            return
        
        self.stdout.write('Iniciando sincronização de assinaturas do Stripe...')
        
        try:
            # Buscar todas as subscriptions do Stripe
            subscriptions_list = stripe.Subscription.list(limit=limit)
            
            self.stdout.write(f'Encontradas {len(subscriptions_list.data)} assinaturas no Stripe')
            
            synced_count = 0
            created_count = 0
            updated_count = 0
            skipped_count = 0
            error_count = 0
            
            with schema_context('public'):
                for stripe_sub in subscriptions_list.data:
                    try:
                        subscription_id = stripe_sub.id
                        customer_id = stripe_sub.customer
                        
                        # Se tenant_id foi especificado, filtrar por ele
                        if tenant_id:
                            try:
                                tenant = Tenant.objects.get(id=tenant_id)
                                # Verificar se o customer_id corresponde a este tenant
                                payment_method = PaymentMethod.objects.filter(
                                    tenant=tenant,
                                    stripe_customer_id=customer_id
                                ).first()
                                if not payment_method:
                                    skipped_count += 1
                                    continue
                            except Tenant.DoesNotExist:
                                self.stdout.write(
                                    self.style.WARNING(f'⚠️  Tenant {tenant_id} não encontrado')
                                )
                                skipped_count += 1
                                continue
                        
                        # Encontrar tenant pelo customer_id
                        payment_method = PaymentMethod.objects.filter(
                            stripe_customer_id=customer_id
                        ).first()
                        
                        if not payment_method:
                            # Tentar buscar pelo metadata do customer
                            try:
                                customer = stripe.Customer.retrieve(customer_id)
                                tenant_id_from_metadata = customer.metadata.get('tenant_id')
                                
                                if tenant_id_from_metadata:
                                    try:
                                        tenant = Tenant.objects.get(id=int(tenant_id_from_metadata))
                                    except (Tenant.DoesNotExist, ValueError):
                                        self.stdout.write(
                                            self.style.WARNING(
                                                f'⚠️  Não foi possível encontrar tenant para customer {customer_id}'
                                            )
                                        )
                                        skipped_count += 1
                                        continue
                                else:
                                    self.stdout.write(
                                        self.style.WARNING(
                                            f'⚠️  Customer {customer_id} não tem tenant associado. Pulando...'
                                        )
                                    )
                                    skipped_count += 1
                                    continue
                            except stripe.error.StripeError as e:
                                self.stdout.write(
                                    self.style.WARNING(
                                        f'⚠️  Erro ao buscar customer {customer_id}: {str(e)}'
                                    )
                                )
                                skipped_count += 1
                                continue
                        else:
                            tenant = payment_method.tenant
                        
                        # Determinar billing_cycle baseado no price
                        billing_cycle = 'monthly'
                        items_data = []
                        try:
                            # Tentar acessar items como atributo ou dicionário
                            if hasattr(stripe_sub, 'items'):
                                items_obj = stripe_sub.items
                                if hasattr(items_obj, 'data'):
                                    items_data = items_obj.data
                                elif isinstance(items_obj, dict) and 'data' in items_obj:
                                    items_data = items_obj['data']
                            elif isinstance(stripe_sub, dict) and 'items' in stripe_sub:
                                items_data = stripe_sub['items'].get('data', [])
                            
                            if items_data and len(items_data) > 0:
                                # Acessar price do primeiro item
                                first_item = items_data[0]
                                if hasattr(first_item, 'price'):
                                    price_obj = first_item.price
                                elif isinstance(first_item, dict):
                                    price_obj = first_item.get('price', {})
                                else:
                                    price_obj = {}
                                
                                # Verificar interval
                                if hasattr(price_obj, 'interval'):
                                    interval = price_obj.interval
                                elif isinstance(price_obj, dict):
                                    interval = price_obj.get('interval', 'month')
                                else:
                                    interval = 'month'
                                
                                if interval == 'year':
                                    billing_cycle = 'yearly'
                        except Exception as e:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'  ⚠️  Erro ao determinar billing_cycle: {str(e)}. Usando padrão (monthly)'
                                )
                            )
                        
                        # Determinar plano (tentar pelo price_id ou usar plano padrão)
                        plan = None
                        try:
                            if items_data and len(items_data) > 0:
                                first_item = items_data[0]
                                if hasattr(first_item, 'price'):
                                    price_obj = first_item.price
                                    if hasattr(price_obj, 'id'):
                                        price_id = price_obj.id
                                    else:
                                        price_id = None
                                elif isinstance(first_item, dict):
                                    price_obj = first_item.get('price', {})
                                    price_id = price_obj.get('id') if isinstance(price_obj, dict) else None
                                else:
                                    price_id = None
                                
                                # Tentar encontrar plano pelo price_id
                                if price_id:
                                    plan = Plan.objects.filter(
                                        stripe_price_id_monthly=price_id
                                    ).first()
                                    if not plan:
                                        plan = Plan.objects.filter(
                                            stripe_price_id_yearly=price_id
                                        ).first()
                        except Exception as e:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'  ⚠️  Erro ao buscar plano pelo price_id: {str(e)}'
                                )
                            )
                        
                        # Se não encontrou plano, usar o primeiro plano ativo como fallback
                        if not plan:
                            plan = Plan.objects.filter(is_active=True).first()
                        
                        if not plan:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'⚠️  Nenhum plano encontrado. Criando subscription sem plano para tenant {tenant.name}'
                                )
                            )
                            # Criar um plano básico se não existir nenhum
                            plan, _ = Plan.objects.get_or_create(
                                slug='basico',
                                defaults={
                                    'name': 'Básico',
                                    'price_monthly': 0,
                                    'price_yearly': 0,
                                    'is_active': True,
                                }
                            )
                        
                        # Converter timestamps para datetime
                        current_period_start = datetime.fromtimestamp(
                            stripe_sub.current_period_start, tz=timezone.utc
                        )
                        current_period_end = datetime.fromtimestamp(
                            stripe_sub.current_period_end, tz=timezone.utc
                        )
                        
                        canceled_at = None
                        if stripe_sub.canceled_at:
                            canceled_at = datetime.fromtimestamp(
                                stripe_sub.canceled_at, tz=timezone.utc
                            )
                        
                        # Buscar ou criar subscription
                        subscription, created = Subscription.objects.get_or_create(
                            payment_gateway_id=subscription_id,
                            defaults={
                                'tenant': tenant,
                                'plan': plan,
                                'status': stripe_sub.status,
                                'billing_cycle': billing_cycle,
                                'current_period_start': current_period_start,
                                'current_period_end': current_period_end,
                                'cancel_at_period_end': stripe_sub.cancel_at_period_end,
                                'canceled_at': canceled_at,
                            }
                        )
                        
                        if not created:
                            # Atualizar subscription existente
                            subscription.tenant = tenant
                            subscription.plan = plan
                            subscription.status = stripe_sub.status
                            subscription.billing_cycle = billing_cycle
                            subscription.current_period_start = current_period_start
                            subscription.current_period_end = current_period_end
                            subscription.cancel_at_period_end = stripe_sub.cancel_at_period_end
                            subscription.canceled_at = canceled_at
                            subscription.save()
                            updated_count += 1
                            self.stdout.write(
                                f'  ✅ Atualizada: {subscription_id} - Tenant: {tenant.name}'
                            )
                        else:
                            created_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'  ✅ Criada: {subscription_id} - Tenant: {tenant.name}'
                                )
                            )
                        
                        synced_count += 1
                        
                    except Exception as e:
                        error_count += 1
                        self.stdout.write(
                            self.style.ERROR(
                                f'  ❌ Erro ao sincronizar subscription {stripe_sub.id}: {str(e)}'
                            )
                        )
                        import traceback
                        self.stdout.write(traceback.format_exc())
            
            # Resumo
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('Resumo da Sincronização:'))
            self.stdout.write(self.style.SUCCESS(f'  Total processadas: {len(subscriptions_list.data)}'))
            self.stdout.write(self.style.SUCCESS(f'  ✅ Sincronizadas: {synced_count}'))
            self.stdout.write(self.style.SUCCESS(f'  ➕ Criadas: {created_count}'))
            self.stdout.write(self.style.SUCCESS(f'  🔄 Atualizadas: {updated_count}'))
            self.stdout.write(self.style.WARNING(f'  ⏭️  Puladas: {skipped_count}'))
            self.stdout.write(self.style.ERROR(f'  ❌ Erros: {error_count}'))
            self.stdout.write(self.style.SUCCESS('=' * 60))
            
        except stripe.error.StripeError as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Erro ao buscar subscriptions do Stripe: {str(e)}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Erro inesperado: {str(e)}')
            )
            import traceback
            self.stdout.write(traceback.format_exc())

