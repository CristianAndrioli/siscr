"""
Middleware para preencher automaticamente campos de auditoria
(created_by, updated_by, owner) nos modelos SiscrModelBase
"""
import threading
from django.utils.deprecation import MiddlewareMixin

# Thread-local storage para armazenar o usuário atual
_thread_locals = threading.local()


def get_current_user():
    """Retorna o usuário atual da thread"""
    return getattr(_thread_locals, 'user', None)


def set_current_user(user):
    """Define o usuário atual da thread"""
    _thread_locals.user = user


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware que captura o usuário autenticado e disponibiliza
    para os modelos SiscrModelBase preencherem automaticamente
    os campos de auditoria (created_by, updated_by, owner).
    """
    
    def process_request(self, request):
        """Captura o usuário autenticado no início da requisição"""
        if hasattr(request, 'user') and request.user.is_authenticated:
            set_current_user(request.user)
        else:
            set_current_user(None)
    
    def process_response(self, request, response):
        """Limpa o usuário no fim da requisição"""
        set_current_user(None)
        return response

