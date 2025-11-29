"""
API URLs for core app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'api'

# Router para viewsets
# NOTA: As viewsets de cadastros (Pessoa, Produto, Servico) foram movidas para cadastros/api/urls.py
# Mantendo apenas rotas específicas do core aqui
router = DefaultRouter()

urlpatterns = [
    path('', views.api_root, name='api-root'),
    path('', include(router.urls)),
]

