"""
Middleware para verificação de quotas antes de processar requisições
"""
from django.http import JsonResponse
from django.db import connection
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
    
    # Rotas de pagamento que devem ser permitidas mesmo com subscription pending
    PAYMENT_PATHS = [
        '/api/payments/checkout/create/',
        '/api/payments/checkout/session/',
        '/api/payments/payment-methods/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):

        # Verificar se é rota pública - SEMPRE permitir rotas públicas (retornar imediatamente)
        for public_path in self.PUBLIC_PATHS:
            if request.path.startswith(public_path):
                return self.get_response(request)
        
        # Verificar se é rota de pagamento - PERMITIR mesmo com subscription pending
        # Usuário precisa poder pagar para ativar a subscription
        for payment_path in self.PAYMENT_PATHS:
            if request.path.startswith(payment_path):
                return self.get_response(request)
        
        # Se não há tenant (schema público), permitir continuar
        try:
            tenant = getattr(connection, 'tenant', None)
        except Exception:
            tenant = None
        
        if not tenant:
            return self.get_response(request)
        
        # Apenas verificar em requisições que criam recursos
        if request.method in ['POST', 'PUT', 'PATCH']:
            if tenant:
                try:
                    # Buscar subscription do tenant
                    subscription = Subscription.objects.filter(
                        tenant=tenant
                    ).first()
                    
                    if subscription:
                        # Verificar se está ativa
                        if not subscription.is_active:
                            # Mensagens específicas por status
                            if subscription.status == 'pending':
                                return JsonResponse(
                                    {
                                        'error': 'Pagamento pendente',
                                        'message': 'Sua assinatura está aguardando confirmação de pagamento. Complete o pagamento para continuar usando o sistema.',
                                        'subscription_status': subscription.status,
                                        'requires_payment': True,
                                    }, 
                                    status=402  # Payment Required
                                )
                            elif subscription.status == 'past_due':
                                return JsonResponse(
                                    {
                                        'error': 'Pagamento atrasado',
                                        'message': 'Seu pagamento está atrasado. Atualize seu método de pagamento para continuar usando o sistema.',
                                        'subscription_status': subscription.status,
                                        'requires_payment': True,
                                    }, 
                                    status=402  # Payment Required
                                )
                            else:
                                return JsonResponse(
                                    {
                                        'error': 'Assinatura inativa ou expirada',
                                        'message': 'Sua assinatura expirou ou foi cancelada. Renove para continuar usando o sistema.',
                                        'subscription_status': subscription.status,
                                    }, 
                                    status=402  # Payment Required
                                )
                    else:
                        # Sem assinatura
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

