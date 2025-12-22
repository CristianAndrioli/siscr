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
    path('tenant/backup/', views.backup_tenant, name='tenant-backup'),
    path('tenant/backup-info/', views.tenant_backup_info, name='tenant-backup-info'),
    path('', include(router.urls)),
]

