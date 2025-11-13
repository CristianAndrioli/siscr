# core/urls.py
# URLs limpas - apenas APIs auxiliares necessárias
# Todas as rotas de templates foram migradas para React

from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # =======================================================================
    # APIs AUXILIARES (JSON)
    # =======================================================================
    # Essas APIs podem ser úteis para funcionalidades auxiliares
    path('buscar_cadastro/', views.buscar_cadastro, name='buscar_cadastro'),
    path('buscar_fornecedor/', views.buscar_fornecedor, name='buscar_fornecedor'),
    path('buscar_conta_a_pagar/', views.buscar_conta_a_pagar, name='buscar_conta_a_pagar'),
    path('buscar_conta_a_receber/', views.buscar_conta_a_receber, name='buscar_conta_a_receber'),
]
