"""
Admin para Sistema de Assinaturas
"""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse
from .models import Plan, Feature, Subscription, QuotaUsage
import stripe


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 
        'price_monthly', 
        'price_yearly', 
        'max_users', 
        'is_active', 
        'is_trial',
        'display_order'
    ]
    list_filter = ['is_active', 'is_trial', 'created_at']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('name', 'slug', 'description', 'display_order')
        }),
        ('Preços', {
            'fields': ('price_monthly', 'price_yearly')
        }),
        ('Limites', {
            'fields': ('max_users', 'max_empresas', 'max_filiais', 'max_storage_gb')
        }),
        ('Trial', {
            'fields': ('is_trial', 'trial_days')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )
    
    filter_horizontal = ['features']
    
    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('features')


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'tenant_link',
        'plan',
        'status_badge',
        'billing_cycle',
        'current_period_end',
        'days_until_expiry_display',
        'is_active_display',
    ]
    list_filter = ['status', 'plan', 'billing_cycle', 'created_at']
    search_fields = ['tenant__name', 'plan__name', 'payment_gateway_id']
    readonly_fields = [
        'created_at', 
        'updated_at',
        'days_until_expiry_display',
        'is_active_display',
        'stripe_subscription_link',
        'stripe_customer_info',
    ]
    
    fieldsets = (
        ('Assinatura', {
            'fields': ('tenant', 'plan', 'status', 'billing_cycle')
        }),
        ('Stripe', {
            'fields': ('payment_gateway_id', 'stripe_subscription_link', 'stripe_customer_info'),
            'classes': ('collapse',)
        }),
        ('Período', {
            'fields': ('current_period_start', 'current_period_end', 'days_until_expiry_display')
        }),
        ('Cancelamento', {
            'fields': ('cancel_at_period_end', 'canceled_at')
        }),
        ('Status', {
            'fields': ('is_active_display', 'created_at', 'updated_at')
        }),
        ('Notas', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )
    
    actions = [
        'activate_subscription',
        'cancel_subscription',
        'renew_30_days',
        'renew_90_days',
        'renew_365_days',
    ]
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
    
    def status_badge(self, obj):
        """Badge colorido para status"""
        colors = {
            'trial': 'blue',
            'pending': 'yellow',
            'active': 'green',
            'past_due': 'orange',
            'canceled': 'red',
            'expired': 'gray',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def days_until_expiry_display(self, obj):
        """Exibe dias até expiração"""
        days = obj.days_until_expiry
        if days == 0:
            return format_html('<span style="color: red;">Expirado</span>')
        elif days <= 7:
            return format_html('<span style="color: orange;">{} dias</span>', days)
        else:
            return f'{days} dias'
    days_until_expiry_display.short_description = 'Dias até Expiração'
    
    def is_active_display(self, obj):
        """Exibe se está ativa"""
        if obj.is_active:
            return format_html('<span style="color: green;">✓ Ativa</span>')
        else:
            return format_html('<span style="color: red;">✗ Inativa</span>')
    is_active_display.short_description = 'Ativa'
    
    def stripe_subscription_link(self, obj):
        """Link para a assinatura no Stripe Dashboard"""
        if not obj.payment_gateway_id:
            return '-'
        
        # Determinar URL base do Stripe baseado no ambiente
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        if stripe_mode == 'live':
            base_url = 'https://dashboard.stripe.com'
        else:
            base_url = 'https://dashboard.stripe.com/test'
        
        url = f'{base_url}/subscriptions/{obj.payment_gateway_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.payment_gateway_id
        )
    stripe_subscription_link.short_description = 'Stripe Subscription'
    
    def stripe_customer_info(self, obj):
        """Informações do cliente no Stripe"""
        if not obj.payment_gateway_id:
            return '-'
        
        # Tentar buscar informações do Stripe se possível
        try:
            from payments.services import StripeService
            stripe_service = StripeService()
            
            # Se estiver em modo simulado, retornar info básica
            if stripe_service._is_simulated():
                return format_html(
                    '<p><strong>Modo Simulado:</strong> Informações do Stripe não disponíveis</p>'
                )
            
            # Buscar subscription do Stripe
            import stripe
            subscription = stripe.Subscription.retrieve(obj.payment_gateway_id)
            customer_id = subscription.customer
            
            # Buscar customer
            customer = stripe.Customer.retrieve(customer_id)
            
            # Determinar URL base do Stripe
            from django.conf import settings
            stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
            if stripe_mode == 'live':
                base_url = 'https://dashboard.stripe.com'
            else:
                base_url = 'https://dashboard.stripe.com/test'
            
            customer_url = f'{base_url}/customers/{customer_id}'
            
            html = '<div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px;">'
            html += f'<p><strong>Customer ID:</strong> <a href="{customer_url}" target="_blank">{customer_id} 🔗</a></p>'
            if customer.email:
                html += f'<p><strong>Email:</strong> {customer.email}</p>'
            if customer.name:
                html += f'<p><strong>Nome:</strong> {customer.name}</p>'
            html += f'<p><strong>Status Stripe:</strong> {subscription.status}</p>'
            if subscription.cancel_at_period_end:
                html += '<p><strong style="color: orange;">⚠️ Cancelará ao fim do período</strong></p>'
            html += '</div>'
            
            return format_html(html)
        except Exception as e:
            return format_html(
                '<p style="color: orange;">⚠️ Erro ao buscar informações do Stripe: {}</p>',
                str(e)
            )
    stripe_customer_info.short_description = 'Informações do Stripe'
    
    def activate_subscription(self, request, queryset):
        """Ativa assinaturas selecionadas"""
        count = 0
        for subscription in queryset:
            subscription.activate()
            count += 1
        self.message_user(
            request, 
            f'{count} assinatura(s) ativada(s) com sucesso.',
            level='success'
        )
    activate_subscription.short_description = "Ativar assinaturas selecionadas"
    
    def cancel_subscription(self, request, queryset):
        """Cancela assinaturas selecionadas"""
        count = 0
        for subscription in queryset:
            subscription.cancel()
            count += 1
        self.message_user(
            request, 
            f'{count} assinatura(s) cancelada(s) com sucesso.',
            level='warning'
        )
    cancel_subscription.short_description = "Cancelar assinaturas selecionadas"
    
    def renew_30_days(self, request, queryset):
        """Renova assinaturas por 30 dias"""
        count = 0
        for subscription in queryset:
            subscription.renew(30)
            count += 1
        self.message_user(
            request, 
            f'{count} assinatura(s) renovada(s) por 30 dias.',
            level='success'
        )
    renew_30_days.short_description = "Renovar por 30 dias"
    
    def renew_90_days(self, request, queryset):
        """Renova assinaturas por 90 dias"""
        count = 0
        for subscription in queryset:
            subscription.renew(90)
            count += 1
        self.message_user(
            request, 
            f'{count} assinatura(s) renovada(s) por 90 dias.',
            level='success'
        )
    renew_90_days.short_description = "Renovar por 90 dias"
    
    def renew_365_days(self, request, queryset):
        """Renova assinaturas por 365 dias"""
        count = 0
        for subscription in queryset:
            subscription.renew(365)
            count += 1
        self.message_user(
            request, 
            f'{count} assinatura(s) renovada(s) por 365 dias.',
            level='success'
        )
    renew_365_days.short_description = "Renovar por 365 dias"


@admin.register(QuotaUsage)
class QuotaUsageAdmin(admin.ModelAdmin):
    list_display = [
        'tenant_link',
        'users_count',
        'empresas_count',
        'filiais_count',
        'storage_display',
        'updated_at',
    ]
    list_filter = ['updated_at']
    search_fields = ['tenant__name']
    readonly_fields = [
        'users_count',
        'empresas_count',
        'filiais_count',
        'storage_mb',
        'updated_at',
        'usage_summary',
    ]
    
    fieldsets = (
        ('Tenant', {
            'fields': ('tenant',)
        }),
        ('Uso Atual', {
            'fields': (
                'users_count',
                'empresas_count',
                'filiais_count',
                'storage_display',
                'usage_summary',
            )
        }),
        ('Informações', {
            'fields': ('updated_at',)
        }),
    )
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
    
    def storage_display(self, obj):
        """Exibe storage em formato legível"""
        if obj.storage_mb < 1024:
            return f'{obj.storage_mb} MB'
        else:
            return f'{obj.storage_mb / 1024:.2f} GB'
    storage_display.short_description = 'Armazenamento'
    
    def usage_summary(self, obj):
        """Resumo de uso vs limites"""
        subscription = getattr(obj.tenant, 'subscription', None)
        if not subscription or not subscription.is_active:
            return format_html('<p style="color: red;">Sem assinatura ativa</p>')
        
        plan = subscription.plan
        html = '<table style="width: 100%;">'
        html += '<tr><th>Recurso</th><th>Usado</th><th>Limite</th><th>%</th></tr>'
        
        quotas = [
            ('Usuários', obj.users_count, plan.max_users),
            ('Empresas', obj.empresas_count, plan.max_empresas),
            ('Filiais', obj.filiais_count, plan.max_filiais),
            ('Storage', obj.storage_mb, plan.max_storage_gb * 1024),
        ]
        
        for name, used, limit in quotas:
            percent = (used / limit * 100) if limit > 0 else 0
            color = 'green' if percent < 80 else 'orange' if percent < 100 else 'red'
            html += f'<tr>'
            html += f'<td>{name}</td>'
            html += f'<td>{used}</td>'
            html += f'<td>{limit}</td>'
            html += f'<td style="color: {color};">{percent:.1f}%</td>'
            html += f'</tr>'
        
        html += '</table>'
        return format_html(html)
    usage_summary.short_description = 'Resumo de Uso'

