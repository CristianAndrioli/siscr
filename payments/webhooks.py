"""
Webhooks do Stripe para sincronizar eventos
"""
import stripe
import json
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from datetime import timedelta, datetime
from .models import PaymentMethod, Payment, Invoice
from subscriptions.models import Subscription
from tenants.models import Tenant

# Configurar Stripe se não estiver em modo simulado
if settings.STRIPE_MODE != 'simulated':
    stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY_TEST', '')
    stripe.api_version = getattr(settings, 'STRIPE_API_VERSION', '2024-11-20.acacia')


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Webhook do Stripe para processar eventos
    Suporta Stripe CLI para desenvolvimento local
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    # Verificar assinatura do webhook
    # Stripe CLI usa um webhook secret especial (whsec_...)
    # Em desenvolvimento com Stripe CLI, podemos aceitar sem verificação ou usar o secret do CLI
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    
    if settings.STRIPE_MODE == 'simulated':
        # Em modo simulado, apenas parsear JSON
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return HttpResponse(status=400)
    else:
        # Verificar assinatura do webhook
        # Se usar Stripe CLI, o secret será fornecido pelo CLI
        # Se não tiver secret configurado, aceitar (apenas para desenvolvimento local)
        if webhook_secret:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, webhook_secret
                )
            except ValueError:
                return HttpResponse(status=400)
            except stripe.error.SignatureVerificationError:
                return HttpResponse(status=400)
        else:
            # Sem secret configurado (desenvolvimento local com Stripe CLI)
            # Aceitar evento sem verificação (NÃO RECOMENDADO EM PRODUÇÃO)
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                return HttpResponse(status=400)
    
    # Processar evento
    event_type = event.get('type')
    event_data = event.get('data', {}).get('object', {})
    
    try:
        if event_type == 'checkout.session.completed':
            handle_checkout_session_completed(event_data)
        elif event_type == 'payment_intent.succeeded':
            handle_payment_intent_succeeded(event_data)
        elif event_type == 'payment_intent.payment_failed':
            handle_payment_intent_failed(event_data)
        elif event_type == 'invoice.payment_succeeded':
            handle_invoice_payment_succeeded(event_data)
        elif event_type == 'invoice.payment_failed':
            handle_invoice_payment_failed(event_data)
        elif event_type == 'customer.subscription.created':
            handle_subscription_created(event_data)
        elif event_type == 'customer.subscription.updated':
            handle_subscription_updated(event_data)
        elif event_type == 'customer.subscription.deleted':
            handle_subscription_deleted(event_data)
        elif event_type == 'payment_method.attached':
            handle_payment_method_attached(event_data)
        elif event_type == 'payment_method.detached':
            handle_payment_method_detached(event_data)
        
        return JsonResponse({'status': 'success'})
    except Exception as e:
        # Log do erro (em produção, usar logging)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao processar webhook {event_type}: {str(e)}", exc_info=True)
        return JsonResponse({'error': str(e)}, status=500)


