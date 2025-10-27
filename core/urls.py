from django.urls import path
from . import views # Importa as funções (views) do seu aplicativo core

app_name = 'core' # Define o namespace 'core' (necessário para o {% url 'core:...' %} nos templates)

urlpatterns = [
    # =======================================================================
    # ROTAS PRINCIPAIS E AUTENTICAÇÃO
    # =======================================================================
    path('', views.index, name='index'), 
    path('dashboard/', views.dashboard, name='dashboard'),
    path('login/', views.login, name='login'),
    path('perfil/', views.perfil, name='perfil'),
    path('logout/', views.logout, name='logout'),
    
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
    # FINANCEIRO E NOTAS
    # =======================================================================
    path('financeiro/', views.financeiro, name='financeiro'),
    path('contas_a_receber/', views.contas_a_receber, name='contas_a_receber'),
    path('contas_a_pagar/', views.contas_a_pagar, name='contas_a_pagar'),
    path('cotacoes/', views.cotacoes, name='cotacoes'),
    path('nfvenda/', views.nfvenda, name='nfvenda'),
    path('nfse/', views.nfse, name='nfse'),
    
    # =======================================================================
    # SERVIÇOS LOGÍSTICOS
    # =======================================================================
    path('servico_logistico/', views.servico_logistico, name='servico_logistico'),
    path('lista_descricao_ncm/', views.lista_descricao_ncm, name='lista_descricao_ncm'),
    path('solicitacao_estimativa_custos/', views.solicitacao_estimativa_custos, name='solicitacao_estimativa_custos'),
    path('abertura_mex/', views.abertura_mex, name='abertura_mex'),
    path('follow_up/', views.follow_up, name='follow_up'),
    path('assessoria_importacao_exportacao/', views.assessoria_importacao_exportacao, name='assessoria_importacao_exportacao'),
    path('documentacao/', views.documentacao, name='documentacao'),
    path('despacho_aduaneiro/', views.despacho_aduaneiro, name='despacho_aduaneiro'),
    path('assessoria_cambial/', views.assessoria_cambial, name='assessoria_cambial'),
    path('habilitacoes_certificacoes/', views.habilitacoes_certificacoes, name='habilitacoes_certificacoes'),
    path('desenvolvimento_fornecedores/', views.desenvolvimento_fornecedores, name='desenvolvimento_fornecedores'),
    path('cotacao_cambio/', views.cotacao_cambio, name='cotacao_cambio'),
    path('contrato/', views.contrato, name='contrato'),
    path('monitoramento/', views.monitoramento, name='monitoramento'),
    
    # =======================================================================
    # APIs AUXILIARES (AJAX/FETCH)
    # =======================================================================
    path('buscar_cadastro/', views.buscar_cadastro, name='buscar_cadastro'),
    path('buscar_fornecedor/', views.buscar_fornecedor, name='buscar_fornecedor'),
    path('buscar_conta_a_pagar/', views.buscar_conta_a_pagar, name='buscar_conta_a_pagar'),
    path('buscar_conta_a_receber/', views.buscar_conta_a_receber, name='buscar_conta_a_receber'),
]