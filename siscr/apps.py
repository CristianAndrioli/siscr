"""
AppConfig para o projeto SISCR
"""
from django.apps import AppConfig


class SiscrConfig(AppConfig):
    """Configuração do projeto SISCR"""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'siscr'
    
    def ready(self):
        """Executado quando o Django está pronto"""
        from django.contrib import admin
        
        # Personalizar título e cabeçalho do admin
        admin.site.site_header = 'SISCR - Sistema de Gestão'
        admin.site.site_title = 'SISCR Admin'
        admin.site.index_title = 'Painel de Administração'

