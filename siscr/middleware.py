"""
Middleware customizado para desabilitar CSRF em rotas de API
e identificar tenant por header customizado
"""
import sys
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
        
        # Log para debug
        import logging
        logger = logging.getLogger(__name__)
        
        if request.path.startswith('/api/'):
            # Usar print e flush para garantir que apareça nos logs do Docker
            msg = f'[TenantDomainHeaderMiddleware] Path: {request.path}, X-Tenant-Domain: {tenant_domain}'
            print(msg, flush=True)
            logger.info(msg)
        
        # Se não tiver header, tentar extrair do token JWT
        if not tenant_domain and request.path.startswith('/api/'):
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                try:
                    token = auth_header.split(' ')[1]
                    # Decodificar token JWT sem verificar (apenas para extrair info)
                    # PyJWT vem com djangorestframework-simplejwt
                    try:
                        import jwt
                        decoded = jwt.decode(token, options={"verify_signature": False})
                        tenant_schema = decoded.get('tenant_schema')
                        if tenant_schema:
                            # Construir domínio a partir do schema
                            tenant_domain = f'{tenant_schema}.localhost'
                            logger.info(f'[TenantDomainHeaderMiddleware] Domínio extraído do token: {tenant_domain}')
                    except ImportError:
                        # Se PyJWT não estiver disponível, ignorar
                        pass
                except Exception as e:
                    logger.debug(f'[TenantDomainHeaderMiddleware] Erro ao extrair tenant do token: {e}')
        
        if tenant_domain and request.path.startswith('/api/'):
            # Tentar identificar o tenant pelo domínio
            try:
                from tenants.models import Domain as TenantDomain
                # Usar schema público para buscar o domínio
                from django_tenants.utils import schema_context
                with schema_context('public'):
                    msg = f'[TenantDomainHeaderMiddleware] Buscando tenant com domínio: {tenant_domain}'
                    print(msg, flush=True)
                    domain_obj = TenantDomain.objects.select_related('tenant').get(domain=tenant_domain)
                    tenant = domain_obj.tenant
                    msg = f'[TenantDomainHeaderMiddleware] Tenant encontrado: {tenant.schema_name}'
                    print(msg, flush=True)
                
                # Armazenar o tenant no request para uso posterior
                # Isso é importante para que o TenantMainMiddleware reconheça o tenant
                request.tenant = tenant
                request.tenant_domain = tenant_domain
                # Marcar que o tenant já foi identificado pelo nosso middleware
                request._tenant_identified_by_header = True
                
                # Configurar o tenant na connection ANTES do TenantMainMiddleware
                # Isso garante que o schema correto seja usado
                connection.set_tenant(tenant)
                msg = f'[TenantDomainHeaderMiddleware] Tenant configurado na connection: {tenant.schema_name}'
                print(msg, flush=True)
                
                # Forçar o uso das URLs do tenant diretamente usando set_urlconf
                # Isso garante que as URLs do tenant sejam usadas mesmo se o TenantMainMiddleware não reconhecer
                from django.conf import settings
                from django.urls import set_urlconf
                tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
                print(f'[TenantDomainHeaderMiddleware] Tentando configurar URLs. tenant_urlconf={tenant_urlconf}', flush=True)
                if tenant_urlconf:
                    try:
                        # Importar o módulo de URLs do tenant
                        import importlib
                        urlconf_module = importlib.import_module(tenant_urlconf)
                        # Configurar as URLs
                        set_urlconf(tenant_urlconf)
                        # Também configurar no request
                        request.urlconf = tenant_urlconf
                        msg = f'[TenantDomainHeaderMiddleware] URLs do tenant configuradas: {tenant_urlconf}'
                        print(msg, flush=True)
                    except Exception as e:
                        msg = f'[TenantDomainHeaderMiddleware] Erro ao configurar URLs: {e}'
                        print(msg, flush=True)
                        import traceback
                        traceback.print_exc()
                        sys.stdout.flush()
                else:
                    print('[TenantDomainHeaderMiddleware] TENANT_SCHEMA_URLCONF não encontrado no settings!', flush=True)
                
                # Modificar o Host header para que o TenantMainMiddleware identifique corretamente
                # e carregue as URLs do tenant (TENANT_SCHEMA_URLCONF)
                original_host = request.META.get('HTTP_HOST', '')
                new_host = f'{tenant_domain}:8000'
                request.META['HTTP_HOST'] = new_host
                request.META['ORIGINAL_HTTP_HOST'] = original_host  # Preservar para CORS
                msg = f'[TenantDomainHeaderMiddleware] Host modificado: {original_host} -> {new_host}'
                print(msg, flush=True)
                
                # Também modificar SERVER_NAME se existir
                if 'SERVER_NAME' in request.META:
                    request.META['ORIGINAL_SERVER_NAME'] = request.META.get('SERVER_NAME')
                    request.META['SERVER_NAME'] = tenant_domain
                
                # Log para debug
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f'Tenant identificado pelo header: {tenant_domain} -> {tenant.schema_name}')
                print('[TenantDomainHeaderMiddleware] ✅ Tenant configurado com sucesso!', flush=True)
                
            except Exception as e:
                # Se não encontrar o tenant, deixar o TenantMainMiddleware lidar com isso
                import logging
                logger = logging.getLogger(__name__)
                error_msg = f'Tenant não encontrado pelo header X-Tenant-Domain: {tenant_domain} - {e}'
                logger.warning(error_msg)
                print(f'[TenantDomainHeaderMiddleware] ❌ {error_msg}', flush=True)
                import traceback
                traceback.print_exc()
                sys.stdout.flush()
        
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

