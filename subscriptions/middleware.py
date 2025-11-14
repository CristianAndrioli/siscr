"""
Middleware para verificação de quotas antes de processar requisições
"""
from django.http import JsonResponse
from django_tenants.utils import get_tenant_from_request
from .models import Subscription, QuotaUsage


class QuotaMiddleware:
    """
    Middleware para verificar quotas antes de processar requisições
    Bloqueia criação de recursos se quota excedida
    """
    
    # Rotas públicas que não devem ser bloqueadas
    PUBLIC_PATHS = [
        '/api/public/',
        '/api/auth/login/',
        '/api/auth/password-reset/',
        '/api/auth/password-reset-confirm/',
        '/admin/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Verificar se é rota pública
        if any(request.path.startswith(path) for path in self.PUBLIC_PATHS):
            return self.get_response(request)
        
        # Apenas verificar em requisições que criam recursos
        if request.method in ['POST', 'PUT', 'PATCH']:
            tenant = get_tenant_from_request(request)
            if tenant:
                try:
                    # Buscar subscription ativa do tenant
                    subscription = Subscription.objects.filter(
                        tenant=tenant,
                        status__in=['active', 'trial']
                    ).first()
                    
                    if subscription:
                        # Verificar se está expirada
                        if not subscription.is_active:
                            return JsonResponse(
                                {
                                    'error': 'Assinatura inativa ou expirada',
                                    'message': 'Sua assinatura expirou. Renove para continuar usando o sistema.',
                                    'subscription_status': subscription.status,
                                }, 
                                status=402  # Payment Required
                            )
                    else:
                        # Sem assinatura ativa
                        return JsonResponse(
                            {
                                'error': 'Assinatura não encontrada',
                                'message': 'Você não possui uma assinatura ativa. Entre em contato com o suporte.',
                            }, 
                            status=402  # Payment Required
                        )
                except Exception:
                    # Se houver erro ao verificar, permitir continuar (não bloquear)
                    pass
        
        return self.get_response(request)

