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


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Webhook do Stripe para processar eventos
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    # Verificar assinatura do webhook (apenas em produção/test)
    if settings.STRIPE_MODE != 'simulated':
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError:
            return HttpResponse(status=400)
    else:
        # Em modo simulado, apenas parsear JSON
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return HttpResponse(status=400)
    
    # Processar evento
    event_type = event.get('type')
    event_data = event.get('data', {}).get('object', {})
    
    try:
        if event_type == 'payment_intent.succeeded':
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
        print(f"Erro ao processar webhook: {str(e)}")
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

