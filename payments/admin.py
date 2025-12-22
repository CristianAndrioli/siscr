"""
Admin para gerenciar pagamentos
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import PaymentMethod, Payment, Invoice


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['tenant_link', 'type', 'card_display', 'is_default', 'is_active', 'created_at']
    list_filter = ['type', 'is_default', 'is_active', 'created_at']
    search_fields = ['tenant__name', 'stripe_payment_method_id', 'stripe_customer_id']
    readonly_fields = [
        'stripe_payment_method_id', 
        'stripe_customer_id', 
        'stripe_payment_method_link',
        'stripe_customer_link',
        'card_info_display',
        'created_at', 
        'updated_at'
    ]
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'type', 'is_default', 'is_active')
        }),
        ('Stripe', {
            'fields': ('stripe_payment_method_id', 'stripe_payment_method_link', 'stripe_customer_id', 'stripe_customer_link'),
            'classes': ('collapse',)
        }),
        ('Dados do Cartão', {
            'fields': ('card_info_display', 'last4', 'brand', 'exp_month', 'exp_year')
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
    
    def card_display(self, obj):
        """Exibe informações do cartão"""
        if obj.type == 'card' and obj.last4:
            brand = obj.brand or 'Cartão'
            exp = ''
            if obj.exp_month and obj.exp_year:
                exp = f' ({obj.exp_month:02d}/{obj.exp_year})'
            return f'{brand} •••• {obj.last4}{exp}'
        return obj.get_type_display()
    card_display.short_description = 'Método de Pagamento'
    
    def stripe_payment_method_link(self, obj):
        """Link para o payment method no Stripe"""
        if not obj.stripe_payment_method_id:
            return '-'
        
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
        url = f'{base_url}/payment_methods/{obj.stripe_payment_method_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.stripe_payment_method_id
        )
    stripe_payment_method_link.short_description = 'Stripe Payment Method'
    
    def stripe_customer_link(self, obj):
        """Link para o customer no Stripe"""
        if not obj.stripe_customer_id:
            return '-'
        
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
        url = f'{base_url}/customers/{obj.stripe_customer_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.stripe_customer_id
        )
    stripe_customer_link.short_description = 'Stripe Customer'
    
    def card_info_display(self, obj):
        """Exibe informações completas do cartão"""
        if obj.type != 'card':
            return format_html('<p>Não é um cartão</p>')
        
        if not obj.last4:
            return format_html('<p style="color: gray;">Sem informações do cartão</p>')
        
        html = '<div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px;">'
        html += f'<p><strong>Bandeira:</strong> {obj.brand or "N/A"}</p>'
        html += f'<p><strong>Últimos 4 dígitos:</strong> •••• {obj.last4}</p>'
        if obj.exp_month and obj.exp_year:
            html += f'<p><strong>Expira em:</strong> {obj.exp_month:02d}/{obj.exp_year}</p>'
        html += '</div>'
        return format_html(html)
    card_info_display.short_description = 'Informações do Cartão'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['tenant_link', 'amount_display', 'status_badge', 'paid_at', 'stripe_links', 'created_at']
    list_filter = ['status', 'currency', 'created_at', 'paid_at']
    search_fields = ['tenant__name', 'stripe_payment_intent_id', 'stripe_charge_id', 'description']
    readonly_fields = [
        'stripe_payment_intent_id', 
        'stripe_charge_id',
        'stripe_payment_intent_link',
        'stripe_charge_link',
        'stripe_payment_info',
        'created_at', 
        'updated_at', 
        'paid_at', 
        'failed_at'
    ]
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'subscription', 'payment_method', 'status')
        }),
        ('Stripe', {
            'fields': ('stripe_payment_intent_id', 'stripe_payment_intent_link', 'stripe_charge_id', 'stripe_charge_link', 'stripe_payment_info'),
            'classes': ('collapse',)
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
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
    
    def amount_display(self, obj):
        """Exibe valor formatado"""
        return f'R$ {obj.amount:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    amount_display.short_description = 'Valor'
    
    def status_badge(self, obj):
        """Badge colorido para status"""
        colors = {
            'pending': '#ffc107',
            'processing': '#17a2b8',
            'succeeded': '#28a745',
            'failed': '#dc3545',
            'canceled': '#6c757d',
            'refunded': '#6f42c1',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def stripe_links(self, obj):
        """Links para o Stripe"""
        links = []
        if obj.stripe_payment_intent_id:
            from django.conf import settings
            stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
            base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
            url = f'{base_url}/payments/{obj.stripe_payment_intent_id}'
            links.append(format_html('<a href="{}" target="_blank">PI 🔗</a>', url))
        if obj.stripe_charge_id:
            from django.conf import settings
            stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
            base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
            url = f'{base_url}/payments/{obj.stripe_charge_id}'
            links.append(format_html('<a href="{}" target="_blank">Charge 🔗</a>', url))
        return format_html(' | '.join(links)) if links else '-'
    stripe_links.short_description = 'Stripe'
    
    def stripe_payment_intent_link(self, obj):
        """Link para o Payment Intent no Stripe"""
        if not obj.stripe_payment_intent_id:
            return '-'
        
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
        url = f'{base_url}/payments/{obj.stripe_payment_intent_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.stripe_payment_intent_id
        )
    stripe_payment_intent_link.short_description = 'Stripe Payment Intent'
    
    def stripe_charge_link(self, obj):
        """Link para o Charge no Stripe"""
        if not obj.stripe_charge_id:
            return '-'
        
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
        url = f'{base_url}/payments/{obj.stripe_charge_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.stripe_charge_id
        )
    stripe_charge_link.short_description = 'Stripe Charge'
    
    def stripe_payment_info(self, obj):
        """Informações do pagamento no Stripe"""
        if not obj.stripe_payment_intent_id:
            return format_html('<p style="color: gray;">Sem informações do Stripe</p>')
        
        try:
            from payments.services import StripeService
            stripe_service = StripeService()
            
            if stripe_service._is_simulated():
                return format_html(
                    '<p><strong>Modo Simulado:</strong> Informações do Stripe não disponíveis</p>'
                )
            
            import stripe
            payment_intent = stripe.PaymentIntent.retrieve(obj.stripe_payment_intent_id)
            
            html = '<div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px;">'
            html += f'<p><strong>Status Stripe:</strong> {payment_intent.status}</p>'
            html += f'<p><strong>Valor:</strong> R$ {payment_intent.amount / 100:,.2f}</p>'
            if payment_intent.charges and len(payment_intent.charges.data) > 0:
                charge = payment_intent.charges.data[0]
                html += f'<p><strong>Método:</strong> {charge.payment_method_details.type if hasattr(charge.payment_method_details, "type") else "N/A"}</p>'
            html += '</div>'
            
            return format_html(html)
        except Exception as e:
            return format_html(
                '<p style="color: orange;">⚠️ Erro ao buscar informações: {}</p>',
                str(e)
            )
    stripe_payment_info.short_description = 'Informações do Stripe'


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['tenant_link', 'amount_display', 'is_paid_badge', 'due_date', 'stripe_invoice_link', 'created_at']
    list_filter = ['is_paid', 'currency', 'created_at', 'due_date']
    search_fields = ['tenant__name', 'stripe_invoice_id']
    readonly_fields = [
        'stripe_invoice_id', 
        'stripe_invoice_link',
        'stripe_invoice_info',
        'created_at', 
        'updated_at', 
        'paid_at'
    ]
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'subscription', 'payment', 'is_paid')
        }),
        ('Stripe', {
            'fields': ('stripe_invoice_id', 'stripe_invoice_link', 'stripe_invoice_info', 'pdf_url'),
            'classes': ('collapse',)
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
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
    
    def amount_display(self, obj):
        """Exibe valor formatado"""
        return f'R$ {obj.amount:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    amount_display.short_description = 'Valor'
    
    def is_paid_badge(self, obj):
        """Badge para status de pagamento"""
        if obj.is_paid:
            return format_html(
                '<span style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 3px; font-size: 11px;">✓ Pago</span>'
            )
        else:
            return format_html(
                '<span style="background-color: #ffc107; color: black; padding: 3px 8px; border-radius: 3px; font-size: 11px;">⚠ Pendente</span>'
            )
    is_paid_badge.short_description = 'Status'
    
    def stripe_invoice_link(self, obj):
        """Link para a invoice no Stripe"""
        if not obj.stripe_invoice_id:
            return '-'
        
        from django.conf import settings
        stripe_mode = getattr(settings, 'STRIPE_MODE', 'test')
        base_url = 'https://dashboard.stripe.com' if stripe_mode == 'live' else 'https://dashboard.stripe.com/test'
        url = f'{base_url}/invoices/{obj.stripe_invoice_id}'
        return format_html(
            '<a href="{}" target="_blank" style="color: #635bff;">{} <span style="font-size: 12px;">🔗</span></a>',
            url,
            obj.stripe_invoice_id
        )
    stripe_invoice_link.short_description = 'Stripe Invoice'
    
    def stripe_invoice_info(self, obj):
        """Informações da invoice no Stripe"""
        if not obj.stripe_invoice_id:
            return format_html('<p style="color: gray;">Sem informações do Stripe</p>')
        
        try:
            from payments.services import StripeService
            stripe_service = StripeService()
            
            if stripe_service._is_simulated():
                return format_html(
                    '<p><strong>Modo Simulado:</strong> Informações do Stripe não disponíveis</p>'
                )
            
            import stripe
            invoice = stripe.Invoice.retrieve(obj.stripe_invoice_id)
            
            html = '<div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px;">'
            html += f'<p><strong>Status Stripe:</strong> {invoice.status}</p>'
            html += f'<p><strong>Valor:</strong> R$ {invoice.amount_due / 100:,.2f}</p>'
            if invoice.paid:
                html += '<p><strong style="color: green;">✓ Pago</strong></p>'
            else:
                html += '<p><strong style="color: orange;">⚠ Pendente</strong></p>'
            if invoice.hosted_invoice_url:
                html += f'<p><a href="{invoice.hosted_invoice_url}" target="_blank">Ver Invoice no Stripe 🔗</a></p>'
            html += '</div>'
            
            return format_html(html)
        except Exception as e:
            return format_html(
                '<p style="color: orange;">⚠️ Erro ao buscar informações: {}</p>',
                str(e)
            )
    stripe_invoice_info.short_description = 'Informações do Stripe'

