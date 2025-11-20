"""
Middleware customizado para desabilitar CSRF em rotas de API
e identificar tenant por header customizado
"""
from django.utils.deprecation import MiddlewareMixin
from django.db import connection


class TenantDomainHeaderMiddleware(MiddlewareMixin):
    """
    Middleware que identifica tenant pelo header X-Tenant-Domain
    e configura o request para que o TenantMainMiddleware funcione
    """
    
    def process_request(self, request):
        # Verificar se há header X-Tenant-Domain
        tenant_domain = request.headers.get('X-Tenant-Domain')
        
        if tenant_domain and request.path.startswith('/api/'):
            # Tentar identificar o tenant pelo domínio
            try:
                from tenants.models import Domain as TenantDomain
                # Usar schema público para buscar o domínio
                from django_tenants.utils import schema_context
                with schema_context('public'):
                    domain_obj = TenantDomain.objects.select_related('tenant').get(domain=tenant_domain)
                    tenant = domain_obj.tenant
                
                # Armazenar o tenant no request para uso posterior
                request.tenant = tenant
                request.tenant_domain = tenant_domain
                
                # Configurar o tenant na connection ANTES do TenantMainMiddleware
                # Isso garante que o schema correto seja usado
                connection.set_tenant(tenant)
                
                # Modificar o Host header para que o TenantMainMiddleware identifique corretamente
                # e carregue as URLs do tenant (TENANT_SCHEMA_URLCONF)
                original_host = request.META.get('HTTP_HOST', '')
                request.META['HTTP_HOST'] = f'{tenant_domain}:8000'
                request.META['ORIGINAL_HTTP_HOST'] = original_host  # Preservar para CORS
                # Também modificar SERVER_NAME se existir
                if 'SERVER_NAME' in request.META:
                    request.META['ORIGINAL_SERVER_NAME'] = request.META.get('SERVER_NAME')
                    request.META['SERVER_NAME'] = tenant_domain
                
                # Log para debug
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f'Tenant identificado pelo header: {tenant_domain} -> {tenant.schema_name}')
                
            except Exception as e:
                # Se não encontrar o tenant, deixar o TenantMainMiddleware lidar com isso
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f'Tenant não encontrado pelo header X-Tenant-Domain: {tenant_domain} - {e}')
        
        return None


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Middleware que desabilita verificação CSRF para rotas de API
    """
    
    def process_request(self, request):
        # Desabilitar CSRF para todas as rotas que começam com /api/
        if request.path.startswith('/api/'):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None

