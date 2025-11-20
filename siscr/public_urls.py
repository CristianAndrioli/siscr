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
from payments import webhooks
from accounts import views as accounts_views

urlpatterns = [
    # Admin (apenas para superusuários do schema público)
    path('admin/', admin.site.urls),
    
    # API de login multi-tenant (aceita domínio via header ou body)
    # Esta rota funciona tanto no schema público quanto no tenant
    # IMPORTANTE: Colocar ANTES do include('public.urls') para garantir que seja encontrada
    path('api/auth/login/', accounts_views.login, name='login'),
    
    # APIs públicas (cadastro de novos clientes, planos, etc.)
    path('', include('public.urls')),
    
    # APIs de autenticação (token refresh/verify) - podem ser públicas
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Webhooks do Stripe (público, sem autenticação)
    path('api/webhooks/stripe/', webhooks.stripe_webhook, name='stripe_webhook'),
]

