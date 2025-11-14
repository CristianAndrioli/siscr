"""
Admin para gerenciar pagamentos
"""
from django.contrib import admin
from .models import PaymentMethod, Payment, Invoice


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'type', 'last4', 'brand', 'is_default', 'is_active', 'created_at']
    list_filter = ['type', 'is_default', 'is_active', 'created_at']
    search_fields = ['tenant__name', 'stripe_payment_method_id', 'stripe_customer_id']
    readonly_fields = ['stripe_payment_method_id', 'stripe_customer_id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'type', 'is_default', 'is_active')
        }),
        ('Dados do Stripe', {
            'fields': ('stripe_payment_method_id', 'stripe_customer_id')
        }),
        ('Dados do Cartão', {
            'fields': ('last4', 'brand', 'exp_month', 'exp_year')
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'subscription', 'amount', 'currency', 'status', 'paid_at', 'created_at']
    list_filter = ['status', 'currency', 'created_at', 'paid_at']
    search_fields = ['tenant__name', 'stripe_payment_intent_id', 'stripe_charge_id', 'description']
    readonly_fields = ['stripe_payment_intent_id', 'stripe_charge_id', 'created_at', 'updated_at', 'paid_at', 'failed_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'subscription', 'payment_method', 'status')
        }),
        ('Dados do Stripe', {
            'fields': ('stripe_payment_intent_id', 'stripe_charge_id')
        }),
        ('Valores', {
            'fields': ('amount', 'currency')
        }),
        ('Datas', {
            'fields': ('paid_at', 'failed_at', 'created_at', 'updated_at')
        }),
        ('Detalhes', {
            'fields': ('description', 'failure_reason')
        }),
    )


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'subscription', 'amount', 'currency', 'is_paid', 'due_date', 'paid_at', 'created_at']
    list_filter = ['is_paid', 'currency', 'created_at', 'due_date']
    search_fields = ['tenant__name', 'stripe_invoice_id']
    readonly_fields = ['stripe_invoice_id', 'created_at', 'updated_at', 'paid_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'subscription', 'payment', 'is_paid')
        }),
        ('Dados do Stripe', {
            'fields': ('stripe_invoice_id', 'pdf_url')
        }),
        ('Valores', {
            'fields': ('amount', 'currency')
        }),
        ('Período', {
            'fields': ('period_start', 'period_end', 'due_date', 'paid_at')
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at')
        }),
    )

