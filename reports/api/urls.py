"""
URLs para o módulo de relatórios
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from reports.api.viewsets import (
    ReportTemplateViewSet,
    ReportConfigViewSet,
    ReportGeneratorViewSet
)

router = DefaultRouter()
router.register(r'templates', ReportTemplateViewSet, basename='report-template')
router.register(r'config', ReportConfigViewSet, basename='report-config')
router.register(r'gerar', ReportGeneratorViewSet, basename='report-generator')

urlpatterns = [
    path('', include(router.urls)),
]

