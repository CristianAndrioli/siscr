from django.contrib import admin
from .models import EmailSettings


@admin.register(EmailSettings)
class EmailSettingsAdmin(admin.ModelAdmin):
    list_display = ('backend', 'host', 'port', 'from_email', 'is_active', 'created_at')
    list_filter = ('backend', 'is_active', 'created_at')
    search_fields = ('host', 'username', 'from_email')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Configuração Básica', {
            'fields': ('backend', 'is_active')
        }),
        ('Configurações SMTP', {
            'fields': ('host', 'port', 'use_tls', 'use_ssl', 'username', 'password', 'from_email'),
            'classes': ('collapse',),
        }),
        ('Informações do Sistema', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
