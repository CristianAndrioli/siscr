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
    
    IMPORTANTE: Para desenvolvimento local, use Stripe CLI:
    stripe listen --forward-to localhost:8000/api/webhooks/stripe/
    
    Os webhooks são logados no console e no Django logging.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    # Log da requisição recebida
    logger.info(f"[WEBHOOK] Requisição recebida de {request.META.get('REMOTE_ADDR', 'unknown')}")
    logger.info(f"[WEBHOOK] Content-Type: {request.META.get('CONTENT_TYPE', 'unknown')}")
    logger.info(f"[WEBHOOK] Payload size: {len(payload)} bytes")
    
    # Verificar assinatura do webhook
    # Stripe CLI usa um webhook secret especial (whsec_...)
    # Em desenvolvimento com Stripe CLI, podemos aceitar sem verificação ou usar o secret do CLI
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    
    if settings.STRIPE_MODE == 'simulated':
        # Em modo simulado, apenas parsear JSON
        try:
            event = json.loads(payload)
            logger.info(f"[WEBHOOK] Modo simulado - Evento parseado sem verificação")
        except json.JSONDecodeError:
            logger.error("[WEBHOOK] Erro ao parsear JSON em modo simulado")
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
                logger.info(f"[WEBHOOK] Assinatura verificada com sucesso")
            except ValueError as e:
                logger.error(f"[WEBHOOK] Erro ao parsear payload: {str(e)}")
                return HttpResponse(status=400)
            except stripe.error.SignatureVerificationError as e:
                logger.error(f"[WEBHOOK] Erro na verificação de assinatura: {str(e)}")
                return HttpResponse(status=400)
        else:
            # Sem secret configurado (desenvolvimento local com Stripe CLI)
            # Aceitar evento sem verificação (NÃO RECOMENDADO EM PRODUÇÃO)
            try:
                event = json.loads(payload)
                logger.warning("[WEBHOOK] ⚠️ Modo desenvolvimento - Evento aceito SEM verificação de assinatura")
            except json.JSONDecodeError:
                logger.error("[WEBHOOK] Erro ao parsear JSON")
                return HttpResponse(status=400)
    
    # Processar evento
    event_type = event.get('type')
    event_id = event.get('id', 'unknown')
    event_data = event.get('data', {}).get('object', {})
    
    # Log do evento recebido
    logger.info(f"[WEBHOOK] ✅ Evento recebido: {event_type} (ID: {event_id})")
    logger.info(f"[WEBHOOK] Event data keys: {list(event_data.keys())}")
    if 'metadata' in event_data:
        logger.info(f"[WEBHOOK] Metadata: {event_data.get('metadata', {})}")
    logger.debug(f"[WEBHOOK] Event data: {json.dumps(event_data, indent=2, default=str)}")
    
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
        
        logger.info(f"[WEBHOOK] ✅ Evento {event_type} processado com sucesso")
        return JsonResponse({'status': 'success', 'event_type': event_type, 'event_id': event_id})
    except Exception as e:
        # Log do erro
        logger.error(f"[WEBHOOK] ❌ Erro ao processar webhook {event_type} (ID: {event_id}): {str(e)}", exc_info=True)
        return JsonResponse({'error': str(e), 'event_type': event_type, 'event_id': event_id}, status=500)


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
    import logging
    logger = logging.getLogger(__name__)
    
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
    
    # Reativar tenant se estiver suspenso
    if not tenant.is_active:
        tenant.is_active = True
        tenant.save()
        logger.info(f"[WEBHOOK] Tenant {tenant.name} reativado após pagamento bem-sucedido")
        # Chamar tarefa Celery para reativação (envia notificação)
        from subscriptions.tasks import reactivate_tenant
        reactivate_tenant.delay(tenant.id)
    else:
        # Enviar notificação de pagamento bem-sucedido
        from subscriptions.notifications import SubscriptionNotificationService
        notification_service = SubscriptionNotificationService()
        notification_service.send_payment_succeeded_notification(subscription)


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
    
    # Enviar notificação de pagamento falhado
    from subscriptions.notifications import SubscriptionNotificationService
    notification_service = SubscriptionNotificationService()
    notification_service.send_payment_failed_notification(subscription)


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
    import logging
    logger = logging.getLogger(__name__)
    
    session_id = event_data.get('id')
    customer_id = event_data.get('customer')
    subscription_id = event_data.get('subscription')
    metadata = event_data.get('metadata', {})
    
    logger.info(f"[WEBHOOK] [checkout.session.completed] Processando session_id={session_id}")
    logger.info(f"[WEBHOOK] [checkout.session.completed] Metadata recebida: {metadata}")
    
    tenant_id = metadata.get('tenant_id')
    plan_id = metadata.get('plan_id')
    billing_cycle = metadata.get('billing_cycle', 'monthly')
    
    if not tenant_id or not plan_id:
        # Log de erro mas não falhar (pode ser checkout de outro sistema)
        logger.warning(f"[WEBHOOK] [checkout.session.completed] Checkout session {session_id} sem metadata de tenant/plan. Metadata: {metadata}")
        return
    
    logger.info(f"[WEBHOOK] [checkout.session.completed] Tenant ID: {tenant_id}, Plan ID: {plan_id}, Billing Cycle: {billing_cycle}")
    
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
        logger.info(f"[WEBHOOK] [checkout.session.completed] Subscription encontrada: ID={subscription.id}, Status atual={subscription.status}")
        subscription.plan = plan
        subscription.payment_gateway_id = subscription_id
        # Ativar subscription quando pagamento for confirmado
        # Se estava 'pending', agora fica 'active'
        old_status = subscription.status
        if subscription.status == 'pending':
            subscription.status = 'active'
            logger.info(f"[WEBHOOK] [checkout.session.completed] ✅ Status alterado de 'pending' para 'active'")
        elif subscription.status not in ['active', 'trial']:
            # Se estava cancelada/expirada, reativar
            subscription.status = 'active'
            logger.info(f"[WEBHOOK] [checkout.session.completed] ✅ Status alterado de '{old_status}' para 'active'")
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
                logger.info(f"[WEBHOOK] [checkout.session.completed] Períodos atualizados do Stripe")
            except Exception as e:
                logger.warning(f"[WEBHOOK] [checkout.session.completed] Erro ao buscar períodos do Stripe: {str(e)}")
                # Se falhar, usar valores padrão
        
        subscription.save()
        logger.info(f"[WEBHOOK] [checkout.session.completed] ✅ Subscription {subscription.id} salva com status '{subscription.status}'")
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

