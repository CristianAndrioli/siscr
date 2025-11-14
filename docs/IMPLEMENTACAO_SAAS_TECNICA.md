# 🔧 Implementação Técnica: Transformando em SaaS

## 📦 1. SISTEMA DE ASSINATURAS

### 1.1 Criar App Subscriptions

```bash
python manage.py startapp subscriptions
```

### 1.2 Modelos de Assinatura

```python
# subscriptions/models.py
from django.db import models
from tenants.models import Tenant
from decimal import Decimal

class Plan(models.Model):
    """Plano de assinatura (Básico, Pro, Enterprise)"""
    name = models.CharField(max_length=100, verbose_name='Nome do Plano')
    slug = models.SlugField(unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Descrição')
    
    # Preços
    price_monthly = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        verbose_name='Preço Mensal'
    )
    price_yearly = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        verbose_name='Preço Anual'
    )
    
    # Limites
    max_users = models.IntegerField(default=1, verbose_name='Máximo de Usuários')
    max_empresas = models.IntegerField(default=1, verbose_name='Máximo de Empresas')
    max_filiais = models.IntegerField(default=1, verbose_name='Máximo de Filiais')
    max_storage_gb = models.IntegerField(default=1, verbose_name='Armazenamento (GB)')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_trial = models.BooleanField(default=False, verbose_name='Plano Trial')
    trial_days = models.IntegerField(default=0, verbose_name='Dias de Trial')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Plano'
        verbose_name_plural = 'Planos'
        ordering = ['price_monthly']
    
    def __str__(self):
        return self.name


class Feature(models.Model):
    """Funcionalidades disponíveis por plano"""
    name = models.CharField(max_length=100, verbose_name='Nome')
    description = models.TextField(blank=True, verbose_name='Descrição')
    plans = models.ManyToManyField(Plan, related_name='features', verbose_name='Planos')
    
    class Meta:
        verbose_name = 'Funcionalidade'
        verbose_name_plural = 'Funcionalidades'
    
    def __str__(self):
        return self.name


class Subscription(models.Model):
    """Assinatura de um tenant"""
    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Ativa'),
        ('past_due', 'Pagamento Atrasado'),
        ('canceled', 'Cancelada'),
        ('expired', 'Expirada'),
    ]
    
    tenant = models.OneToOneField(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='subscription',
        verbose_name='Tenant'
    )
    plan = models.ForeignKey(
        Plan, 
        on_delete=models.PROTECT, 
        related_name='subscriptions',
        verbose_name='Plano'
    )
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='trial',
        verbose_name='Status'
    )
    
    # Período
    current_period_start = models.DateTimeField(verbose_name='Início do Período')
    current_period_end = models.DateTimeField(verbose_name='Fim do Período')
    
    # Cancelamento
    cancel_at_period_end = models.BooleanField(
        default=False, 
        verbose_name='Cancelar ao Fim do Período'
    )
    canceled_at = models.DateTimeField(null=True, blank=True, verbose_name='Cancelado em')
    
    # Pagamento
    payment_gateway_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name='ID no Gateway de Pagamento'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Assinatura'
        verbose_name_plural = 'Assinaturas'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.tenant.name} - {self.plan.name}"
    
    @property
    def is_active(self):
        """Verifica se assinatura está ativa"""
        return self.status == 'active' and self.current_period_end > timezone.now()
    
    def cancel(self):
        """Cancela assinatura ao fim do período"""
        self.cancel_at_period_end = True
        self.canceled_at = timezone.now()
        self.save()


class QuotaUsage(models.Model):
    """Uso atual de quotas por tenant"""
    tenant = models.OneToOneField(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='quota_usage',
        verbose_name='Tenant'
    )
    
    # Contadores
    users_count = models.IntegerField(default=0, verbose_name='Usuários')
    empresas_count = models.IntegerField(default=0, verbose_name='Empresas')
    filiais_count = models.IntegerField(default=0, verbose_name='Filiais')
    storage_mb = models.IntegerField(default=0, verbose_name='Armazenamento (MB)')
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Uso de Quota'
        verbose_name_plural = 'Usos de Quota'
    
    def __str__(self):
        return f"Uso de {self.tenant.name}"
    
    def check_quota(self, quota_type, value=1):
        """Verifica se pode usar mais recursos"""
        subscription = self.tenant.subscription
        if not subscription or not subscription.is_active:
            return False
        
        plan = subscription.plan
        current = getattr(self, f"{quota_type}_count", 0)
        limit = getattr(plan, f"max_{quota_type}", 0)
        
        return (current + value) <= limit
```

