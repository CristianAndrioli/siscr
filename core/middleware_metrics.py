"""
Middleware para coletar métricas básicas de performance
"""
import time
import logging
from django.utils.deprecation import MiddlewareMixin
from django.db import connection
from django.core.cache import cache

logger = logging.getLogger(__name__)


class MetricsMiddleware(MiddlewareMixin):
    """
    Middleware que coleta métricas básicas de performance:
    - Tempo de resposta das requisições
    - Número de queries do banco de dados
    - Status HTTP das respostas
    """
    
    def process_request(self, request):
        """Inicia o timer e reseta contadores"""
        request._start_time = time.time()
        request._query_count_start = len(connection.queries)
        
    def process_response(self, request, response):
        """Registra métricas ao final da requisição"""
        if not hasattr(request, '_start_time'):
            return response
        
        # Calcular tempo de resposta
        duration = time.time() - request._start_time
        
        # Contar queries do banco
        query_count = len(connection.queries) - request._query_count_start
        
        # Extrair informações da requisição
        method = request.method
        path = request.path
        status_code = response.status_code
        
        # Identificar tenant se disponível
        tenant_name = None
        if hasattr(connection, 'tenant') and connection.tenant:
            tenant_name = connection.tenant.schema_name
        
        # Identificar usuário se autenticado
        user_id = None
        username = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id
            username = request.user.username
        
        # Log de métricas (apenas para requisições que demoram mais ou têm muitas queries)
        if duration > 1.0 or query_count > 10:
            logger.warning(
                f"[METRICS] Requisição lenta ou com muitas queries",
                extra={
                    'method': method,
                    'path': path,
                    'status_code': status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'query_count': query_count,
                    'tenant': tenant_name,
                    'user_id': user_id,
                    'username': username,
                }
            )
        
        # Log de erros
        if status_code >= 400:
            logger.warning(
                f"[METRICS] Requisição com erro",
                extra={
                    'method': method,
                    'path': path,
                    'status_code': status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'query_count': query_count,
                    'tenant': tenant_name,
                    'user_id': user_id,
                    'username': username,
                }
            )
        
        # Adicionar headers de métricas na resposta (opcional, útil para debugging)
        if hasattr(request, 'user') and request.user.is_staff:
            response['X-Response-Time'] = f"{round(duration * 1000, 2)}ms"
            response['X-Query-Count'] = str(query_count)
        
        return response
    
    def process_exception(self, request, exception):
        """Registra métricas quando há exceção"""
        if not hasattr(request, '_start_time'):
            return None
        
        duration = time.time() - request._start_time
        query_count = len(connection.queries) - request._query_count_start
        
        tenant_name = None
        if hasattr(connection, 'tenant') and connection.tenant:
            tenant_name = connection.tenant.schema_name
        
        user_id = None
        username = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id
            username = request.user.username
        
        logger.error(
            f"[METRICS] Exceção durante requisição: {type(exception).__name__}",
            extra={
                'method': request.method,
                'path': request.path,
                'duration_ms': round(duration * 1000, 2),
                'query_count': query_count,
                'tenant': tenant_name,
                'user_id': user_id,
                'username': username,
                'exception_type': type(exception).__name__,
                'exception_message': str(exception),
            },
            exc_info=True,
        )
        
        return None

