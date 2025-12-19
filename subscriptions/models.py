"""
Models para Sistema de Assinaturas SaaS
"""
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
from tenants.models import Tenant
from core.base_models import SiscrModelBase


class Plan(SiscrModelBase):
    """
    Plano de assinatura (Básico, Pro, Enterprise)
    Armazenado no schema público (shared)
    """
    name = models.CharField(max_length=100, verbose_name='Nome do Plano')
    slug = models.SlugField(unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, null=True, verbose_name='Descrição')
    
    # Preços
    price_monthly = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Preço Mensal (R$)'
    )
    price_yearly = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Preço Anual (R$)'
    )
    
    # Limites
    max_users = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)],
        verbose_name='Máximo de Usuários'
    )
    max_empresas = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)],
        verbose_name='Máximo de Empresas'
    )
    max_filiais = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)],
        verbose_name='Máximo de Filiais'
    )
    max_storage_gb = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)],
        verbose_name='Armazenamento (GB)'
    )
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_trial = models.BooleanField(default=False, verbose_name='Plano Trial')
    trial_days = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='Dias de Trial'
    )
    
    # Ordem de exibição
    display_order = models.IntegerField(
        default=0, 
        verbose_name='Ordem de Exibição'
    )
    
    # Funcionalidades
    features = models.ManyToManyField(
        'Feature',
        related_name='plans',
        blank=True,
        verbose_name='Funcionalidades'
    )
    
    # Stripe Price IDs
    stripe_price_id_monthly = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Stripe Price ID (Mensal)',
        help_text='ID do preço mensal no Stripe (ex: price_xxx)'
    )
    stripe_price_id_yearly = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Stripe Price ID (Anual)',
        help_text='ID do preço anual no Stripe (ex: price_xxx)'
    )
    
    class Meta:
        verbose_name = 'Plano'
        verbose_name_plural = 'Planos'
        ordering = ['display_order', 'price_monthly']
        indexes = [
            models.Index(fields=['is_active', 'display_order']),
        ]
    
    def __str__(self):
        return self.name
    
    def get_stripe_price_id(self, billing_cycle='monthly'):
        """
        Retorna o Stripe Price ID baseado no ciclo de cobrança
        """
        if billing_cycle == 'yearly':
            return self.stripe_price_id_yearly or self.stripe_price_id_monthly
        return self.stripe_price_id_monthly


class Feature(SiscrModelBase):
    """
    Funcionalidades disponíveis por plano
    Armazenado no schema público (shared)
    """
    name = models.CharField(max_length=100, verbose_name='Nome')
    description = models.TextField(blank=True, null=True, verbose_name='Descrição')
    icon = models.CharField(
        max_length=50, 
        blank=True, 
        null=True,
        verbose_name='Ícone (classe CSS)'
    )
    
    class Meta:
        verbose_name = 'Funcionalidade'
        verbose_name_plural = 'Funcionalidades'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Subscription(SiscrModelBase):
    """
    Assinatura de um tenant
    Armazenado no schema público (shared)
    """
    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Ativa'),
        ('past_due', 'Pagamento Atrasado'),
        ('canceled', 'Cancelada'),
        ('expired', 'Expirada'),
    ]
    
    BILLING_CYCLE_CHOICES = [
        ('monthly', 'Mensal'),
        ('yearly', 'Anual'),
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
    
    billing_cycle = models.CharField(
        max_length=20,
        choices=BILLING_CYCLE_CHOICES,
        default='monthly',
        verbose_name='Ciclo de Cobrança'
    )
    
    # Período
    current_period_start = models.DateTimeField(verbose_name='Início do Período')
    current_period_end = models.DateTimeField(verbose_name='Fim do Período')
    
    # Cancelamento
    cancel_at_period_end = models.BooleanField(
        default=False, 
        verbose_name='Cancelar ao Fim do Período'
    )
    canceled_at = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name='Cancelado em'
    )
    
    # Pagamento
    payment_gateway_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name='ID no Gateway de Pagamento'
    )
    
    # Notas
    notes = models.TextField(
        blank=True, 
        null=True,
        verbose_name='Notas Internas'
    )
    
    class Meta:
        verbose_name = 'Assinatura'
        verbose_name_plural = 'Assinaturas'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'current_period_end']),
            models.Index(fields=['tenant']),
        ]
    
    def __str__(self):
        return f"{self.tenant.name} - {self.plan.name} ({self.get_status_display()})"
    
    @property
    def is_active(self):
        """Verifica se assinatura está ativa"""
        if self.status not in ['active', 'trial']:
            return False
        return self.current_period_end > timezone.now()
    
    @property
    def days_until_expiry(self):
        """Retorna dias até expiração"""
        if not self.is_active:
            return 0
        delta = self.current_period_end - timezone.now()
        return max(0, delta.days)
    
    def cancel(self):
        """Cancela assinatura ao fim do período"""
        self.cancel_at_period_end = True
        self.canceled_at = timezone.now()
        self.status = 'canceled'
        self.save()
    
    def activate(self):
        """Ativa assinatura"""
        self.status = 'active'
        self.cancel_at_period_end = False
        self.canceled_at = None
        self.save()
    
    def renew(self, days=30):
        """Renova assinatura por N dias"""
        self.current_period_start = timezone.now()
        self.current_period_end = timezone.now() + timezone.timedelta(days=days)
        if self.status == 'expired':
            self.status = 'active'
        self.save()