### 1.3 Admin de Assinaturas

```python
# subscriptions/admin.py
from django.contrib import admin
from .models import Plan, Feature, Subscription, QuotaUsage

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'price_monthly', 'max_users', 'is_active']
    list_filter = ['is_active', 'is_trial']
    search_fields = ['name', 'description']
    filter_horizontal = ['features']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'plan', 'status', 'current_period_end', 'is_active']
    list_filter = ['status', 'plan']
    search_fields = ['tenant__name']
    readonly_fields = ['created_at', 'updated_at']
    
    actions = ['activate_subscription', 'cancel_subscription']
    
    def activate_subscription(self, request, queryset):
        from django.utils import timezone
        from datetime import timedelta
        
        for subscription in queryset:
            subscription.status = 'active'
            subscription.current_period_start = timezone.now()
            subscription.current_period_end = timezone.now() + timedelta(days=30)
            subscription.save()
        
        self.message_user(request, f"{queryset.count()} assinaturas ativadas.")
    
    activate_subscription.short_description = "Ativar assinaturas selecionadas"
    
    def cancel_subscription(self, request, queryset):
        for subscription in queryset:
            subscription.cancel()
        
        self.message_user(request, f"{queryset.count()} assinaturas canceladas.")
    
    cancel_subscription.short_description = "Cancelar assinaturas selecionadas"


@admin.register(QuotaUsage)
class QuotaUsageAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'users_count', 'empresas_count', 'filiais_count']
    readonly_fields = ['updated_at']
```

---

## 👤 2. SISTEMA DE USUÁRIOS MULTI-TENANT

### 2.1 Modelos de Usuário

```python
# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from tenants.models import Tenant, Empresa, Filial

class User(AbstractUser):
    """Usuário estendido do Django"""
    email = models.EmailField(unique=True, verbose_name='Email')
    
    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'


class UserProfile(models.Model):
    """Perfil do usuário vinculado a tenant"""
    ROLE_CHOICES = [
        ('super_admin', 'Super Administrador'),
        ('admin', 'Administrador'),
        ('manager', 'Gerente'),
        ('user', 'Usuário'),
        ('viewer', 'Visualizador'),
    ]
    
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile',
        verbose_name='Usuário'
    )
    
    # Tenant atual (usuário pode ter acesso a múltiplos)
    current_tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Tenant Atual'
    )
    
    # Empresa e Filial atuais
    current_empresa = models.ForeignKey(
        Empresa, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Empresa Atual'
    )
    
    current_filial = models.ForeignKey(
        Filial, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Filial Atual'
    )
    
    # Informações adicionais
    phone = models.CharField(max_length=20, blank=True, verbose_name='Telefone')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='Avatar')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Perfil de Usuário'
        verbose_name_plural = 'Perfis de Usuário'
    
    def __str__(self):
        return f"{self.user.username} - {self.current_tenant or 'Sem tenant'}"


class TenantMembership(models.Model):
    """Membros de um tenant (relação many-to-many)"""
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('manager', 'Gerente'),
        ('user', 'Usuário'),
        ('viewer', 'Visualizador'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='tenant_memberships',
        verbose_name='Usuário'
    )
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='members',
        verbose_name='Tenant'
    )
    
    role = models.CharField(
        max_length=20, 
        choices=ROLE_CHOICES, 
        default='user',
        verbose_name='Papel'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='Entrou em')
    
    class Meta:
        verbose_name = 'Membro do Tenant'
        verbose_name_plural = 'Membros dos Tenants'
        unique_together = ['user', 'tenant']
    
    def __str__(self):
        return f"{self.user.username} em {self.tenant.name} ({self.role})"
```

### 2.2 Settings - Custom User Model

```python
# siscr/settings.py
AUTH_USER_MODEL = 'accounts.User'
```

---

## 🔐 3. AUTENTICAÇÃO MULTI-TENANT

