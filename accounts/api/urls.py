"""
URLs da API de gerenciamento de usuários e roles
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import UserViewSet
from .viewsets_roles import CustomRoleViewSet

app_name = 'accounts_api'

# Router para viewsets
router = DefaultRouter()
router.register(r'usuarios', UserViewSet, basename='usuario')
router.register(r'roles', CustomRoleViewSet, basename='role')

urlpatterns = [
    path('', include(router.urls)),
]

