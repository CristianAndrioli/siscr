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
                request.tenant = tenant
                request.tenant_domain = tenant_domain
                # Marcar que o tenant já foi identificado pelo nosso middleware
                request._tenant_identified_by_header = True
                
                # Configurar o tenant na connection
                connection.set_tenant(tenant)
                msg = f'[TenantDomainHeaderMiddleware] Tenant configurado na connection: {tenant.schema_name}'
                print(msg, flush=True)
                
                # IMPORTANTE: Configurar as URLs do tenant ANTES do TenantMainMiddleware
                # Isso garante que as URLs corretas sejam usadas
                from django.conf import settings
                from django.urls import set_urlconf
                tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
                print(f'[TenantDomainHeaderMiddleware] Tentando configurar URLs. tenant_urlconf={tenant_urlconf}', flush=True)
                if tenant_urlconf:
                    try:
                        # Importar o módulo de URLs do tenant
                        import importlib
                        urlconf_module = importlib.import_module(tenant_urlconf)
                        # Configurar as URLs GLOBALMENTE
                        set_urlconf(tenant_urlconf)
                        # IMPORTANTE: Configurar no request ANTES de qualquer outra coisa
                        # O TenantMainMiddleware pode verificar request.urlconf e usar se existir
                        request.urlconf = tenant_urlconf
                        # Também marcar que o urlconf já foi configurado
                        request._urlconf_configured = tenant_urlconf
                        msg = f'[TenantDomainHeaderMiddleware] URLs do tenant configuradas: {tenant_urlconf}'
                        print(msg, flush=True)
                        
                        # Testar se a rota pode ser resolvida
                        try:
                            from django.urls import resolve
                            match = resolve(request.path)
                            print(f'[TenantDomainHeaderMiddleware] ✅ Rota pode ser resolvida: {match.url_name}', flush=True)
                        except Exception as e:
                            print(f'[TenantDomainHeaderMiddleware] ⚠️ Rota ainda não pode ser resolvida: {e}', flush=True)
                    except Exception as e:
                        msg = f'[TenantDomainHeaderMiddleware] Erro ao configurar URLs: {e}'
                        print(msg, flush=True)
                        import traceback
                        traceback.print_exc()
                        sys.stdout.flush()
                else:
                    print('[TenantDomainHeaderMiddleware] TENANT_SCHEMA_URLCONF não encontrado no settings!', flush=True)
                
                # IMPORTANTE: Não modificar o HTTP_HOST se ele contiver underscore
                # O Django valida o formato do host antes de chegar ao ALLOWED_HOSTS
                # e rejeita hosts com underscore (RFC 1034/1035)
                # Como já configuramos request.tenant, o CustomTenantMainMiddleware vai pular
                # a execução do TenantMainMiddleware, então não precisamos modificar o HTTP_HOST
                original_host = request.META.get('HTTP_HOST', '')
                
                # NÃO modificar HTTP_HOST quando tenant já está configurado via header
                # Isso evita problemas com ALLOWED_HOSTS e é desnecessário já que request.tenant está configurado
                # O CustomTenantMainMiddleware vai usar request.tenant se existir
                print(f'[TenantDomainHeaderMiddleware] ⚠️ Mantendo HTTP_HOST original para evitar erro de validação ALLOWED_HOSTS', flush=True)
                print(f'[TenantDomainHeaderMiddleware] HTTP_HOST original: {original_host}', flush=True)
                print(f'[TenantDomainHeaderMiddleware] Tenant configurado via request.tenant, não é necessário modificar HTTP_HOST', flush=True)
                
                # Apenas preservar informações para referência
                request.META['ORIGINAL_HTTP_HOST'] = original_host  # Preservar para CORS
                # Preservar domínio do tenant (pegar do header ou do tenant encontrado)
                tenant_domain_to_save = tenant_domain
                if not tenant_domain_to_save and hasattr(request, 'tenant') and request.tenant:
                    # Tentar pegar do domain do tenant
                    try:
                        from tenants.models import Domain
                        domain_obj = Domain.objects.filter(tenant=request.tenant, is_primary=True).first()
                        if domain_obj:
                            tenant_domain_to_save = domain_obj.domain
                    except Exception:
                        pass
                request.META['X-TENANT-DOMAIN-ORIGINAL'] = tenant_domain_to_save or ''  # Preservar domínio do tenant
                
                # IMPORTANTE: Como já configuramos request.tenant, o CustomTenantMainMiddleware vai pular
                # a execução do TenantMainMiddleware, então não precisamos modificar o HTTP_HOST
                print(f'[TenantDomainHeaderMiddleware] request.tenant já configurado: {request.tenant.schema_name}', flush=True)
                print(f'[TenantDomainHeaderMiddleware] CustomTenantMainMiddleware vai pular TenantMainMiddleware porque request.tenant já existe', flush=True)
                
                # Também modificar SERVER_NAME se existir
                if 'SERVER_NAME' in request.META:
                    request.META['ORIGINAL_SERVER_NAME'] = request.META.get('SERVER_NAME')
                    request.META['SERVER_NAME'] = tenant_domain
                
                # CRÍTICO: O TenantMainMiddleware pode verificar o domínio no banco ANTES de verificar request.tenant
                # Se não encontrar, pode retornar 404 antes do nosso middleware executar
                # Por isso, precisamos garantir que o TenantMainMiddleware encontre o domínio no banco
                # OU que ele pule a verificação porque request.tenant já está configurado
                # 
                # O problema é que o TenantMainMiddleware pode estar fazendo:
                # 1. Verificar se request.tenant existe -> Se não, buscar pelo domínio
                # 2. Se não encontrar o domínio, retornar 404
                # 
                # Mas mesmo com request.tenant configurado, ele pode estar verificando o domínio primeiro
                # e retornando 404 antes de verificar request.tenant
                #
                # SOLUÇÃO: Garantir que o TenantMainMiddleware encontre o domínio no banco
                # OU fazer ele pular completamente a verificação
                #
                # Vamos tentar uma abordagem diferente: fazer o TenantMainMiddleware encontrar o domínio
                # no banco ANTES de retornar 404, garantindo que o HTTP_HOST esteja correto
                
                # IMPORTANTE: Marcar que o tenant já foi identificado para evitar que o TenantMainMiddleware sobrescreva
                # O TenantMainMiddleware verifica se request.tenant já existe e se _skip_tenant_middleware está definido
                request._skip_tenant_middleware = True
                # CRÍTICO: O TenantMainMiddleware pode verificar request.urlconf e usar se existir
                # Mas também pode sobrescrever. Vamos marcar explicitamente que não deve sobrescrever
                request._dont_override_urlconf = True
                # CRÍTICO: O TenantMainMiddleware do django-tenants verifica request.urlconf
                # Se existir e for diferente do que ele espera, pode sobrescrever
                # Vamos garantir que o urlconf esteja configurado ANTES do TenantMainMiddleware executar
                # E marcar que não deve ser alterado
                request._urlconf_configured = tenant_urlconf
                # IMPORTANTE: O TenantMainMiddleware pode verificar se request.urlconf já está definido
                # e usar se for do tipo correto. Vamos garantir que esteja definido corretamente
                print(f'[TenantDomainHeaderMiddleware] _urlconf_configured definido: {tenant_urlconf}', flush=True)
                print(f'[TenantDomainHeaderMiddleware] _dont_override_urlconf definido: True', flush=True)
                
                # CRÍTICO: O TenantMainMiddleware pode estar retornando 404 porque está tentando resolver
                # a rota com o PUBLIC_SCHEMA_URLCONF antes de verificar request.tenant
                # Vamos garantir que o urlconf esteja configurado GLOBALMENTE também
                from django.urls import set_urlconf
                set_urlconf(tenant_urlconf)
                print(f'[TenantDomainHeaderMiddleware] URLconf configurado GLOBALMENTE: {tenant_urlconf}', flush=True)
                
                # CRÍTICO: Garantir que o TenantMainMiddleware encontre o domínio no banco
                # O TenantMainMiddleware pode verificar o domínio no banco ANTES de verificar request.tenant
                # Se não encontrar, pode retornar 404 antes do nosso middleware executar
                # Por isso, já configuramos request.tenant acima, mas também precisamos garantir que o HTTP_HOST
                # esteja no formato que o TenantMainMiddleware espera encontrar no banco
                # O domínio já está modificado acima, então o TenantMainMiddleware deveria encontrá-lo
                # Mas vamos garantir que ele não retorne 404 verificando se o domínio existe
                try:
                    from tenants.models import Domain as TenantDomain
                    from django_tenants.utils import schema_context
                    with schema_context('public'):
                        domain_exists = TenantDomain.objects.filter(domain=tenant_domain).exists()
                        print(f'[TenantDomainHeaderMiddleware] Domínio existe no banco: {domain_exists}', flush=True)
                        if not domain_exists:
                            print(f'[TenantDomainHeaderMiddleware] ⚠️ ATENÇÃO: Domínio {tenant_domain} não existe no banco!', flush=True)
                            print(f'[TenantDomainHeaderMiddleware] Isso pode causar 404 no TenantMainMiddleware!', flush=True)
                except Exception as e:
                    print(f'[TenantDomainHeaderMiddleware] Erro ao verificar domínio no banco: {e}', flush=True)
                
                # CRÍTICO: Forçar que o TenantMainMiddleware use o tenant que já configuramos
                # O TenantMainMiddleware pode estar ignorando request.tenant e tentando buscar pelo domínio
                # Se não encontrar, retorna 404. Vamos garantir que ele use o tenant que já configuramos
                # marcando explicitamente que o tenant já foi identificado
                print(f'[TenantDomainHeaderMiddleware] ⚠️ IMPORTANTE: Tentando forçar TenantMainMiddleware a usar tenant já configurado', flush=True)
                print(f'[TenantDomainHeaderMiddleware] request.tenant: {request.tenant.schema_name}', flush=True)
                print(f'[TenantDomainHeaderMiddleware] request._skip_tenant_middleware: {getattr(request, "_skip_tenant_middleware", False)}', flush=True)
                print(f'[TenantDomainHeaderMiddleware] request.urlconf: {getattr(request, "urlconf", None)}', flush=True)
                
                # Log para debug
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f'Tenant identificado pelo header: {tenant_domain} -> {tenant.schema_name}')
                print('[TenantDomainHeaderMiddleware] ✅ Tenant configurado com sucesso!', flush=True)
                print(f'[TenantDomainHeaderMiddleware] _skip_tenant_middleware definido: {getattr(request, "_skip_tenant_middleware", False)}', flush=True)
                
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