### 3.1 Views de Autenticação

```python
# accounts/views.py
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django_tenants.utils import get_tenant_from_request
from django.contrib.auth import authenticate
from .models import User, UserProfile, TenantMembership
from tenants.models import Empresa, Filial

@api_view(['POST'])
def login(request):
    """Login multi-tenant com seleção de empresa/filial"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    # Identificar tenant pela URL/subdomínio
    tenant = get_tenant_from_request(request)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Autenticar usuário
    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {'error': 'Credenciais inválidas'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Verificar se usuário tem acesso ao tenant
    membership = TenantMembership.objects.filter(
        user=user, 
        tenant=tenant, 
        is_active=True
    ).first()
    
    if not membership:
        return Response(
            {'error': 'Usuário não tem acesso a este tenant'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Obter empresas e filiais do usuário neste tenant
    empresas = Empresa.objects.filter(tenant=tenant)
    # Filtrar por permissões se necessário
    
    # Gerar tokens JWT
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    
    # Adicionar informações do tenant no token
    access['tenant_id'] = tenant.id
    access['tenant_name'] = tenant.name
    access['role'] = membership.role
    
    response_data = {
        'access': str(access),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': membership.role,
        },
        'tenant': {
            'id': tenant.id,
            'name': tenant.name,
        },
    }
    
    # Se múltiplas empresas, retornar lista para seleção
    if empresas.count() > 1:
        response_data['empresas'] = [
            {
                'id': emp.id,
                'nome': emp.nome,
                'filiais': [
                    {'id': fil.id, 'nome': fil.nome}
                    for fil in Filial.objects.filter(empresa=emp, is_active=True)
                ]
            }
            for emp in empresas
        ]
    elif empresas.count() == 1:
        # Se apenas uma empresa, definir como atual
        empresa = empresas.first()
        filiais = Filial.objects.filter(empresa=empresa, is_active=True)
        
        response_data['empresa'] = {
            'id': empresa.id,
            'nome': empresa.nome,
        }
        
        if filiais.count() == 1:
            response_data['filial'] = {
                'id': filiais.first().id,
                'nome': filiais.first().nome,
            }
        elif filiais.count() > 1:
            response_data['filiais'] = [
                {'id': fil.id, 'nome': fil.nome}
                for fil in filiais
            ]
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
def select_empresa_filial(request):
    """Seleciona empresa e filial após login"""
    empresa_id = request.data.get('empresa_id')
    filial_id = request.data.get('filial_id')
    
    try:
        profile = request.user.profile
        empresa = Empresa.objects.get(id=empresa_id, tenant=profile.current_tenant)
        profile.current_empresa = empresa
        
        if filial_id:
            filial = Filial.objects.get(id=filial_id, empresa=empresa)
            profile.current_filial = filial
        else:
            profile.current_filial = None
        
        profile.save()
        
        return Response({
            'empresa': {'id': empresa.id, 'nome': empresa.nome},
            'filial': {'id': profile.current_filial.id, 'nome': profile.current_filial.nome} if profile.current_filial else None,
        })
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )
```

### 3.2 Recuperação de Senha

```python
# accounts/views.py
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings

@api_view(['POST'])
def password_reset_request(request):
    """Solicita reset de senha"""
    email = request.data.get('email')
    
    try:
        user = User.objects.get(email=email)
        
        # Gerar token
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # URL de reset (frontend)
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"
        
        # Enviar email
        send_mail(
            subject='Redefinição de Senha - SISCR',
            message=f'Clique no link para redefinir sua senha: {reset_url}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=f'<p>Clique no link para redefinir sua senha:</p><p><a href="{reset_url}">{reset_url}</a></p>',
        )
        
        return Response({
            'message': 'Email de recuperação enviado'
        })
    except User.DoesNotExist:
        # Não revelar se email existe ou não (segurança)
        return Response({
            'message': 'Se o email existir, você receberá instruções'
        })


@api_view(['POST'])
def password_reset_confirm(request):
    """Confirma reset de senha"""
    uid = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
        
        # Verificar token
        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'Token inválido ou expirado'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Definir nova senha
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Senha redefinida com sucesso'
        })
    except Exception as e:
        return Response(
            {'error': 'Erro ao redefinir senha'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
```

