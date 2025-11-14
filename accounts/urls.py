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
]