class CustomTenantMainMiddleware(MiddlewareMixin):
    """
    Middleware customizado que substitui o TenantMainMiddleware
    Mas garante que não retorne 404 quando o tenant já está configurado pelo TenantDomainHeaderMiddleware
    """
    
    def __init__(self, get_response=None):
        super().__init__(get_response)
        # Armazenar get_response para usar no TenantMainMiddleware
        self._get_response = get_response
    
    def process_request(self, request):
        # Se o tenant já foi identificado pelo TenantDomainHeaderMiddleware, pular o TenantMainMiddleware
        if hasattr(request, 'tenant') and request.tenant is not None:
            if hasattr(request, '_tenant_identified_by_header') and request._tenant_identified_by_header:
                print(f'[CustomTenantMainMiddleware] 🔍 Tenant já configurado pelo TenantDomainHeaderMiddleware', flush=True)
                print(f'[CustomTenantMainMiddleware] Schema: {request.tenant.schema_name}', flush=True)
                
                # Garantir que o urlconf esteja configurado
                from django.conf import settings
                tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
                if tenant_urlconf:
                    from django.urls import set_urlconf
                    set_urlconf(tenant_urlconf)
                    request.urlconf = tenant_urlconf
                    print(f'[CustomTenantMainMiddleware] ✅ URLconf configurado: {tenant_urlconf}', flush=True)
                    
                    # Garantir que o tenant esteja configurado na connection
                    from django.db import connection
                    connection.set_tenant(request.tenant)
                    print(f'[CustomTenantMainMiddleware] ✅ Tenant configurado na connection: {request.tenant.schema_name}', flush=True)
                    
                    # Tentar resolver a rota para verificar
                    if request.path.startswith('/api/'):
                        try:
                            from django.urls import resolve
                            match = resolve(request.path)
                            print(f'[CustomTenantMainMiddleware] ✅ Rota pode ser resolvida: {match.url_name}', flush=True)
                        except Exception as e:
                            print(f'[CustomTenantMainMiddleware] ⚠️ Erro ao resolver rota: {e}', flush=True)
                
                # Pular o TenantMainMiddleware original
                return None
        
        # Caso contrário, executar o TenantMainMiddleware normal
        # Importar aqui para evitar import circular
        from django_tenants.middleware.main import TenantMainMiddleware
        tenant_middleware = TenantMainMiddleware(self._get_response)
        return tenant_middleware.process_request(request)


