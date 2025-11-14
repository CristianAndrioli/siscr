"""
URLs de autenticação multi-tenant
"""
from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    # Autenticação
    path('api/auth/login/', views.login, name='login'),
    path('api/auth/select-empresa/', views.select_empresa_filial, name='select_empresa_filial'),
    path('api/auth/me/', views.current_user, name='current_user'),
    
    # Recuperação de senha
    path('api/auth/password-reset/', views.password_reset_request, name='password_reset'),
    path('api/auth/password-reset-confirm/', views.password_reset_confirm, name='password_reset_confirm'),
]
