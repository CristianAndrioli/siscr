"""
Permissões customizadas baseadas no papel (role) do usuário no tenant atual.

A role é armazenada no TenantMembership e também incluída no token JWT
no campo `role` (ver accounts.views.login). Aqui usamos esse campo do token
para evitar consultas extras ao banco a cada requisição.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.db import connection
from django_tenants.utils import schema_context
from .models import TenantMembership, UserProfile


class HasProdutoPermission(BasePermission):
    """
    Controla acesso ao módulo de Produtos com base na role do usuário.

    Mapeamento de permissões (por role):
    - admin:   view, add, change, delete
    - manager: view, add, change
    - user:    view, add
    - viewer:  view

    Regras por método HTTP:
    - GET (lista/detalhe): precisa de 'view'
    - POST:                precisa de 'add'
    - PUT/PATCH:           precisa de 'change'
    - DELETE:              precisa de 'delete'
    """

    # mesmo mapa usado em TenantMembership.has_permission
    permission_map = {
        "admin": {"view", "add", "change", "delete"},
        "manager": {"view", "add", "change"},
        "user": {"view", "add"},
        "viewer": {"view"},
    }

    def has_permission(self, request, view):
        user = request.user

        # Sem usuário autenticado → sem acesso
        if not user or not user.is_authenticated:
            return False

        # Superuser sempre tem acesso total
        if getattr(user, "is_superuser", False):
            return True

        # Tentar obter a role do token JWT (campo 'role' adicionado em accounts.views.login)
        role = None
        token = getattr(request, "auth", None)
        if token is not None:
            # `token` é um AccessToken (dict-like)
            role = token.get("role", None)

        if not role:
            # Sem role no token → ser conservador e negar acesso de escrita
            # Permitir apenas leitura se usuário estiver autenticado
            return request.method in SAFE_METHODS

        allowed_perms = self.permission_map.get(str(role), set())

        # Mapear método HTTP para permissão lógica
        if request.method in SAFE_METHODS:
            required_perm = "view"
        elif request.method == "POST":
            required_perm = "add"
        elif request.method in ("PUT", "PATCH"):
            required_perm = "change"
        elif request.method == "DELETE":
            required_perm = "delete"
        else:
            # Métodos não esperados → negar por padrão
            return False

        return required_perm in allowed_perms


def is_tenant_admin(user, tenant=None):
    """
    Verifica se o usuário é admin do tenant atual.
    
    Admin do tenant tem permissões absolutas em:
    - Todas as empresas e filiais do tenant
    - Gerenciamento de usuários do tenant
    - Configurações do sistema do tenant
    - Integração com Stripe e recorrência de pagamento
    - Todas as operações CRUD em todos os módulos do tenant
    """
    if not user or not user.is_authenticated:
        return False
    
    # Superuser do sistema (não do tenant) não deve ter acesso automático
    # Apenas superuser do schema público tem acesso total
    # if getattr(user, "is_superuser", False):
    #     return True
    
    # Obter tenant atual
    if not tenant:
        try:
            profile = user.profile
            tenant = profile.current_tenant
        except UserProfile.DoesNotExist:
            return False
    
    if not tenant:
        return False
    
    # Verificar membership no schema público
    with schema_context('public'):
        membership = TenantMembership.objects.filter(
            user=user,
            tenant=tenant,
            is_active=True
        ).first()
        
        if membership and membership.is_tenant_admin():
            return True
    
    return False


class IsTenantAdmin(BasePermission):
    """
    Permissão que verifica se o usuário é admin do tenant atual.
    
    Admin do tenant tem acesso total a:
    - Todas as empresas e filiais do tenant
    - Gerenciamento de usuários do tenant
    - Configurações do sistema do tenant
    - Integração Stripe e recorrência de pagamento
    """
    
    def has_permission(self, request, view):
        return is_tenant_admin(request.user)


class HasTenantPermission(BasePermission):
    """
    Permissão genérica baseada no papel (role) do usuário no tenant atual.
    
    Mapeamento de permissões (por role):
    - admin:   view, add, change, delete, manage_users, manage_settings, manage_stripe
    - manager: view, add, change
    - user:    view, add
    - viewer:  view
    """
    
    permission_map = {
        "admin": {"view", "add", "change", "delete", "manage_users", "manage_settings", "manage_stripe", "full_access"},
        "manager": {"view", "add", "change"},
        "user": {"view", "add"},
        "viewer": {"view"},
    }
    
    def has_permission(self, request, view):
        user = request.user
        
        # Sem usuário autenticado → sem acesso
        if not user or not user.is_authenticated:
            return False
        
        # Verificar se é admin do tenant (tem acesso total)
        if is_tenant_admin(user):
            return True
        
        # Tentar obter a role do token JWT
        role = None
        token = getattr(request, "auth", None)
        if token is not None:
            role = token.get("role", None)
        
        if not role:
            # Sem role no token → ser conservador e negar acesso de escrita
            return request.method in SAFE_METHODS
        
        allowed_perms = self.permission_map.get(str(role), set())
        
        # Mapear método HTTP para permissão lógica
        if request.method in SAFE_METHODS:
            required_perm = "view"
        elif request.method == "POST":
            required_perm = "add"
        elif request.method in ("PUT", "PATCH"):
            required_perm = "change"
        elif request.method == "DELETE":
            required_perm = "delete"
        else:
            return False
        
        return required_perm in allowed_perms
    
    def has_object_permission(self, request, view, obj):
        """
        Verifica se o usuário tem permissão para acessar um objeto específico.
        Admin do tenant tem acesso a todos os objetos do tenant.
        """
        # Admin do tenant tem acesso a todos os objetos do tenant
        if is_tenant_admin(request.user):
            return True
        
        # Para outros usuários, verificar permissão básica
        return self.has_permission(request, view)


