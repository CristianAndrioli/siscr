"""
URLs para tenants (schemas específicos)
Acessíveis quando um tenant é identificado pela URL/domínio
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # Admin do tenant
    path('admin/', admin.site.urls),
    
    # APIs de autenticação multi-tenant
    path('', include('accounts.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # APIs de cadastros (pessoas, produtos, serviços, etc.)
    path('api/cadastros/', include('cadastros.api.urls')),
    
    # API de gerenciamento de usuários do tenant
    path('api/accounts/', include('accounts.api.urls')),
    
    # APIs de pagamentos
    path('api/payments/', include('payments.api.urls')),
    
    # APIs do core
    path('api/', include('core.api.urls')),
    
    # Outras rotas do tenant
    path('', include('core.urls')),
]

