"""
ViewSets para gerenciamento de usuários do tenant
Apenas admins do tenant podem gerenciar usuários
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from accounts.models import UserProfile, TenantMembership
from accounts.permissions import IsTenantAdmin
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer, TenantMembershipSerializer
)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de usuários do tenant.
    Apenas admins do tenant podem acessar.
    """
    permission_classes = [IsAuthenticated, IsTenantAdmin]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    def get_queryset(self):
        """Retorna todos os usuários que são membros do tenant atual (ativos e inativos)"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            # Se não houver tenant no contexto, tentar obter do perfil do usuário
            try:
                profile = self.request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                return User.objects.none()
        
        if not tenant:
            return User.objects.none()
        
        # Buscar usuários que têm membership no tenant atual (incluindo inativos)
        # Isso garante que todos os usuários sejam exibidos, incluindo o admin logado
        with schema_context('public'):
            memberships = TenantMembership.objects.filter(
                tenant=tenant
            ).select_related('user')
            user_ids = [m.user_id for m in memberships]
        
        if not user_ids:
            return User.objects.none()
        
        return User.objects.filter(id__in=user_ids).order_by('username')
    
    def get_serializer_class(self):
        """Retorna o serializer apropriado para cada ação"""
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_serializer_context(self):
        """Adiciona o tenant ao contexto do serializer"""
        context = super().get_serializer_context()
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = self.request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                pass
        context['tenant'] = tenant
        return context
    
    def create(self, request, *args, **kwargs):
        """Cria um novo usuário no tenant"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Retornar dados completos do usuário criado
        output_serializer = UserSerializer(user, context=self.get_serializer_context())
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Atualiza um usuário"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Retornar dados completos do usuário atualizado
        output_serializer = UserSerializer(user, context=self.get_serializer_context())
        return Response(output_serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Desativa o membership do usuário no tenant (não deleta o usuário)"""
        instance = self.get_object()
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                return Response(
                    {'error': 'Tenant não identificado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Não permitir que o admin se remova
        if instance == request.user:
            return Response(
                {'error': 'Você não pode remover seu próprio acesso ao tenant'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Desativar membership ao invés de deletar
        with schema_context('public'):
            membership = TenantMembership.objects.filter(
                user=instance,
                tenant=tenant
            ).first()
            if membership:
                membership.is_active = False
                membership.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Reativa o membership de um usuário"""
        user = self.get_object()
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                return Response(
                    {'error': 'Tenant não identificado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        with schema_context('public'):
            membership = TenantMembership.objects.filter(
                user=user,
                tenant=tenant
            ).first()
            if membership:
                membership.is_active = True
                membership.save()
                return Response({'message': 'Usuário reativado com sucesso'})
            else:
                return Response(
                    {'error': 'Membership não encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
    
    @action(detail=True, methods=['get'])
    def permissions(self, request, pk=None):
        """Retorna as permissões do usuário no tenant"""
        user = self.get_object()
        return self._get_user_permissions(user, request)
    
    @action(detail=False, methods=['get'], url_path='me/permissions', permission_classes=[IsAuthenticated])
    def my_permissions(self, request):
        """
        Retorna as permissões do usuário atual logado.
        Qualquer usuário autenticado pode acessar suas próprias permissões.
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'[my_permissions] Usuário: {request.user.username}, Tenant: {getattr(connection, "tenant", None)}')
        result = self._get_user_permissions(request.user, request)
        logger.info(f'[my_permissions] Resultado: {result.data if hasattr(result, "data") else result}')
        return result
    
    def _get_user_permissions(self, user, request):
        """Helper para obter permissões de um usuário"""
        from accounts.models_roles import CustomRole, ModulePermission
        
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            try:
                profile = request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                return Response(
                    {'error': 'Tenant não identificado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if not tenant:
            return Response(
                {'error': 'Tenant não identificado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with schema_context('public'):
            membership = TenantMembership.objects.filter(
                user=user,
                tenant=tenant
            ).first()
            
            if not membership:
                return Response(
                    {'error': 'Membership não encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            role_code = membership.role
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f'[_get_user_permissions] Role do usuário: {role_code}')
            
            # Verificar se é role do sistema ou customizado
            system_roles = [choice[0] for choice in TenantMembership.ROLE_CHOICES]
            logger.info(f'[_get_user_permissions] Roles do sistema: {system_roles}')
            
            if role_code in system_roles:
                # Role do sistema - usar permission_map padrão
                permission_map = {
                    'admin': [
                        'view', 'add', 'change', 'delete',
                        'manage_users', 'manage_permissions', 'manage_roles',
                        'manage_empresas', 'manage_filiais',
                        'manage_settings', 'manage_configurations',
                        'manage_stripe', 'manage_subscriptions', 'manage_payments',
                        'full_access',
                    ],
                    'manager': ['view', 'add', 'change'],
                    'user': ['view', 'add'],
                    'viewer': ['view'],
                }
                
                permissions = permission_map.get(role_code, [])
                
                # Roles do sistema têm acesso a todos os módulos
                # Retornar todos os módulos disponíveis com as ações permitidas
                from accounts.modules_registry import get_available_modules
                available_modules = get_available_modules()
                modules = {}
                for module in available_modules:
                    # Para roles do sistema, verificar quais ações são permitidas
                    if role_code == 'admin':
                        modules[module['code']] = {
                            'name': module['name'],
                            'actions': module['actions'],  # Todas as ações
                        }
                    elif role_code == 'manager':
                        modules[module['code']] = {
                            'name': module['name'],
                            'actions': ['view', 'add', 'change'],
                        }
                    elif role_code == 'user':
                        modules[module['code']] = {
                            'name': module['name'],
                            'actions': ['view', 'add'],
                        }
                    elif role_code == 'viewer':
                        modules[module['code']] = {
                            'name': module['name'],
                            'actions': ['view'],
                        }
            else:
                # Role customizado - buscar permissões do CustomRole
                logger.info(f'[_get_user_permissions] Buscando role customizado: {role_code} para tenant: {tenant}')
                try:
                    custom_role = CustomRole.objects.get(
                        tenant=tenant,
                        code=role_code,
                        is_active=True
                    )
                    logger.info(f'[_get_user_permissions] Role customizado encontrado: {custom_role.name}')
                    
                    # Buscar permissões por módulo
                    module_perms = ModulePermission.objects.filter(
                        role=custom_role
                    ).select_related('role')
                    
                    logger.info(f'[_get_user_permissions] Permissões de módulo encontradas: {module_perms.count()}')
                    
                    modules = {}
                    permissions = []
                    
                    for perm in module_perms:
                        logger.info(f'[_get_user_permissions] Módulo: {perm.module}, Ações: {perm.actions}')
                        modules[perm.module] = {
                            'name': perm.module_display or perm.module,
                            'actions': perm.actions or [],
                        }
                        # Adicionar ações como permissões globais também
                        permissions.extend(perm.actions or [])
                    
                    # Remover duplicatas
                    permissions = list(set(permissions))
                    
                    logger.info(f'[_get_user_permissions] Módulos finais: {list(modules.keys())}')
                    logger.info(f'[_get_user_permissions] Permissões finais: {permissions}')
                    
                    role_display = custom_role.name
                except CustomRole.DoesNotExist:
                    # Role customizado não encontrado
                    logger.warning(f'[_get_user_permissions] Role customizado não encontrado: {role_code}')
                    return Response({
                        'role': role_code,
                        'role_display': 'Role não encontrado',
                        'permissions': [],
                        'modules': {},
                    })
            
            # Obter role_display
            if role_code in system_roles:
                role_display = dict(TenantMembership.ROLE_CHOICES).get(role_code, role_code)
            else:
                try:
                    custom_role = CustomRole.objects.get(tenant=tenant, code=role_code)
                    role_display = custom_role.name
                except CustomRole.DoesNotExist:
                    role_display = role_code
            
            return Response({
                'role': role_code,
                'role_display': role_display,
                'permissions': permissions,
                'modules': modules,  # Módulos e suas ações permitidas
            })

