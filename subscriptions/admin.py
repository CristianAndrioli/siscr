"""
Admin para Sistema de Assinaturas
"""
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.urls import reverse
from .models import Plan, Feature, Subscription, QuotaUsage


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
    ]
    
    fieldsets = (
        ('Assinatura', {
            'fields': ('tenant', 'plan', 'status', 'billing_cycle')
        }),
        ('Período', {
            'fields': ('current_period_start', 'current_period_end', 'days_until_expiry_display')
        }),
        ('Cancelamento', {
            'fields': ('cancel_at_period_end', 'canceled_at')
        }),
        ('Pagamento', {
            'fields': ('payment_gateway_id',)
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

