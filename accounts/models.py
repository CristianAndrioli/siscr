"""
Models para autenticação e permissões multi-tenant
"""
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant, Empresa, Filial
from core.base_models import SiscrModelBase

User = get_user_model()

# Importar modelos de roles (evita import circular)
try:
    from accounts.models_roles import CustomRole, ModulePermission
except ImportError:
    # Se não estiver disponível ainda, definir como None
    CustomRole = None
    ModulePermission = None


class UserProfile(SiscrModelBase):
    """
    Perfil do usuário vinculado a tenant
    Permite que usuários tenham acesso a múltiplos tenants
    """
    ROLE_CHOICES = [
        ('super_admin', 'Super Administrador'),
        ('admin', 'Administrador'),
        ('manager', 'Gerente'),
        ('user', 'Usuário'),
        ('viewer', 'Visualizador'),
    ]
    
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile',
        verbose_name='Usuário'
    )
    
    # Tenant atual (usuário pode ter acesso a múltiplos)
    current_tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Tenant Atual'
    )
    
    # Empresa e Filial atuais
    current_empresa = models.ForeignKey(
        Empresa, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Empresa Atual'
    )
    
    current_filial = models.ForeignKey(
        Filial, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='user_profiles',
        verbose_name='Filial Atual'
    )
    
    # Informações adicionais
    phone = models.CharField(
        max_length=20, 
        blank=True, 
        verbose_name='Telefone'
    )
    # Avatar temporariamente desabilitado (requer Pillow)
    # avatar = models.ImageField(
    #     upload_to='avatars/', 
    #     blank=True, 
    #     null=True, 
    #     verbose_name='Avatar'
    # )
    
    class Meta:
        verbose_name = 'Perfil de Usuário'
        verbose_name_plural = 'Perfis de Usuário'
        indexes = [
            models.Index(fields=['user', 'current_tenant']),
        ]
    
    def __str__(self):
        tenant_name = self.current_tenant.name if self.current_tenant else 'Sem tenant'
        return f"{self.user.username} - {tenant_name}"
    
    def get_tenants(self):
        """Retorna todos os tenants que o usuário tem acesso"""
        return Tenant.objects.filter(
            members__user=self.user,
            members__is_active=True
        ).distinct()


class TenantMembership(SiscrModelBase):
    """
    Membros de um tenant (relação many-to-many entre User e Tenant)
    Define o papel do usuário em cada tenant
    """
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('manager', 'Gerente'),
        ('user', 'Usuário'),
        ('viewer', 'Visualizador'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='tenant_memberships',
        verbose_name='Usuário'
    )
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='members',
        verbose_name='Tenant'
    )
    
    role = models.CharField(
        max_length=50,  # Aumentado para suportar códigos de roles customizados
        choices=ROLE_CHOICES,  # Mantém choices para validação, mas aceita valores customizados
        default='user',
        verbose_name='Papel',
        help_text='Papel do usuário (roles do sistema: admin, manager, user, viewer ou código de role customizado)'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='Entrou em')
    
    class Meta:
        verbose_name = 'Membro do Tenant'
        verbose_name_plural = 'Membros dos Tenants'
        unique_together = ['user', 'tenant']
        indexes = [
            models.Index(fields=['user', 'tenant', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.username} em {self.tenant.name} ({self.get_role_display()})"
    
    def has_permission(self, permission):
        """
        Verifica se o membro tem uma permissão específica
        Baseado no papel (role)
        
        Admin do tenant tem permissões absolutas em:
        - Todas as empresas e filiais do tenant
        - Gerenciamento de usuários do tenant
        - Configurações do sistema do tenant
        - Integração com Stripe e recorrência de pagamento
        - Todas as operações CRUD em todos os módulos
        """
        permission_map = {
            'admin': [
                # Permissões básicas CRUD
                'view', 'add', 'change', 'delete',
                # Gerenciamento de usuários e permissões
                'manage_users', 'manage_permissions', 'manage_roles',
                # Gerenciamento de empresas e filiais
                'manage_empresas', 'manage_filiais',
                # Configurações do sistema
                'manage_settings', 'manage_configurations',
                # Integração Stripe e pagamentos
                'manage_stripe', 'manage_subscriptions', 'manage_payments',
                # Acesso total ao sistema do tenant
                'full_access',
            ],
            'manager': ['view', 'add', 'change'],
            'user': ['view', 'add'],
            'viewer': ['view'],
        }
        return permission in permission_map.get(self.role, [])
    
    def is_tenant_admin(self):
        """
        Verifica se o membro é admin do tenant
        Admin do tenant tem permissões absolutas em todas as empresas e filiais do tenant
        """
        return self.role == 'admin' and self.is_active
