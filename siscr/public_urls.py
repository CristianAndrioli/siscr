"""
URLs para o schema público (public)
Acessíveis quando não há tenant identificado ou em domínio público
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # Admin (apenas para superusuários do schema público)
    path('admin/', admin.site.urls),
    
    # APIs públicas (cadastro de novos clientes, planos, etc.)
    path('', include('public.urls')),
    
    # APIs de autenticação (token refresh/verify) - podem ser públicas
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
]

