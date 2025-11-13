# cadastros/urls.py
# URLs limpas - apenas APIs auxiliares necessárias
# Todas as rotas de templates foram migradas para React

from django.urls import path
from . import views

app_name = 'cadastros'

urlpatterns = [
    # =======================================================================
    # APIs AUXILIARES (JSON)
    # =======================================================================
    path('buscar_cadastro/', views.buscar_cadastro, name='buscar_cadastro'),
    path('buscar_fornecedor/', views.buscar_fornecedor, name='buscar_fornecedor'),
]