class QuotaUsage(SiscrModelBase):
    """
    Uso atual de quotas por tenant
    Armazenado no schema público (shared)
    Atualizado automaticamente quando recursos são criados/deletados
    """
    tenant = models.OneToOneField(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='quota_usage',
        verbose_name='Tenant'
    )
    
    # Contadores
    users_count = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='Usuários'
    )
    empresas_count = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='Empresas'
    )
    filiais_count = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='Filiais'
    )
    storage_mb = models.IntegerField(
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='Armazenamento (MB)'
    )
    
    class Meta:
        verbose_name = 'Uso de Quota'
        verbose_name_plural = 'Usos de Quota'
        indexes = [
            models.Index(fields=['tenant']),
        ]
    
    def __str__(self):
        return f"Uso de {self.tenant.name}"
    
    def check_quota(self, quota_type, value=1):
        """
        Verifica se pode usar mais recursos
        quota_type: 'users', 'empresas', 'filiais', 'storage'
        value: quantidade a adicionar
        """
        subscription = getattr(self.tenant, 'subscription', None)
        if not subscription or not subscription.is_active:
            return False, 'Assinatura inativa ou expirada'
        
        plan = subscription.plan
        
        # Mapear quota_type para campo do modelo
        quota_map = {
            'users': ('users_count', 'max_users'),
            'empresas': ('empresas_count', 'max_empresas'),
            'filiais': ('filiais_count', 'max_filiais'),
            'storage': ('storage_mb', 'max_storage_gb'),
        }
        
        if quota_type not in quota_map:
            return False, f'Tipo de quota inválido: {quota_type}'
        
        current_field, limit_field = quota_map[quota_type]
        current = getattr(self, current_field, 0)
        limit = getattr(plan, limit_field, 0)
        
        # Para storage, converter GB para MB
        if quota_type == 'storage':
            limit = limit * 1024  # GB para MB
        
        if (current + value) > limit:
            return False, f'Limite de {quota_type} atingido ({current}/{limit})'
        
        return True, 'OK'
    
    def increment_quota(self, quota_type, value=1):
        """Incrementa contador de quota"""
        success, message = self.check_quota(quota_type, value)
        if success:
            if quota_type == 'users':
                self.users_count += value
            elif quota_type == 'empresas':
                self.empresas_count += value
            elif quota_type == 'filiais':
                self.filiais_count += value
            elif quota_type == 'storage':
                self.storage_mb += value
            self.save()
        return success, message
    
    def decrement_quota(self, quota_type, value=1):
        """Decrementa contador de quota"""
        if quota_type == 'users':
            self.users_count = max(0, self.users_count - value)
        elif quota_type == 'empresas':
            self.empresas_count = max(0, self.empresas_count - value)
        elif quota_type == 'filiais':
            self.filiais_count = max(0, self.filiais_count - value)
        elif quota_type == 'storage':
            self.storage_mb = max(0, self.storage_mb - value)
        self.save()

