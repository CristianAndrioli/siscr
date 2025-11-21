"""
Decoradores para rate limiting em views de autenticação
"""
from django_ratelimit.decorators import ratelimit
from functools import wraps
from django.conf import settings


def rate_limit_login(view_func):
    """
    Rate limit para login: 
    - Desenvolvimento: 20 tentativas por 15 minutos por IP
    - Produção: 5 tentativas por 15 minutos por IP
    """
    # Em desenvolvimento, ser mais permissivo
    env = getattr(settings, 'ENVIRONMENT', 'development')
    if env == 'development':
        rate = '20/15m'  # Mais permissivo em desenvolvimento
    else:
        rate = '5/15m'   # Mais restritivo em produção
    
    @ratelimit(key='ip', rate=rate, method='POST', block=True)
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        return view_func(*args, **kwargs)
    return wrapper


def rate_limit_password_reset(view_func):
    """
    Rate limit para password reset: 
    - Desenvolvimento: 10 tentativas por hora por IP
    - Produção: 3 tentativas por hora por IP
    """
    env = getattr(settings, 'ENVIRONMENT', 'development')
    if env == 'development':
        rate = '10/h'  # Mais permissivo em desenvolvimento
    else:
        rate = '3/h'   # Mais restritivo em produção
    
    @ratelimit(key='ip', rate=rate, method='POST', block=True)
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        return view_func(*args, **kwargs)
    return wrapper


def rate_limit_signup(view_func):
    """
    Rate limit para signup: 3 tentativas por hora por IP
    """
    @ratelimit(key='ip', rate='3/h', method='POST', block=True)
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        return view_func(*args, **kwargs)
    return wrapper

