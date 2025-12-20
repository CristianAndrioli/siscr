"""
Views da API de pagamentos
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db import connection
from django.conf import settings
import logging
from ..models import PaymentMethod, Payment, Invoice

logger = logging.getLogger(__name__)
from ..services import stripe_service
from ..api.serializers import (
    PaymentMethodSerializer, PaymentSerializer, InvoiceSerializer,
    CreatePaymentMethodSerializer, CreateSubscriptionSerializer
)
from subscriptions.models import Subscription, Plan
from accounts.models import UserProfile


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_payment_methods(request):
    """
    Lista métodos de pagamento do tenant atual
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    payment_methods = PaymentMethod.objects.filter(
        tenant=tenant,
        is_active=True
    )
    
    serializer = PaymentMethodSerializer(payment_methods, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_payment_method(request):
    """
    Cria um novo método de pagamento
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    serializer = CreatePaymentMethodSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    payment_type = serializer.validated_data['type']
    payment_method_data = serializer.validated_data.get('payment_method_data', {})
    
    # Buscar ou criar customer no Stripe
    profile = getattr(request.user, 'profile', None)
    if not profile or not profile.current_tenant:
        return Response(
            {'error': 'Perfil de usuário não encontrado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Buscar customer existente ou criar novo
    existing_pm = PaymentMethod.objects.filter(
        tenant=tenant,
        is_active=True
    ).first()
    
    if existing_pm and existing_pm.stripe_customer_id:
        customer_id = existing_pm.stripe_customer_id
    else:
        # Criar customer no Stripe
        customer = stripe_service.create_customer(
            tenant=tenant,
            email=request.user.email,
            name=request.user.get_full_name() or request.user.username
        )
        customer_id = customer['id']
    
    # Preparar dados do payment method
    if payment_type == 'card':
        if not payment_method_data:
            payment_method_data = {
                'type': 'card',
                'card': {
                    'number': serializer.validated_data.get('card_number', '4242424242424242'),
                    'exp_month': serializer.validated_data.get('exp_month', 12),
                    'exp_year': serializer.validated_data.get('exp_year', 2025),
                    'cvc': serializer.validated_data.get('cvc', '123'),
                }
            }
    
    # Criar payment method no Stripe
    stripe_pm = stripe_service.create_payment_method(
        customer_id=customer_id,
        payment_method_data=payment_method_data
    )
    
    # Salvar no banco
    payment_method = PaymentMethod.objects.create(
        tenant=tenant,
        type=payment_type,
        stripe_payment_method_id=stripe_pm['id'],
        stripe_customer_id=customer_id,
        last4=stripe_pm.get('card', {}).get('last4', '') if payment_type == 'card' else '',
        brand=stripe_pm.get('card', {}).get('brand', '') if payment_type == 'card' else '',
        exp_month=stripe_pm.get('card', {}).get('exp_month') if payment_type == 'card' else None,
        exp_year=stripe_pm.get('card', {}).get('exp_year') if payment_type == 'card' else None,
        is_default=not PaymentMethod.objects.filter(tenant=tenant, is_default=True).exists(),
    )
    
    serializer_response = PaymentMethodSerializer(payment_method)
    return Response(serializer_response.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_payments(request):
    """
    Lista pagamentos do tenant atual
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    payments = Payment.objects.filter(tenant=tenant).order_by('-created_at')
    serializer = PaymentSerializer(payments, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_invoices(request):
    """
    Lista faturas do tenant atual
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    invoices = Invoice.objects.filter(tenant=tenant).order_by('-created_at')
    serializer = InvoiceSerializer(invoices, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_subscription(request):
    """
    Cria uma nova assinatura com pagamento
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    serializer = CreateSubscriptionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    plan_id = serializer.validated_data['plan_id']
    payment_method_id = serializer.validated_data.get('payment_method_id')
    billing_cycle = serializer.validated_data.get('billing_cycle', 'monthly')
    
    # Buscar plano
    try:
        plan = Plan.objects.get(id=plan_id, is_active=True)
    except Plan.DoesNotExist:
        return Response(
            {'error': 'Plano não encontrado'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Buscar payment method se fornecido
    payment_method = None
    if payment_method_id:
        try:
            payment_method = PaymentMethod.objects.get(
                id=payment_method_id,
                tenant=tenant,
                is_active=True
            )
        except PaymentMethod.DoesNotExist:
            return Response(
                {'error': 'Método de pagamento não encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    # Buscar customer ID
    if payment_method and payment_method.stripe_customer_id:
        customer_id = payment_method.stripe_customer_id
    else:
        # Criar customer se não existir
        profile = getattr(request.user, 'profile', None)
        customer = stripe_service.create_customer(
            tenant=tenant,
            email=request.user.email,
            name=request.user.get_full_name() or request.user.username
        )
        customer_id = customer['id']
    
    # Criar price ID (simulado - em produção, criar prices no Stripe)
    price_id = f'price_{plan.slug}_{billing_cycle}'
    
    # Criar subscription no Stripe
    stripe_subscription = stripe_service.create_subscription(
        customer_id=customer_id,
        price_id=price_id,
        payment_method_id=payment_method.stripe_payment_method_id if payment_method else None
    )
    
    # Criar subscription no banco
    from django.utils import timezone
    from datetime import timedelta
    
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
    )
    
    # Salvar stripe_subscription_id no campo payment_gateway_id
    subscription.payment_gateway_id = stripe_subscription['id']
    subscription.save()
    
    return Response({
        'subscription': {
            'id': subscription.id,
            'plan': plan.name,
            'status': subscription.status,
            'billing_cycle': billing_cycle,
            'current_period_end': subscription.current_period_end.isoformat(),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """
    Cria uma sessão de checkout do Stripe para assinatura
    Retorna URL para redirecionar o cliente
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        logger.error('Tenant não identificado ao criar checkout session')
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    plan_id = request.data.get('plan_id')
    billing_cycle = request.data.get('billing_cycle', 'monthly')
    
    if not plan_id:
        logger.error('plan_id não fornecido')
        return Response(
            {'error': 'plan_id é obrigatório'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se Stripe está configurado
    stripe_mode = getattr(settings, 'STRIPE_MODE', 'simulated')
    stripe_secret_key = getattr(settings, 'STRIPE_SECRET_KEY_TEST', '')
    
    if stripe_mode == 'test' and not stripe_secret_key:
        logger.error('STRIPE_SECRET_KEY_TEST não configurado')
        return Response(
            {
                'error': 'Stripe não está configurado. Configure STRIPE_SECRET_KEY_TEST via variável de ambiente.',
                'details': 'Adicione STRIPE_SECRET_KEY_TEST ao docker-compose.yml ou variáveis de ambiente'
            }, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Buscar plano
    try:
        plan = Plan.objects.get(id=plan_id, is_active=True)
        logger.info(f'Plano encontrado: {plan.name} (ID: {plan.id}, Slug: {plan.slug})')
    except Plan.DoesNotExist:
        logger.error(f'Plano não encontrado: ID {plan_id}')
        return Response(
            {'error': f'Plano com ID {plan_id} não encontrado ou inativo'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Obter Stripe Price ID
    price_id = plan.get_stripe_price_id(billing_cycle)
    if not price_id:
        logger.error(f'Plano {plan.name} não tem Stripe Price ID configurado para {billing_cycle}')
        logger.info(f'stripe_price_id_monthly: {plan.stripe_price_id_monthly}')
        logger.info(f'stripe_price_id_yearly: {plan.stripe_price_id_yearly}')
        return Response(
            {
                'error': f'Plano {plan.name} não tem Stripe Price ID configurado para {billing_cycle}',
                'details': f'Execute: python manage.py update_stripe_price_ids para configurar os Price IDs',
                'plan_slug': plan.slug,
                'plan_name': plan.name
            }, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    logger.info(f'Price ID encontrado: {price_id} para plano {plan.name}')
    
    # Buscar ou criar customer no Stripe
    existing_pm = PaymentMethod.objects.filter(
        tenant=tenant,
        is_active=True
    ).first()
    
    customer_id = None
    if existing_pm and existing_pm.stripe_customer_id:
        customer_id = existing_pm.stripe_customer_id
    else:
        # Criar customer se não existir
        customer = stripe_service.create_customer(
            tenant=tenant,
            email=request.user.email,
            name=request.user.get_full_name() or request.user.username
        )
        customer_id = customer['id']
    
    # URLs de sucesso e cancelamento
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    success_url = f"{frontend_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_url}/checkout/cancel"
    
    # Metadata para identificar tenant e plano
    metadata = {
        'tenant_id': str(tenant.id),
        'tenant_name': tenant.name,
        'plan_id': str(plan.id),
        'plan_slug': plan.slug,
        'billing_cycle': billing_cycle,
    }
    
    # Criar checkout session
    try:
        logger.info(f'Criando checkout session para tenant {tenant.id}, plano {plan.id}, price_id {price_id}')
        
        session = stripe_service.create_checkout_session(
            price_id=price_id,
            customer_id=customer_id,
            customer_email=request.user.email if not customer_id else None,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
        
        logger.info(f'Checkout session criada: {session.get("id")}')
        
        return Response({
            'checkout_url': session['url'],
            'session_id': session['id'],
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f'Erro ao criar checkout session: {str(e)}\n{error_trace}')
        
        # Retornar mensagem de erro mais detalhada em desenvolvimento
        error_message = str(e)
        if settings.DEBUG:
            error_message = f'{error_message}\n\nTraceback:\n{error_trace}'
        
        return Response(
            {'error': f'Erro ao criar checkout session: {error_message}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_checkout_session(request, session_id):
    """
    Recupera informações de uma sessão de checkout
    Usado após redirecionamento do Stripe
    """
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        session = stripe_service.retrieve_checkout_session(session_id)
        
        # Verificar se a sessão pertence ao tenant
        if session.get('metadata', {}).get('tenant_id') != str(tenant.id):
            return Response(
                {'error': 'Sessão não pertence a este tenant'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response({
            'session_id': session['id'],
            'payment_status': session.get('payment_status'),
            'subscription_id': session.get('subscription'),
            'customer_id': session.get('customer'),
        })
    except Exception as e:
        return Response(
            {'error': f'Erro ao recuperar checkout session: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
