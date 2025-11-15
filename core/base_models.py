"""
Modelos Base do Sistema SISCR
Inspirado no modelo de objetos do Salesforce

Hierarquia:
- ModelBase: Classe base fundamental (com campo id)
- SiscrModelBase: Herda de ModelBase, adiciona campos obrigatórios comuns
- Todos os modelos do sistema devem herdar de SiscrModelBase
"""
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

# Importar função para obter usuário atual (evita import circular)
try:
    from core.middleware import get_current_user
except ImportError:
    # Fallback se middleware não estiver disponível
    def get_current_user():
        return None


class SiscrManager(models.Manager):
    """
    Manager customizado para filtrar automaticamente registros excluídos (soft delete).
    Similar ao comportamento do Salesforce.
    """
    
    def get_queryset(self):
        """Retorna apenas registros não excluídos"""
        return super().get_queryset().filter(is_deleted=False)
    
    def all_with_deleted(self):
        """Retorna todos os registros, incluindo excluídos"""
        return super().get_queryset()
    
    def deleted_only(self):
        """Retorna apenas registros excluídos"""
        return super().get_queryset().filter(is_deleted=True)


class ModelBase(models.Model):
    """
    Classe base fundamental para todos os modelos.
    Contém apenas o campo id (auto-incremento padrão do Django).
    
    Este é o nível mais básico - use quando precisar apenas do id.
    """
    
    class Meta:
        abstract = True


class SiscrModelBase(ModelBase):
    """
    Classe base para todos os modelos do SISCR.
    Herda de ModelBase e adiciona campos obrigatórios comuns.
    
    Inspirado no modelo de objetos do Salesforce:
    - Id: Campo id automático (herdado do Django)
    - CreatedDate: Data de criação
    - LastModifiedDate: Data de última modificação
    - CreatedBy: Usuário que criou
    - LastModifiedBy: Usuário que modificou
    - OwnerId: Proprietário do registro (pode ser diferente de CreatedBy)
    - IsDeleted: Soft delete (como no Salesforce)
    - DeletedDate: Data de exclusão
    - DeletedBy: Usuário que deletou
    """
    
    # Campos de auditoria (obrigatórios)
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Criação',
        help_text='Data e hora em que o registro foi criado'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Data de Atualização',
        help_text='Data e hora da última modificação do registro'
    )
    
    # Campos de usuário (obrigatórios)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created',
        verbose_name='Criado por',
        help_text='Usuário que criou o registro'
    )
    
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated',
        verbose_name='Atualizado por',
        help_text='Usuário que fez a última modificação'
    )
    
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_owned',
        verbose_name='Proprietário',
        help_text='Proprietário do registro (pode ser diferente de quem criou)'
    )
    
    # Soft Delete (como no Salesforce)
    is_deleted = models.BooleanField(
        default=False,
        verbose_name='Excluído',
        help_text='Indica se o registro foi excluído (soft delete)'
    )
    
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Data de Exclusão',
        help_text='Data e hora em que o registro foi excluído'
    )
    
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_deleted',
        verbose_name='Excluído por',
        help_text='Usuário que excluiu o registro'
    )
    
    # Manager customizado para filtrar registros excluídos
    objects = SiscrManager()
    all_objects = models.Manager()  # Manager padrão (sem filtro de soft delete)
    
    class Meta:
        abstract = True
        # Índices para performance
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['updated_at']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['owner']),
        ]
    
    def delete(self, using=None, keep_parents=False, user=None):
        """
        Soft delete - marca como excluído ao invés de remover do banco.
        Similar ao comportamento do Salesforce.
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        
        # Usar usuário fornecido ou tentar obter do contexto atual
        if user:
            self.deleted_by = user
        else:
            current_user = get_current_user()
            if current_user:
                self.deleted_by = current_user
        
        self.save(using=using)
    
    def hard_delete(self, using=None, keep_parents=False):
        """
        Hard delete - remove permanentemente do banco.
        Use com cuidado!
        """
        return super().delete(using=using, keep_parents=keep_parents)
    
    def restore(self, user=None):
        """
        Restaura um registro excluído (soft delete).
        """
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        if user:
            self.updated_by = user
        self.save()
    
    def save(self, *args, **kwargs):
        """
        Override do save para atualizar campos de auditoria automaticamente.
        Preenche created_by, updated_by e owner baseado no usuário atual.
        """
        current_user = get_current_user()
        
        # Se o objeto já existe e está sendo atualizado
        if self.pk:
            if current_user:
                self.updated_by = current_user
                # Manter owner se já existir, senão atualizar
                if not self.owner:
                    self.owner = current_user
        else:
            # Se é um novo objeto
            if current_user:
                self.created_by = current_user
                if not self.owner:
                    self.owner = current_user
        
        super().save(*args, **kwargs)

