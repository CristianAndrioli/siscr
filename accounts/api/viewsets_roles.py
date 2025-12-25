"""
ViewSets para gerenciamento de roles e permissões customizados
Apenas admins do tenant podem gerenciar roles
"""
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from django_tenants.utils import schema_context
from accounts.models_roles import CustomRole, ModulePermission
from accounts.permissions import IsTenantAdmin
from accounts.modules_registry import get_available_modules
from .serializers_roles import (
    CustomRoleSerializer,
    CustomRoleCreateSerializer,
    CustomRoleUpdateSerializer,
    AvailableModuleSerializer,
)


class CustomRoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de roles customizados do tenant.
    Apenas admins do tenant podem acessar.
    """
    permission_classes = [IsAuthenticated, IsTenantAdmin]
    search_fields = ['name', 'code', 'description']
    
    def get_queryset(self):
        """Retorna apenas roles do tenant atual"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = self.request.user.profile
                tenant = profile.current_tenant
            except:
                return CustomRole.objects.none()
        
        if not tenant:
            return CustomRole.objects.none()
        
        return CustomRole.objects.filter(tenant=tenant).order_by('name')
    
    def get_serializer_class(self):
        """Retorna o serializer apropriado para cada ação"""
        if self.action == 'create':
            return CustomRoleCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CustomRoleUpdateSerializer
        return CustomRoleSerializer
    
    def get_serializer_context(self):
        """Adiciona o tenant e módulos disponíveis ao contexto do serializer"""
        context = super().get_serializer_context()
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = self.request.user.profile
                tenant = profile.current_tenant
            except:
                pass
        
        context['tenant'] = tenant
        
        # Adicionar módulos disponíveis ao contexto
        available_modules = get_available_modules()
        context['available_modules'] = {
            module['code']: module for module in available_modules
        }
        
        return context
    
    def perform_create(self, serializer):
        """Cria o role no tenant atual"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = self.request.user.profile
                tenant = profile.current_tenant
            except:
                raise serializers.ValidationError('Tenant não identificado')
        
        serializer.save(tenant=tenant)
    
    def perform_destroy(self, instance):
        """Não permite deletar roles do sistema"""
        if instance.is_system:
            raise serializers.ValidationError('Não é possível excluir roles do sistema.')
        instance.delete()
    
    @action(detail=False, methods=['get'])
    def available_modules(self, request):
        """Retorna lista de módulos disponíveis no sistema"""
        modules = get_available_modules()
        serializer = AvailableModuleSerializer(modules, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplica um role existente"""
        role = self.get_object()
        
        # Criar novo role baseado no existente
        new_role = CustomRole.objects.create(
            tenant=role.tenant,
            name=f"{role.name} (Cópia)",
            code=f"{role.code}_copy",
            description=role.description,
            is_active=role.is_active,
        )
        
        # Copiar permissões
        for perm in role.module_permissions.all():
            ModulePermission.objects.create(
                role=new_role,
                module=perm.module,
                module_display=perm.module_display,
                actions=perm.actions.copy()
            )
        
        serializer = self.get_serializer(new_role)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

