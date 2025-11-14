"""
Views da API de pagamentos
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db import connection
from ..models import PaymentMethod, Payment, Invoice
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

