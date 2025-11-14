"""
Admin para modelos de autenticação e permissões
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import reverse
from .models import UserProfile, TenantMembership
from django.contrib.auth import get_user_model

User = get_user_model()

# User admin já está registrado pelo Django, não precisa registrar novamente


class TenantMembershipInline(admin.TabularInline):
    """Inline para mostrar membros de um tenant"""
    model = TenantMembership
    extra = 0
    fields = ['user', 'role', 'is_active', 'joined_at']
    readonly_fields = ['joined_at']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin para perfil de usuário"""
    list_display = [
        'user_link',
        'current_tenant_link',
        'current_empresa',
        'current_filial',
        'phone',
        'created_at',
    ]
    list_filter = ['current_tenant', 'created_at']
    search_fields = ['user__username', 'user__email', 'phone']
    readonly_fields = ['created_at', 'updated_at', 'tenants_list']
    
    fieldsets = (
        ('Usuário', {
            'fields': ('user',)
        }),
        ('Contexto Atual', {
            'fields': ('current_tenant', 'current_empresa', 'current_filial')
        }),
        ('Informações', {
            'fields': ('phone',)  # avatar temporariamente desabilitado
        }),
        ('Tenants com Acesso', {
            'fields': ('tenants_list',),
            'classes': ('collapse',)
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def user_link(self, obj):
        """Link para o usuário"""
        url = reverse('admin:accounts_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)
    user_link.short_description = 'Usuário'
    
    def current_tenant_link(self, obj):
        """Link para o tenant atual"""
        if obj.current_tenant:
            url = reverse('admin:tenants_tenant_change', args=[obj.current_tenant.pk])
            return format_html('<a href="{}">{}</a>', url, obj.current_tenant.name)
        return '-'
    current_tenant_link.short_description = 'Tenant Atual'
    
    def tenants_list(self, obj):
        """Lista todos os tenants que o usuário tem acesso"""
        memberships = TenantMembership.objects.filter(user=obj.user, is_active=True)
        if not memberships.exists():
            return 'Nenhum tenant'
        
        html = '<ul>'
        for membership in memberships:
            url = reverse('admin:tenants_tenant_change', args=[membership.tenant.pk])
            html += f'<li><a href="{url}">{membership.tenant.name}</a> ({membership.get_role_display()})</li>'
        html += '</ul>'
        return format_html(html)
    tenants_list.short_description = 'Tenants com Acesso'


@admin.register(TenantMembership)
class TenantMembershipAdmin(admin.ModelAdmin):
    """Admin para membros de tenants"""
    list_display = [
        'user_link',
        'tenant_link',
        'role',
        'is_active',
        'joined_at',
    ]
    list_filter = ['role', 'is_active', 'tenant', 'joined_at']
    search_fields = ['user__username', 'user__email', 'tenant__name']
    readonly_fields = ['joined_at']
    
    fieldsets = (
        ('Membro', {
            'fields': ('user', 'tenant')
        }),
        ('Permissões', {
            'fields': ('role', 'is_active')
        }),
        ('Informações', {
            'fields': ('joined_at',)
        }),
    )
    
    def user_link(self, obj):
        """Link para o usuário"""
        url = reverse('admin:accounts_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)
    user_link.short_description = 'Usuário'
    
    def tenant_link(self, obj):
        """Link para o tenant"""
        url = reverse('admin:tenants_tenant_change', args=[obj.tenant.pk])
        return format_html('<a href="{}">{}</a>', url, obj.tenant.name)
    tenant_link.short_description = 'Tenant'
