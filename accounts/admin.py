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

# Desregistrar o UserAdmin padrão do Django para registrar um customizado
if admin.site.is_registered(User):
    admin.site.unregister(User)


class TenantMembershipInline(admin.TabularInline):
    """Inline para mostrar membros de um tenant"""
    model = TenantMembership
    extra = 0
    fields = ['user', 'role', 'is_active', 'joined_at']
    readonly_fields = ['joined_at']


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    """Admin customizado para User com informações de tenant, empresa e filial"""
    # Adicionar campos customizados ao list_display padrão
    list_display = list(BaseUserAdmin.list_display) + ['tenant_display', 'empresa_display', 'filial_display']
    list_filter = list(BaseUserAdmin.list_filter) + ['profile__current_tenant']
    
    def get_queryset(self, request):
        """Otimizar queries com select_related"""
        qs = super().get_queryset(request)
        return qs.select_related('profile__current_tenant', 'profile__current_empresa', 'profile__current_filial')
    
    def tenant_display(self, obj):
        """Exibe o tenant atual do usuário"""
        try:
            profile = obj.profile
            if profile and profile.current_tenant:
                url = reverse('admin:tenants_tenant_change', args=[profile.current_tenant.pk])
                return format_html('<a href="{}">{}</a>', url, profile.current_tenant.name)
        except UserProfile.DoesNotExist:
            pass
        
        # Se não tem profile, tentar buscar pelos memberships
        memberships = TenantMembership.objects.filter(user=obj, is_active=True).select_related('tenant')
        if memberships.exists():
            tenants = [membership.tenant.name for membership in memberships[:3]]
            if len(tenants) == 1:
                membership = memberships.first()
                url = reverse('admin:tenants_tenant_change', args=[membership.tenant.pk])
                return format_html('<a href="{}">{}</a>', url, membership.tenant.name)
            else:
                return format_html('<span title="{}">{} tenants</span>', ', '.join(tenants), len(tenants))
        
        return '-'
    tenant_display.short_description = 'Tenant'
    
    def empresa_display(self, obj):
        """Exibe a empresa atual do usuário"""
        try:
            profile = obj.profile
            if profile and profile.current_empresa:
                empresa_nome = profile.current_empresa.nome
                # Mostrar também o tenant se disponível
                if profile.current_tenant:
                    return format_html(
                        '{}<br><small style="color: #666;">Tenant: {}</small>',
                        empresa_nome,
                        profile.current_tenant.name
                    )
                return empresa_nome
        except UserProfile.DoesNotExist:
            pass
        return '-'
    empresa_display.short_description = 'Empresa'
    
    def filial_display(self, obj):
        """Exibe a filial atual do usuário"""
        try:
            profile = obj.profile
            if profile and profile.current_filial:
                filial_nome = profile.current_filial.nome
                # Mostrar também a empresa e tenant se disponíveis
                parts = [filial_nome]
                if profile.current_empresa:
                    parts.append(f'Empresa: {profile.current_empresa.nome}')
                if profile.current_tenant:
                    parts.append(f'Tenant: {profile.current_tenant.name}')
                
                if len(parts) > 1:
                    return format_html(
                        '{}<br><small style="color: #666;">{}</small>',
                        parts[0],
                        '<br>'.join(parts[1:])
                    )
                return filial_nome
        except UserProfile.DoesNotExist:
            pass
        return '-'
    filial_display.short_description = 'Filial'


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
