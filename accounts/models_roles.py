"""
Modelos para sistema de roles e permissões customizados por tenant
"""
from django.db import models
from django.core.exceptions import ValidationError
from tenants.models import Tenant
from core.base_models import SiscrModelBase


class CustomRole(SiscrModelBase):
    """
    Role customizado criado pelo admin do tenant
    Permite definir permissões por módulo de forma granular
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='custom_roles',
        verbose_name='Tenant'
    )
    
    name = models.CharField(
        max_length=100,
        verbose_name='Nome do Role',
        help_text='Nome do papel (ex: "Gerente Financeiro", "Operador de Cadastros")'
    )
    
    code = models.CharField(
        max_length=50,
        verbose_name='Código',
        help_text='Código único do role (ex: "gerente_financeiro", "operador_cadastros")'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Descrição',
        help_text='Descrição do que este role permite fazer'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='Ativo'
    )
    
    is_system = models.BooleanField(
        default=False,
        verbose_name='Role do Sistema',
        help_text='Roles do sistema (admin, manager, user, viewer) não podem ser editados'
    )
    
    class Meta:
        verbose_name = 'Role Customizado'
        verbose_name_plural = 'Roles Customizados'
        unique_together = ['tenant', 'code']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['tenant', 'code']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.tenant.name})"
    
    def clean(self):
        """Validação: código deve ser único no tenant e não pode ser um dos roles do sistema"""
        if self.code in ['admin', 'manager', 'user', 'viewer']:
            raise ValidationError('Este código é reservado para roles do sistema.')
        
        # Verificar se já existe outro role com o mesmo código no mesmo tenant
        if self.pk:
            existing = CustomRole.objects.filter(
                tenant=self.tenant,
                code=self.code
            ).exclude(pk=self.pk).first()
        else:
            existing = CustomRole.objects.filter(
                tenant=self.tenant,
                code=self.code
            ).first()
        
        if existing:
            raise ValidationError(f'Já existe um role com o código "{self.code}" neste tenant.')
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ModulePermission(SiscrModelBase):
    """
    Permissão de um role em um módulo específico
    Define quais ações o role pode realizar no módulo
    """
    # Ações possíveis
    ACTION_CHOICES = [
        ('view', 'Visualizar'),
        ('add', 'Criar'),
        ('change', 'Editar'),
        ('delete', 'Excluir'),
        ('export', 'Exportar'),
        ('import', 'Importar'),
        ('approve', 'Aprovar'),
        ('reject', 'Rejeitar'),
        ('manage', 'Gerenciar'),
    ]
    
    role = models.ForeignKey(
        CustomRole,
        on_delete=models.CASCADE,
        related_name='module_permissions',
        verbose_name='Role'
    )
    
    module = models.CharField(
        max_length=50,
        verbose_name='Módulo',
        help_text='Código do módulo (ex: "cadastros", "financeiro", "faturamento")'
    )
    
    module_display = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Nome do Módulo',
        help_text='Nome exibido do módulo (ex: "Cadastros", "Financeiro")'
    )
    
    actions = models.JSONField(
        default=list,
        verbose_name='Ações Permitidas',
        help_text='Lista de ações permitidas neste módulo (ex: ["view", "add", "change"])'
    )
    
    class Meta:
        verbose_name = 'Permissão de Módulo'
        verbose_name_plural = 'Permissões de Módulos'
        unique_together = ['role', 'module']
        indexes = [
            models.Index(fields=['role', 'module']),
        ]
    
    def __str__(self):
        actions_str = ', '.join(self.actions) if self.actions else 'Nenhuma'
        return f"{self.role.name} - {self.module_display or self.module}: {actions_str}"
    
    def has_action(self, action):
        """Verifica se o role tem uma ação específica neste módulo"""
        return action in self.actions
    
    def add_action(self, action):
        """Adiciona uma ação à lista de permissões"""
        if action not in self.actions:
            self.actions.append(action)
            self.save(update_fields=['actions'])
    
    def remove_action(self, action):
        """Remove uma ação da lista de permissões"""
        if action in self.actions:
            self.actions.remove(action)
            self.save(update_fields=['actions'])

