"""
URLs da API de empresas e filiais
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import EmpresaViewSet, FilialViewSet

app_name = 'tenants_api'

# Router para viewsets
router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'filiais', FilialViewSet, basename='filial')

urlpatterns = [
    path('', include(router.urls)),
]

