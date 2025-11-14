"""
Decoradores para rate limiting em views de autenticação
"""
from django_ratelimit.decorators import ratelimit
from functools import wraps


def rate_limit_login(view_func):
    """
    Rate limit para login: 5 tentativas por 15 minutos por IP
    """
    @ratelimit(key='ip', rate='5/15m', method='POST', block=True)
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        return view_func(*args, **kwargs)
    return wrapper


def rate_limit_password_reset(view_func):
    """
    Rate limit para password reset: 3 tentativas por hora por IP
    """
    @ratelimit(key='ip', rate='3/h', method='POST', block=True)
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

