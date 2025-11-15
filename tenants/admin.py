"""
Admin para modelos de Tenant
"""
from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import Tenant, Domain, Empresa, Filial


@admin.register(Tenant)
class TenantAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'schema_name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'schema_name')
    readonly_fields = ('schema_name',)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ('domain', 'tenant', 'is_primary')
    list_filter = ('is_primary', 'tenant')
    search_fields = ('domain', 'tenant__name')


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'tenant', 'is_active', 'created_at')
    list_filter = ('is_active', 'tenant', 'created_at')
    search_fields = ('nome', 'razao_social', 'cnpj', 'tenant__name')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'nome', 'razao_social', 'cnpj')
        }),
        ('Endereço', {
            'fields': ('endereco', 'cidade', 'estado', 'cep')
        }),
        ('Contato', {
            'fields': ('telefone', 'email')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(Filial)
class FilialAdmin(admin.ModelAdmin):
    list_display = ('nome', 'codigo_filial', 'empresa', 'is_active', 'created_at')
    list_filter = ('is_active', 'empresa__tenant', 'created_at')
    search_fields = ('nome', 'codigo_filial', 'cnpj', 'empresa__nome')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('empresa', 'nome', 'codigo_filial', 'cnpj')
        }),
        ('Endereço', {
            'fields': ('endereco', 'cidade', 'estado', 'cep')
        }),
        ('Contato', {
            'fields': ('telefone', 'email')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )
