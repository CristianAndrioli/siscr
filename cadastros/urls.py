# cadastros/urls.py
# URLs movidas de core/urls.py

from django.urls import path
from . import views

app_name = 'cadastros'

urlpatterns = [
    # =======================================================================
    # CADASTRO GERAL (PESSOAS)
    # =======================================================================
    path('cadastrar_geral/', views.cadastrar_geral, name='cadastrar_geral'),
    path('listagem_geral/', views.listagem_geral, name='listagem_geral'),
    path('editar_cadastro/<int:codigo_cadastro>/', views.cadastrar_geral, name='editar_cadastro'), 
    path('excluir_cadastro/<int:codigo_cadastro>/', views.excluir_cadastro, name='excluir_cadastro'),

    # =======================================================================
    # CADASTRO DE PRODUTOS
    # =======================================================================
    path('cadastrar_produtos/', views.cadastrar_produtos, name='cadastrar_produtos'),
    path('listagem_produtos/', views.listagem_produtos, name='listagem_produtos'),
    path('editar_produto/<int:codigo_produto>/', views.editar_produto, name='editar_produto'),
    path('excluir_produto/<int:codigo_produto>/', views.excluir_produto, name='excluir_produto'),

    # =======================================================================
    # CADASTRO DE SERVIÇOS
    # =======================================================================
    path('cadastrar_servicos/', views.cadastrar_servicos, name='cadastrar_servicos'),
    path('listagem_servicos/', views.listagem_servicos, name='listagem_servicos'),
    path('editar_servico/<int:codigo_servico>/', views.editar_servico, name='editar_servico'),
    path('excluir_servico/<int:codigo_servico>/', views.excluir_servico, name='excluir_servico'),
    
    # =======================================================================
    # APIs AUXILIARES (AJAX/FETCH)
    # =======================================================================
    path('buscar_cadastro/', views.buscar_cadastro, name='buscar_cadastro'),
    path('buscar_fornecedor/', views.buscar_fornecedor, name='buscar_fornecedor'),
]
