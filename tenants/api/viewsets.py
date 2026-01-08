"""
ViewSets para Empresa e Filial
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from tenants.models import Empresa, Filial
from .serializers import EmpresaSerializer, FilialSerializer


class EmpresaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de empresas do tenant
    """
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nome', 'razao_social', 'cnpj', 'cidade']
    
    def get_queryset(self):
        """Retorna empresas do tenant atual"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            return Empresa.objects.none()
        return Empresa.objects.filter(tenant=tenant).order_by('nome')
    
    def destroy(self, request, *args, **kwargs):
        """Deleta empresa e atualiza quota"""
        instance = self.get_object()
        tenant = getattr(connection, 'tenant', None)
        
        if tenant:
            from subscriptions.models import QuotaUsage
            quota_usage = getattr(tenant, 'quota_usage', None)
            if quota_usage:
                quota_usage.decrement_quota('empresas', 1)
        
        return super().destroy(request, *args, **kwargs)


class FilialViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de filiais do tenant
    """
    serializer_class = FilialSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nome', 'codigo_filial', 'cnpj', 'cidade', 'empresa__nome']
    
    def get_queryset(self):
        """Retorna filiais do tenant atual"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            return Filial.objects.none()
        
        queryset = Filial.objects.filter(empresa__tenant=tenant).select_related('empresa')
        
        # Filtro opcional por empresa
        empresa_id = self.request.query_params.get('empresa', None)
        if empresa_id:
            queryset = queryset.filter(empresa_id=empresa_id)
        
        return queryset.order_by('empresa__nome', 'nome')
    
    def destroy(self, request, *args, **kwargs):
        """Deleta filial e atualiza quota"""
        instance = self.get_object()
        tenant = getattr(connection, 'tenant', None)
        
        if tenant:
            from subscriptions.models import QuotaUsage
            quota_usage = getattr(tenant, 'quota_usage', None)
            if quota_usage:
                quota_usage.decrement_quota('filiais', 1)
        
        return super().destroy(request, *args, **kwargs)

