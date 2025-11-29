"""
Permissões customizadas baseadas no papel (role) do usuário no tenant atual.

A role é armazenada no TenantMembership e também incluída no token JWT
no campo `role` (ver accounts.views.login). Aqui usamos esse campo do token
para evitar consultas extras ao banco a cada requisição.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


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