class PreserveTenantURLsMiddleware(MiddlewareMixin):
    """
    Middleware que preserva as URLs do tenant após o TenantMainMiddleware
    Garante que as URLs configuradas pelo TenantDomainHeaderMiddleware sejam mantidas
    """
    
    def process_exception(self, request, exception):
        """
        process_exception é chamado quando uma exceção é levantada
        Isso permite interceptar Http404 antes de ser retornado
        """
        from django.http import Http404
        if isinstance(exception, Http404) and request.path.startswith('/api/'):
            tenant_identified = (
                (hasattr(request, '_tenant_identified_by_header') and request._tenant_identified_by_header) or
                (hasattr(request, 'tenant') and request.tenant is not None)
            )
            
            if tenant_identified:
                from django.conf import settings
                tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
                current_urlconf = getattr(request, 'urlconf', None)
                
                print(f'[PreserveTenantURLsMiddleware] 🔍 process_exception - Http404 detectado!', flush=True)
                print(f'[PreserveTenantURLsMiddleware] Path: {request.path}', flush=True)
                print(f'[PreserveTenantURLsMiddleware] Tenant identificado: {tenant_identified}', flush=True)
                print(f'[PreserveTenantURLsMiddleware] URLconf atual: {current_urlconf}', flush=True)
                print(f'[PreserveTenantURLsMiddleware] URLconf esperado: {tenant_urlconf}', flush=True)
                
                if tenant_urlconf and current_urlconf != tenant_urlconf:
                    print(f'[PreserveTenantURLsMiddleware] ⚠️ Tentando corrigir URLconf e resolver novamente...', flush=True)
                    from django.urls import set_urlconf, resolve
                    set_urlconf(tenant_urlconf)
                    request.urlconf = tenant_urlconf
                    
                    # Tentar resolver a URL novamente
                    try:
                        match = resolve(request.path)
                        print(f'[PreserveTenantURLsMiddleware] ✅ Rota pode ser resolvida agora: {match.url_name}', flush=True)
                        # Se conseguir resolver, não retornar a exceção - deixar o Django processar normalmente
                        return None
                    except Exception as e:
                        print(f'[PreserveTenantURLsMiddleware] ⚠️ Ainda não pode resolver: {e}', flush=True)
        
        return None  # Deixar o Django processar a exceção normalmente
    
    def process_view(self, request, view_func, view_args, view_kwargs):
        """
        process_view é chamado ANTES da view ser executada, DEPOIS da resolução das URLs
        Isso garante que seja executado mesmo se o TenantMainMiddleware tiver problemas
        """
        # SEMPRE logar para verificar se o middleware está sendo executado
        print(f'[PreserveTenantURLsMiddleware] 🔍 process_view - Path: {request.path}, Method: {request.method}', flush=True)
        print(f'[PreserveTenantURLsMiddleware] process_view - request.tenant: {getattr(request, "tenant", None)}', flush=True)
        print(f'[PreserveTenantURLsMiddleware] process_view - request.urlconf: {getattr(request, "urlconf", None)}', flush=True)
        
        # Verificar se há tenant no request OU se foi identificado pelo nosso middleware
        tenant_identified = (
            (hasattr(request, '_tenant_identified_by_header') and request._tenant_identified_by_header) or
            (hasattr(request, 'tenant') and request.tenant is not None)
        )
        
        if tenant_identified and request.path.startswith('/api/'):
            from django.conf import settings
            tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
            current_urlconf = getattr(request, 'urlconf', None)
            
            if tenant_urlconf and current_urlconf != tenant_urlconf:
                print(f'[PreserveTenantURLsMiddleware] ⚠️ URLconf incorreto em process_view! Atual: {current_urlconf}, Deveria ser: {tenant_urlconf}', flush=True)
                from django.urls import set_urlconf
                set_urlconf(tenant_urlconf)
                request.urlconf = tenant_urlconf
                
                # Também garantir que o tenant esteja configurado na connection
                if hasattr(request, 'tenant') and request.tenant:
                    from django.db import connection
                    connection.set_tenant(request.tenant)
                    print(f'[PreserveTenantURLsMiddleware] Tenant configurado na connection: {request.tenant.schema_name}', flush=True)
                
                print(f'[PreserveTenantURLsMiddleware] URLs do tenant FORÇADAS em process_view: {tenant_urlconf}', flush=True)
                
                # Tentar resolver a URL novamente
                try:
                    from django.urls import resolve
                    match = resolve(request.path)
                    print(f'[PreserveTenantURLsMiddleware] ✅ Rota resolvida em process_view: {match.url_name} -> {match.view_name}', flush=True)
                except Exception as e:
                    print(f'[PreserveTenantURLsMiddleware] ⚠️ Erro ao resolver rota em process_view: {e}', flush=True)
                    import traceback
                    traceback.print_exc()
                    sys.stdout.flush()
            else:
                print(f'[PreserveTenantURLsMiddleware] ✅ URLconf já está correto em process_view: {tenant_urlconf}', flush=True)
        
        return None  # Continuar processamento normal
    
    def process_request(self, request):
        # SEMPRE logar para verificar se o middleware está sendo executado
        # Logar TODAS as requisições, não apenas /api/
        # IMPORTANTE: Este log DEVE aparecer para TODAS as requisições, incluindo OPTIONS
        if request.path.startswith('/api/'):
            print(f'[PreserveTenantURLsMiddleware] 🔍 EXECUTANDO - Path: {request.path}, Method: {request.method}', flush=True)
        
        # Se o TenantMainMiddleware retornou 404, nunca chegaremos aqui
        # Mas vamos garantir que este middleware SEMPRE execute
        
        # IMPORTANTE: Executar ANTES de qualquer verificação para garantir que sempre execute
        if request.path.startswith('/api/'):
            print(f'[PreserveTenantURLsMiddleware] 🔍 INÍCIO - Processando request: {request.path}', flush=True)
            print(f'[PreserveTenantURLsMiddleware] _tenant_identified_by_header: {hasattr(request, "_tenant_identified_by_header")}', flush=True)
            if hasattr(request, '_tenant_identified_by_header'):
                print(f'[PreserveTenantURLsMiddleware] _tenant_identified_by_header value: {request._tenant_identified_by_header}', flush=True)
            print(f'[PreserveTenantURLsMiddleware] request.urlconf: {getattr(request, "urlconf", None)}', flush=True)
            print(f'[PreserveTenantURLsMiddleware] request.tenant: {getattr(request, "tenant", None)}', flush=True)
            print(f'[PreserveTenantURLsMiddleware] _urlconf_configured: {getattr(request, "_urlconf_configured", None)}', flush=True)
        
        # IMPORTANTE: Verificar se há tenant no request OU se foi identificado pelo nosso middleware
        # O TenantMainMiddleware pode ter limpado o _tenant_identified_by_header, mas o tenant ainda deve estar no request
        tenant_identified = (
            (hasattr(request, '_tenant_identified_by_header') and request._tenant_identified_by_header) or
            (hasattr(request, 'tenant') and request.tenant is not None)
        )
        
        if tenant_identified and request.path.startswith('/api/'):
            from django.conf import settings
            tenant_urlconf = getattr(settings, 'TENANT_SCHEMA_URLCONF', None)
            
            # Verificar se o urlconf atual não é o tenant_urlconf
            current_urlconf = getattr(request, 'urlconf', None)
            
            # CRÍTICO: Sempre forçar o uso do tenant_urlconf se o tenant foi identificado
            # O TenantMainMiddleware pode ter sobrescrito o urlconf
            if tenant_urlconf:
                # Sempre garantir que o urlconf está correto
                if current_urlconf != tenant_urlconf:
                    print(f'[PreserveTenantURLsMiddleware] ⚠️ URLconf incorreto! Atual: {current_urlconf}, Deveria ser: {tenant_urlconf}', flush=True)
                else:
                    print(f'[PreserveTenantURLsMiddleware] ✅ URLconf já está correto: {tenant_urlconf}', flush=True)
                
                # FORÇAR o uso das URLs do tenant (mesmo que já esteja correto, garantir)
                from django.urls import set_urlconf, resolve
                set_urlconf(tenant_urlconf)
                request.urlconf = tenant_urlconf
                
                # Também garantir que o tenant esteja configurado na connection
                if hasattr(request, 'tenant') and request.tenant:
                    from django.db import connection
                    connection.set_tenant(request.tenant)
                    print(f'[PreserveTenantURLsMiddleware] Tenant configurado na connection: {request.tenant.schema_name}', flush=True)
                
                print(f'[PreserveTenantURLsMiddleware] URLs do tenant FORÇADAS: {tenant_urlconf}', flush=True)
                
                # Tentar resolver a URL para verificar se está funcionando
                try:
                    match = resolve(request.path)
                    print(f'[PreserveTenantURLsMiddleware] ✅ Rota resolvida: {match.url_name} -> {match.view_name}', flush=True)
                except Exception as e:
                    print(f'[PreserveTenantURLsMiddleware] ⚠️ Erro ao resolver rota {request.path}: {e}', flush=True)
                    import traceback
                    traceback.print_exc()
                    sys.stdout.flush()
        else:
            if request.path.startswith('/api/'):
                print(f'[PreserveTenantURLsMiddleware] ⚠️ Tenant não identificado', flush=True)
                print(f'[PreserveTenantURLsMiddleware] request.tenant: {getattr(request, "tenant", None)}', flush=True)
                print(f'[PreserveTenantURLsMiddleware] _tenant_identified_by_header: {getattr(request, "_tenant_identified_by_header", None)}', flush=True)
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

