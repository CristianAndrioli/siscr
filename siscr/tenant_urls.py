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
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin do tenant
    path('admin/', admin.site.urls),
    
    # Swagger/OpenAPI Documentation (para documentar APIs do tenant)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # APIs de autenticação multi-tenant
    path('', include('accounts.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # APIs de cadastros (pessoas, produtos, serviços, etc.)
    path('api/cadastros/', include('cadastros.api.urls')),
    
    # API de estoque
    path('api/estoque/', include('estoque.api.urls')),
    
    # API de relatórios
    path('api/reports/', include('reports.api.urls')),
    
    # API de gerenciamento de usuários do tenant
    path('api/accounts/', include('accounts.api.urls')),
    
    # API de empresas e filiais
    path('api/tenants/', include('tenants.api.urls')),
    
    # APIs de pagamentos
    path('api/payments/', include('payments.api.urls')),
    
    # APIs do core
    path('api/', include('core.api.urls')),
    
    # Outras rotas do tenant
    path('', include('core.urls')),
]