@transaction.atomic
def handle_payment_intent_succeeded(event_data):
    """Processa pagamento bem-sucedido"""
    payment_intent_id = event_data.get('id')
    amount = event_data.get('amount', 0) / 100  # Stripe usa centavos
    currency = event_data.get('currency', 'brl').upper()
    customer_id = event_data.get('customer')
    
    # Buscar tenant pelo customer_id
    payment_method = PaymentMethod.objects.filter(
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        return
    
    tenant = payment_method.tenant
    
    # Buscar ou criar payment
    payment, created = Payment.objects.get_or_create(
        stripe_payment_intent_id=payment_intent_id,
        defaults={
            'tenant': tenant,
            'payment_method': payment_method,
            'amount': amount,
            'currency': currency,
            'status': 'succeeded',
            'paid_at': timezone.now(),
        }
    )
    
    if not created:
        payment.status = 'succeeded'
        payment.paid_at = timezone.now()
        payment.save()


@transaction.atomic
def handle_payment_intent_failed(event_data):
    """Processa pagamento falhado"""
    payment_intent_id = event_data.get('id')
    failure_reason = event_data.get('last_payment_error', {}).get('message', '')
    customer_id = event_data.get('customer')
    
    # Buscar tenant pelo customer_id
    payment_method = PaymentMethod.objects.filter(
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        return
    
    tenant = payment_method.tenant
    
    # Buscar ou criar payment
    payment, created = Payment.objects.get_or_create(
        stripe_payment_intent_id=payment_intent_id,
        defaults={
            'tenant': tenant,
            'payment_method': payment_method,
            'status': 'failed',
            'failed_at': timezone.now(),
            'failure_reason': failure_reason,
        }
    )
    
    if not created:
        payment.status = 'failed'
        payment.failed_at = timezone.now()
        payment.failure_reason = failure_reason
        payment.save()


@transaction.atomic
def handle_invoice_payment_succeeded(event_data):
    """Processa fatura paga com sucesso"""
    invoice_id = event_data.get('id')
    subscription_id = event_data.get('subscription')
    amount = event_data.get('amount_paid', 0) / 100
    currency = event_data.get('currency', 'brl').upper()
    customer_id = event_data.get('customer')
    
    # Buscar tenant pelo customer_id
    payment_method = PaymentMethod.objects.filter(
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        return
    
    tenant = payment_method.tenant
    
    # Buscar subscription
    subscription = Subscription.objects.filter(
        tenant=tenant,
        payment_gateway_id=subscription_id
    ).first()
    
    if not subscription:
        return
    
    # Buscar ou criar invoice
    invoice, created = Invoice.objects.get_or_create(
        stripe_invoice_id=invoice_id,
        defaults={
            'tenant': tenant,
            'subscription': subscription,
            'amount': amount,
            'currency': currency,
            'period_start': timezone.now(),
            'period_end': timezone.now() + timedelta(days=30),
            'due_date': timezone.now(),
            'is_paid': True,
            'paid_at': timezone.now(),
        }
    )
    
    if not created:
        invoice.is_paid = True
        invoice.paid_at = timezone.now()
        invoice.save()


@transaction.atomic
def handle_invoice_payment_failed(event_data):
    """Processa falha no pagamento de fatura"""
    invoice_id = event_data.get('id')
    subscription_id = event_data.get('subscription')
    customer_id = event_data.get('customer')
    
    # Buscar tenant pelo customer_id
    payment_method = PaymentMethod.objects.filter(
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        return
    
    tenant = payment_method.tenant
    
    # Buscar subscription
    subscription = Subscription.objects.filter(
        tenant=tenant,
        payment_gateway_id=subscription_id
    ).first()
    
    if not subscription:
        return
    
    # Atualizar invoice se existir
    invoice = Invoice.objects.filter(
        stripe_invoice_id=invoice_id
    ).first()
    
    if invoice:
        invoice.is_paid = False
        invoice.save()
    
    # Atualizar subscription para past_due
    subscription.status = 'past_due'
    subscription.save()


@transaction.atomic
def handle_subscription_created(event_data):
    """Processa criação de assinatura"""
    subscription_id = event_data.get('id')
    customer_id = event_data.get('customer')
    status = event_data.get('status', 'active')
    
    # Buscar tenant pelo customer_id
    payment_method = PaymentMethod.objects.filter(
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        return
    
    tenant = payment_method.tenant
    
    # Atualizar subscription se existir
    subscription = Subscription.objects.filter(
        tenant=tenant
    ).order_by('-created_at').first()
    
    if subscription:
        subscription.payment_gateway_id = subscription_id
        subscription.status = status
        subscription.save()


@transaction.atomic
def handle_subscription_updated(event_data):
    """Processa atualização de assinatura"""
    subscription_id = event_data.get('id')
    status = event_data.get('status', 'active')
    current_period_start = event_data.get('current_period_start')
    current_period_end = event_data.get('current_period_end')
    cancel_at_period_end = event_data.get('cancel_at_period_end', False)
    
    # Buscar subscription
    subscription = Subscription.objects.filter(
        payment_gateway_id=subscription_id
    ).first()
    
    if not subscription:
        return
    
    subscription.status = status
    subscription.cancel_at_period_end = cancel_at_period_end
    
    if current_period_start:
        subscription.current_period_start = datetime.fromtimestamp(
            current_period_start, tz=timezone.utc
        )
    if current_period_end:
        subscription.current_period_end = datetime.fromtimestamp(
            current_period_end, tz=timezone.utc
        )
    
    subscription.save()


@transaction.atomic
def handle_subscription_deleted(event_data):
    """Processa cancelamento de assinatura"""
    subscription_id = event_data.get('id')
    
    # Buscar subscription
    subscription = Subscription.objects.filter(
        payment_gateway_id=subscription_id
    ).first()
    
    if not subscription:
        return
    
    subscription.status = 'canceled'
    subscription.canceled_at = timezone.now()
    subscription.save()


@transaction.atomic
def handle_payment_method_attached(event_data):
    """Processa anexação de método de pagamento"""
    payment_method_id = event_data.get('id')
    customer_id = event_data.get('customer')
    
    # Atualizar payment method se existir
    payment_method = PaymentMethod.objects.filter(
        stripe_payment_method_id=payment_method_id
    ).first()
    
    if payment_method:
        payment_method.stripe_customer_id = customer_id
        payment_method.save()


@transaction.atomic
def handle_payment_method_detached(event_data):
    """Processa remoção de método de pagamento"""
    payment_method_id = event_data.get('id')
    
    # Desativar payment method
    payment_method = PaymentMethod.objects.filter(
        stripe_payment_method_id=payment_method_id
    ).first()
    
    if payment_method:
        payment_method.is_active = False
        payment_method.save()


@transaction.atomic
def handle_checkout_session_completed(event_data):
    """
    Processa conclusão de checkout session
    Cria ou atualiza subscription quando checkout é concluído
    """
    session_id = event_data.get('id')
    customer_id = event_data.get('customer')
    subscription_id = event_data.get('subscription')
    metadata = event_data.get('metadata', {})
    
    tenant_id = metadata.get('tenant_id')
    plan_id = metadata.get('plan_id')
    billing_cycle = metadata.get('billing_cycle', 'monthly')
    
    if not tenant_id or not plan_id:
        # Log de erro mas não falhar (pode ser checkout de outro sistema)
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Checkout session {session_id} sem metadata de tenant/plan")
        return
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Tenant {tenant_id} não encontrado para checkout session {session_id}")
        return
    
    # Buscar ou criar PaymentMethod com customer_id
    payment_method = PaymentMethod.objects.filter(
        tenant=tenant,
        stripe_customer_id=customer_id
    ).first()
    
    if not payment_method:
        # Criar PaymentMethod básico se não existir
        payment_method = PaymentMethod.objects.create(
            tenant=tenant,
            type='card',  # Assumir cartão por padrão
            stripe_customer_id=customer_id,
            is_default=True,
        )
    
    # Buscar plano
    try:
        from subscriptions.models import Plan
        plan = Plan.objects.get(id=plan_id)
    except Plan.DoesNotExist:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Plano {plan_id} não encontrado para checkout session {session_id}")
        return
    
    # Buscar ou criar Subscription
    subscription = Subscription.objects.filter(
        tenant=tenant
    ).first()
    
    if subscription:
        # Atualizar subscription existente
        subscription.plan = plan
        subscription.payment_gateway_id = subscription_id
        subscription.status = 'active'
        subscription.billing_cycle = billing_cycle
        
        # Atualizar períodos se disponível no Stripe
        if subscription_id and settings.STRIPE_MODE != 'simulated':
            try:
                import stripe
                stripe_sub = stripe.Subscription.retrieve(subscription_id)
                subscription.current_period_start = datetime.fromtimestamp(
                    stripe_sub['current_period_start'], tz=timezone.utc
                )
                subscription.current_period_end = datetime.fromtimestamp(
                    stripe_sub['current_period_end'], tz=timezone.utc
                )
            except Exception:
                pass  # Se falhar, usar valores padrão
        
        subscription.save()
    else:
        # Criar nova subscription
        period_start = timezone.now()
        if billing_cycle == 'yearly':
            period_end = period_start + timedelta(days=365)
        else:
            period_end = period_start + timedelta(days=30)
        
        subscription = Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            status='active',
            billing_cycle=billing_cycle,
            current_period_start=period_start,
            current_period_end=period_end,
            payment_gateway_id=subscription_id,
        )

