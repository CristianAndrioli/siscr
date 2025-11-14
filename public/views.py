"""
Views públicas para cadastro de novos clientes
"""
from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from tenants.models import Tenant, Domain, Empresa
from subscriptions.models import Plan, Subscription, QuotaUsage
from accounts.models import UserProfile, TenantMembership
from django.core.mail import send_mail
from django.conf import settings

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def available_plans(request):
    """
    Lista planos disponíveis para cadastro público
    """
    plans = Plan.objects.filter(is_active=True).order_by('display_order', 'price_monthly')
    
    return Response([
        {
            'id': plan.id,
            'name': plan.name,
            'slug': plan.slug,
            'description': plan.description,
            'price_monthly': str(plan.price_monthly),
            'price_yearly': str(plan.price_yearly) if plan.price_yearly else None,
            'max_users': plan.max_users,
            'max_empresas': plan.max_empresas,
            'max_filiais': plan.max_filiais,
            'max_storage_gb': plan.max_storage_gb,
            'is_trial': plan.is_trial,
            'trial_days': plan.trial_days,
            'features': [
                {
                    'name': f.name,
                    'description': f.description,
                    'icon': f.icon,
                }
                for f in plan.features.all()
            ],
        }
        for plan in plans
    ])


@api_view(['POST'])
@permission_classes([AllowAny])
def check_domain(request):
    """
    Verifica se domínio/subdomínio está disponível
    """
    domain = request.data.get('domain', '').strip().lower()
    
    if not domain:
        return Response(
            {'error': 'Domínio não fornecido'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validar formato básico
    if not domain.replace('.', '').replace('-', '').isalnum():
        return Response(
            {'error': 'Domínio inválido. Use apenas letras, números, pontos e hífens'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se já existe
    exists = Domain.objects.filter(domain=domain).exists()
    
    return Response({
        'domain': domain,
        'available': not exists,
        'message': 'Domínio disponível' if not exists else 'Domínio já está em uso',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@transaction.atomic
def signup(request):
    """
    Cadastro público de novo cliente
    Cria automaticamente: Tenant, Schema, Domain, User, Empresa, Subscription
    """
    # Dados do tenant
    tenant_name = request.data.get('tenant_name', '').strip()
    domain = request.data.get('domain', '').strip().lower()
    plan_id = request.data.get('plan_id')
    
    # Dados do usuário admin
    admin_username = request.data.get('admin_username', '').strip()
    admin_email = request.data.get('admin_email', '').strip().lower()
    admin_password = request.data.get('admin_password', '')
    admin_first_name = request.data.get('admin_first_name', '').strip()
    admin_last_name = request.data.get('admin_last_name', '').strip()
    
    # Dados da empresa
    empresa_nome = request.data.get('empresa_nome', '').strip()
    empresa_cnpj = request.data.get('empresa_cnpj', '').strip()
    empresa_razao_social = request.data.get('empresa_razao_social', '').strip()
    
    # Validações básicas
    if not all([tenant_name, domain, plan_id, admin_username, admin_email, admin_password, empresa_nome]):
        return Response(
            {'error': 'Campos obrigatórios não preenchidos'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se domínio já existe
    if Domain.objects.filter(domain=domain).exists():
        return Response(
            {'error': 'Domínio já está em uso. Escolha outro domínio.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se email já existe
    if User.objects.filter(email=admin_email).exists():
        return Response(
            {'error': 'Email já está cadastrado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se username já existe
    if User.objects.filter(username=admin_username).exists():
        return Response(
            {'error': 'Username já está em uso'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Buscar plano
    try:
        plan = Plan.objects.get(id=plan_id, is_active=True)
    except Plan.DoesNotExist:
        return Response(
            {'error': 'Plano inválido ou inativo'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Criar schema_name a partir do domínio
    schema_name = domain.replace('.', '_').replace('-', '_')[:63]
    # Garantir que não comece com número
    if schema_name[0].isdigit():
        schema_name = 't_' + schema_name
    
    # Verificar se schema já existe
    if Tenant.objects.filter(schema_name=schema_name).exists():
        return Response(
            {'error': 'Domínio já está em uso'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Criar tenant
        tenant = Tenant.objects.create(
            schema_name=schema_name,
            name=tenant_name,
            is_active=True,
        )
        
        # Criar domínio
        Domain.objects.create(
            domain=domain,
            tenant=tenant,
            is_primary=True,
        )
        
        # Criar schema e aplicar migrations
        tenant.save()  # Isso cria o schema automaticamente
        
        # Criar usuário admin no schema do tenant E no schema público
        # Primeiro criar no schema público (para TenantMembership)
        user_public = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            first_name=admin_first_name,
            last_name=admin_last_name,
            is_staff=True,
            is_superuser=True,
        )
        
        # Depois criar no schema do tenant (para uso dentro do tenant)
        with schema_context(tenant.schema_name):
            user_tenant = User.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                first_name=admin_first_name,
                last_name=admin_last_name,
                is_staff=True,
                is_superuser=True,
            )
            
            # Criar empresa
            empresa = Empresa.objects.create(
                tenant=tenant,
                nome=empresa_nome,
                cnpj=empresa_cnpj or '',
                razao_social=empresa_razao_social or empresa_nome,
            )
        
        # Criar UserProfile e TenantMembership (no schema público, usando user_public)
        profile = UserProfile.objects.create(
            user=user_public,
            current_tenant=tenant,
            current_empresa=empresa,
        )
        
        TenantMembership.objects.create(
            user=user_public,
            tenant=tenant,
            role='admin',
            is_active=True,
        )
        
        # Criar assinatura
        period_start = timezone.now()
        if plan.is_trial:
            period_end = period_start + timedelta(days=plan.trial_days)
            subscription_status = 'trial'
        else:
            period_end = period_start + timedelta(days=30)
            subscription_status = 'active'
        
        subscription = Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            status=subscription_status,
            billing_cycle='monthly',
            current_period_start=period_start,
            current_period_end=period_end,
        )
        
        # Criar quota usage
        QuotaUsage.objects.create(tenant=tenant)
        
        # Enviar email de boas-vindas (se configurado)
        try:
            if hasattr(settings, 'DEFAULT_FROM_EMAIL') and settings.DEFAULT_FROM_EMAIL:
                send_mail(
                    subject=f'Bem-vindo ao SISCR, {admin_first_name or admin_username}!',
                    message=f'''
Olá {admin_first_name or admin_username},

Seu cadastro foi realizado com sucesso!

Tenant: {tenant_name}
Domínio: {domain}
Plano: {plan.name}
Login: http://{domain}/login/

Use suas credenciais para acessar:
- Usuário: {admin_username}
- Email: {admin_email}

Bem-vindo ao SISCR!
                    ''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[admin_email],
                    fail_silently=True,
                )
        except Exception as e:
            # Não falhar se email não puder ser enviado
            pass
        
        return Response({
            'success': True,
            'message': 'Cadastro realizado com sucesso!',
            'tenant': {
                'id': tenant.id,
                'name': tenant.name,
                'domain': domain,
            },
            'user': {
                'username': user_public.username,
                'email': user_public.email,
            },
            'subscription': {
                'plan': plan.name,
                'status': subscription_status,
                'expires_at': period_end.isoformat(),
            },
            'login_url': f'http://{domain}/login/',
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': f'Erro ao criar cadastro: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