---

## 🌐 4. CADASTRO PÚBLICO

### 4.1 Views de Cadastro Público

```python
# public/views.py
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django_tenants.utils import schema_context, tenant_context
from django.db import transaction
from tenants.models import Tenant, Domain, Empresa
from accounts.models import User, UserProfile, TenantMembership
from subscriptions.models import Plan, Subscription
from django.utils import timezone
from datetime import timedelta

@api_view(['GET'])
def available_plans(request):
    """Lista planos disponíveis"""
    plans = Plan.objects.filter(is_active=True)
    return Response([
        {
            'id': plan.id,
            'name': plan.name,
            'slug': plan.slug,
            'price_monthly': str(plan.price_monthly),
            'price_yearly': str(plan.price_yearly) if plan.price_yearly else None,
            'max_users': plan.max_users,
            'max_empresas': plan.max_empresas,
            'features': [f.name for f in plan.features.all()],
        }
        for plan in plans
    ])


@api_view(['POST'])
def check_domain(request):
    """Verifica se domínio/subdomínio está disponível"""
    domain = request.data.get('domain')
    
    if not domain:
        return Response(
            {'error': 'Domínio não fornecido'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se já existe
    exists = Domain.objects.filter(domain=domain).exists()
    
    return Response({
        'domain': domain,
        'available': not exists,
    })


@api_view(['POST'])
@transaction.atomic
def signup(request):
    """Cadastro público de novo cliente"""
    # Dados do tenant
    tenant_name = request.data.get('tenant_name')
    domain = request.data.get('domain')
    plan_id = request.data.get('plan_id')
    
    # Dados do usuário admin
    admin_username = request.data.get('admin_username')
    admin_email = request.data.get('admin_email')
    admin_password = request.data.get('admin_password')
    
    # Dados da empresa
    empresa_nome = request.data.get('empresa_nome')
    empresa_cnpj = request.data.get('empresa_cnpj')
    empresa_razao_social = request.data.get('empresa_razao_social')
    
    # Validações
    if Domain.objects.filter(domain=domain).exists():
        return Response(
            {'error': 'Domínio já está em uso'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        plan = Plan.objects.get(id=plan_id, is_active=True)
    except Plan.DoesNotExist:
        return Response(
            {'error': 'Plano inválido'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Criar tenant
    schema_name = domain.replace('.', '_').replace('-', '_')[:63]
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
    
    # Criar usuário admin
    with schema_context(tenant.schema_name):
        user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            is_staff=True,
            is_superuser=True,
        )
        
        # Criar perfil
        profile = UserProfile.objects.create(
            user=user,
            current_tenant=tenant,
        )
        
        # Criar membership
        TenantMembership.objects.create(
            user=user,
            tenant=tenant,
            role='admin',
            is_active=True,
        )
        
        # Criar empresa
        empresa = Empresa.objects.create(
            tenant=tenant,
            nome=empresa_nome,
            cnpj=empresa_cnpj,
            razao_social=empresa_razao_social,
        )
        
        profile.current_empresa = empresa
        profile.save()
    
    # Criar assinatura
    period_start = timezone.now()
    if plan.is_trial:
        period_end = period_start + timedelta(days=plan.trial_days)
        status_sub = 'trial'
    else:
        period_end = period_start + timedelta(days=30)
        status_sub = 'active'
    
    subscription = Subscription.objects.create(
        tenant=tenant,
        plan=plan,
        status=status_sub,
        current_period_start=period_start,
        current_period_end=period_end,
    )
    
    # Criar quota usage
    QuotaUsage.objects.create(tenant=tenant)
    
    # Enviar email de boas-vindas
    send_welcome_email(user, tenant, domain)
    
    return Response({
        'message': 'Cadastro realizado com sucesso',
        'tenant': {
            'id': tenant.id,
            'name': tenant.name,
            'domain': domain,
        },
        'login_url': f'https://{domain}/login/',
    }, status=status.HTTP_201_CREATED)
```

---

## 🛡️ 5. MIDDLEWARE DE QUOTAS

### 5.1 Middleware

