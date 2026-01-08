"""
Middleware para coletar métricas básicas de performance
"""
import time
import json
import logging
import sys
from django.utils.deprecation import MiddlewareMixin
from django.db import connection
from django.core.cache import cache
from django.utils import timezone

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
        # Desabilitar em modo de teste para reduzir logs
        from django.conf import settings
        if getattr(settings, 'TESTING', False) or 'test' in sys.argv:
            return response
            
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
        
        # Armazenar métricas no Redis para análise
        try:
            duration_ms = round(duration * 1000, 2)
            
            # 1. Armazenar tempo de resposta (últimas 100 requisições)
            cache.lpush('metrics:response_times', duration_ms)
            cache.ltrim('metrics:response_times', 0, 99)  # Manter apenas 100
            
            # 2. Armazenar requisições lentas (top 10, >500ms)
            if duration > 0.5:
                slow_request = {
                    'path': path,
                    'method': method,
                    'duration_ms': duration_ms,
                    'status_code': status_code,
                    'query_count': query_count,
                    'tenant': tenant_name,
                    'username': username,
                    'timestamp': timezone.now().isoformat(),
                }
                cache.lpush('metrics:slow_requests', json.dumps(slow_request))
                cache.ltrim('metrics:slow_requests', 0, 9)  # Top 10
            
            # 3. Contar requisições por endpoint
            # Ignorar requisições estáticas e do próprio dashboard
            if not path.startswith('/static/') and not path.startswith('/media/') and '/observability/' not in path:
                endpoint_key = f'metrics:endpoint:{method}:{path}'
                cache.incr(endpoint_key)
                cache.expire(endpoint_key, 86400)  # Expirar após 24 horas
                
                # Armazenar tempo médio por endpoint
                avg_key = f'metrics:endpoint_avg:{method}:{path}'
                current_avg = cache.get(avg_key)
                if current_avg:
                    # Calcular média móvel (simplificado)
                    new_avg = (float(current_avg) + duration_ms) / 2
                else:
                    new_avg = duration_ms
                cache.set(avg_key, new_avg, 86400)
                
                # Manter lista de endpoints únicos (para buscar depois)
                endpoints_list_key = 'metrics:endpoints_list'
                endpoints_list = []
                try:
                    existing = cache.get(endpoints_list_key)
                    if existing:
                        endpoints_list = json.loads(existing)
                except:
                    pass
                
                # Adicionar endpoint se não existir
                endpoint_info = {'method': method, 'path': path}
                if endpoint_info not in endpoints_list:
                    endpoints_list.append(endpoint_info)
                    # Manter apenas últimos 100 endpoints
                    if len(endpoints_list) > 100:
                        endpoints_list = endpoints_list[-100:]
                    cache.set(endpoints_list_key, json.dumps(endpoints_list), 86400)
        except Exception as e:
            # Não quebrar a requisição se houver erro ao armazenar métricas
            logger.debug(f'Erro ao armazenar métricas: {str(e)}')
        
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

