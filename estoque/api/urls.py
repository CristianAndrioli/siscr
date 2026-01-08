"""
URLs da API do módulo de Estoque
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import (
    LocationViewSet,
    EstoqueViewSet,
    MovimentacaoEstoqueViewSet,
    ReservaEstoqueViewSet,
    PrevisaoMovimentacaoViewSet,
    GrupoFilialViewSet,
    RelatorioViewSet,
)

app_name = 'estoque_api'

# Router para viewsets
router = DefaultRouter()
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'estoques', EstoqueViewSet, basename='estoque')
router.register(r'movimentacoes', MovimentacaoEstoqueViewSet, basename='movimentacao')
router.register(r'reservas', ReservaEstoqueViewSet, basename='reserva')
router.register(r'previsoes', PrevisaoMovimentacaoViewSet, basename='previsao')
router.register(r'grupos-filiais', GrupoFilialViewSet, basename='grupo-filial')
router.register(r'relatorios', RelatorioViewSet, basename='relatorio')

urlpatterns = [
    path('', include(router.urls)),
]