```python
# subscriptions/middleware.py
from django.http import JsonResponse
from django_tenants.utils import get_tenant_from_request
from .models import Subscription, QuotaUsage

class QuotaMiddleware:
    """Middleware para verificar quotas antes de processar requisições"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Apenas verificar em requisições que criam recursos
        if request.method in ['POST', 'PUT', 'PATCH']:
            tenant = get_tenant_from_request(request)
            if tenant:
                subscription = getattr(tenant, 'subscription', None)
                if subscription and not subscription.is_active:
                    return JsonResponse(
                        {'error': 'Assinatura inativa ou expirada'}, 
                        status=402
                    )
        
        return self.get_response(request)
```

### 5.2 Decorador de Quota

```python
# subscriptions/decorators.py
from functools import wraps
from django.http import JsonResponse
from django_tenants.utils import get_tenant_from_request
from .models import QuotaUsage

def check_quota(quota_type):
    """Decorador para verificar quota antes de executar view"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            tenant = get_tenant_from_request(request)
            if tenant:
                quota_usage = getattr(tenant, 'quota_usage', None)
                if quota_usage:
                    if not quota_usage.check_quota(quota_type):
                        return JsonResponse(
                            {
                                'error': f'Limite de {quota_type} atingido',
                                'quota_type': quota_type,
                            }, 
                            status=403
                        )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
```

---

## 🔗 6. URLS MULTI-TENANT

### 6.1 URLs Públicas

```python
# siscr/public_urls.py
from django.urls import path
from public import views as public_views

urlpatterns = [
    path('signup/', public_views.signup_page, name='signup'),
    path('api/public/plans/', public_views.available_plans, name='public_plans'),
    path('api/public/check-domain/', public_views.check_domain, name='check_domain'),
    path('api/public/signup/', public_views.signup, name='public_signup'),
]
```

### 6.2 URLs por Tenant

```python
# siscr/tenant_urls.py
from django.urls import path, include
from accounts import views as auth_views

urlpatterns = [
    path('login/', auth_views.login, name='login'),
    path('api/auth/login/', auth_views.login, name='api_login'),
    path('api/auth/select-empresa/', auth_views.select_empresa_filial, name='select_empresa'),
    path('api/auth/password-reset/', auth_views.password_reset_request, name='password_reset'),
    path('api/auth/password-reset-confirm/', auth_views.password_reset_confirm, name='password_reset_confirm'),
    
    # Outras rotas do tenant
    path('', include('core.urls')),
    path('api/', include('cadastros.api.urls')),
]
```

### 6.3 Settings - Configuração de URLs

```python
# siscr/settings.py
PUBLIC_SCHEMA_URLCONF = 'siscr.public_urls'
TENANT_SCHEMA_URLCONF = 'siscr.tenant_urls'
```

---

## 📧 7. EMAIL DE BOAS-VINDAS

```python
# subscriptions/utils.py
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

def send_welcome_email(user, tenant, domain):
    """Envia email de boas-vindas"""
    subject = f'Bem-vindo ao SISCR, {user.username}!'
    
    html_message = render_to_string('emails/welcome.html', {
        'user': user,
        'tenant': tenant,
        'domain': domain,
        'login_url': f'https://{domain}/login/',
    })
    
    send_mail(
        subject=subject,
        message='',  # Versão texto (opcional)
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
    )
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Criar apps:**
   ```bash
   python manage.py startapp subscriptions
   python manage.py startapp public
   ```

2. **Adicionar aos settings:**
   ```python
   SHARED_APPS = [
       # ... apps existentes
       'subscriptions',  # App de assinaturas (shared)
   ]
   
   TENANT_APPS = [
       # ... apps existentes
       'accounts',  # Expandir app de autenticação
   ]
   ```

3. **Criar migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate_schemas --shared
   ```

4. **Configurar email:**
   ```python
   # settings.py
   EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
   EMAIL_HOST = 'smtp.gmail.com'
   EMAIL_PORT = 587
   EMAIL_USE_TLS = True
   EMAIL_HOST_USER = 'seu-email@gmail.com'
   EMAIL_HOST_PASSWORD = 'sua-senha'
   DEFAULT_FROM_EMAIL = 'SISCR <noreply@siscr.com.br>'
   ```

---

**Última atualização**: 2025-01-27

