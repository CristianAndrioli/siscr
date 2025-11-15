"""
Models para Sistema de Pagamentos com Stripe
"""
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal
from tenants.models import Tenant
from subscriptions.models import Subscription
from core.base_models import SiscrModelBase


class PaymentMethod(SiscrModelBase):
    """
    Método de pagamento do cliente (cartão, PIX, etc.)
    Armazenado no schema público (shared)
    """
    TYPE_CHOICES = [
        ('card', 'Cartão de Crédito'),
        ('pix', 'PIX'),
        ('boleto', 'Boleto'),
    ]
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='payment_methods',
        verbose_name='Tenant'
    )
    
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        verbose_name='Tipo'
    )
    
    # Dados do Stripe
    stripe_payment_method_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Stripe Payment Method ID'
    )
    stripe_customer_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='Stripe Customer ID'
    )
    
    # Dados do cartão (últimos 4 dígitos)
    last4 = models.CharField(
        max_length=4,
        blank=True,
        null=True,
        verbose_name='Últimos 4 dígitos'
    )
    brand = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Bandeira'
    )
    exp_month = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Mês de expiração'
    )
    exp_year = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Ano de expiração'
    )
    
    # Status
    is_default = models.BooleanField(
        default=False,
        verbose_name='Método padrão'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Ativo'
    )
    
    class Meta:
        verbose_name = 'Método de Pagamento'
        verbose_name_plural = 'Métodos de Pagamento'
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['stripe_payment_method_id']),
        ]
    
    def __str__(self):
        if self.type == 'card' and self.last4:
            return f"{self.get_type_display()} •••• {self.last4}"
        return f"{self.get_type_display()} - {self.tenant.name}"


class Payment(SiscrModelBase):
    """
    Pagamento individual (cobrança de assinatura)
    Armazenado no schema público (shared)
    """
    STATUS_CHOICES = [
        ('pending', 'Pendente'),
        ('processing', 'Processando'),
        ('succeeded', 'Pago'),
        ('failed', 'Falhou'),
        ('canceled', 'Cancelado'),
        ('refunded', 'Reembolsado'),
    ]
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name='Tenant'
    )
    
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name='Assinatura'
    )
    
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name='Método de Pagamento'
    )
    
    # Dados do Stripe
    stripe_payment_intent_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Stripe Payment Intent ID'
    )
    stripe_charge_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Stripe Charge ID'
    )
    
    # Valores
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor (R$)'
    )
    currency = models.CharField(
        max_length=3,
        default='BRL',
        verbose_name='Moeda'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Status'
    )
    
    # Datas
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Pago em'
    )
    failed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Falhou em'
    )
    
    # Metadados
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descrição'
    )
    failure_reason = models.TextField(
        blank=True,
        null=True,
        verbose_name='Motivo da falha'
    )
    
    class Meta:
        verbose_name = 'Pagamento'
        verbose_name_plural = 'Pagamentos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.tenant.name} - R$ {self.amount} ({self.get_status_display()})"


class Invoice(SiscrModelBase):
    """
    Fatura gerada para o tenant
    Armazenado no schema público (shared)
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='invoices',
        verbose_name='Tenant'
    )
    
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name='invoices',
        verbose_name='Assinatura'
    )
    
    payment = models.OneToOneField(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice',
        verbose_name='Pagamento'
    )
    
    # Dados do Stripe
    stripe_invoice_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Stripe Invoice ID'
    )
    
    # Valores
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor (R$)'
    )
    currency = models.CharField(
        max_length=3,
        default='BRL',
        verbose_name='Moeda'
    )
    
    # Datas
    period_start = models.DateTimeField(verbose_name='Início do período')
    period_end = models.DateTimeField(verbose_name='Fim do período')
    due_date = models.DateTimeField(verbose_name='Data de vencimento')
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Pago em'
    )
    
    # Status
    is_paid = models.BooleanField(
        default=False,
        verbose_name='Pago'
    )
    
    # PDF
    pdf_url = models.URLField(
        blank=True,
        null=True,
        verbose_name='URL do PDF'
    )
    
    class Meta:
        verbose_name = 'Fatura'
        verbose_name_plural = 'Faturas'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'is_paid']),
            models.Index(fields=['stripe_invoice_id']),
            models.Index(fields=['due_date']),
        ]
    
    def __str__(self):
        return f"Fatura #{self.id} - {self.tenant.name} - R$ {self.amount}"

