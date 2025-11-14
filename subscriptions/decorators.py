"""
Decoradores para verificação de quotas em views/API
"""
from functools import wraps
from django.http import JsonResponse
from django_tenants.utils import schema_context
from django.db import connection
from .models import QuotaUsage


def check_quota(quota_type, value=1):
    """
    Decorador para verificar quota antes de executar view
    
    Args:
        quota_type: Tipo de quota ('users', 'empresas', 'filiais', 'storage')
        value: Quantidade a adicionar (padrão: 1)
    
    Exemplo:
        @check_quota('users')
        def create_user(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            tenant = getattr(connection, 'tenant', None)
            if not tenant:
                return JsonResponse(
                    {'error': 'Tenant não identificado'}, 
                    status=400
                )
            
            quota_usage = getattr(tenant, 'quota_usage', None)
            if quota_usage:
                success, message = quota_usage.check_quota(quota_type, value)
                if not success:
                    return JsonResponse(
                        {
                            'error': message,
                            'quota_type': quota_type,
                            'quota_exceeded': True,
                        }, 
                        status=403
                    )
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def update_quota_after_create(quota_type, value=1):
    """
    Decorador para atualizar quota após criar recurso
    
    Args:
        quota_type: Tipo de quota ('users', 'empresas', 'filiais', 'storage')
        value: Quantidade a incrementar (padrão: 1)
    
    Exemplo:
        @update_quota_after_create('users')
        def create_user(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            response = view_func(request, *args, **kwargs)
            
            # Se criação foi bem-sucedida (status 201 ou 200)
            if response.status_code in [200, 201]:
                tenant = getattr(connection, 'tenant', None)
                if tenant:
                    quota_usage = getattr(tenant, 'quota_usage', None)
                    if quota_usage:
                        quota_usage.increment_quota(quota_type, value)
            
            return response
        return wrapper
    return decorator


def update_quota_after_delete(quota_type, value=1):
    """
    Decorador para atualizar quota após deletar recurso
    
    Args:
        quota_type: Tipo de quota ('users', 'empresas', 'filiais', 'storage')
        value: Quantidade a decrementar (padrão: 1)
    
    Exemplo:
        @update_quota_after_delete('users')
        def delete_user(request, user_id):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            response = view_func(request, *args, **kwargs)
            
            # Se deleção foi bem-sucedida (status 200, 204)
            if response.status_code in [200, 204]:
                tenant = getattr(connection, 'tenant', None)
                if tenant:
                    quota_usage = getattr(tenant, 'quota_usage', None)
                    if quota_usage:
                        quota_usage.decrement_quota(quota_type, value)
            
            return response
        return wrapper
    return decorator

