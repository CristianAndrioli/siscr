# cadastros/api/urls.py
# URLs da API movidas de core/api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import PessoaViewSet, ProdutoViewSet, ServicoViewSet

app_name = 'cadastros_api'

# Router para viewsets
router = DefaultRouter()
router.register(r'pessoas', PessoaViewSet, basename='pessoa')
router.register(r'produtos', ProdutoViewSet, basename='produto')
router.register(r'servicos', ServicoViewSet, basename='servico')

urlpatterns = [
    path('', include(router.urls)),
]

