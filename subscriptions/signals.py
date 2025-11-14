"""
Signals para atualizar quotas automaticamente
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from tenants.models import Empresa, Filial
from .models import QuotaUsage

User = get_user_model()


@receiver(post_save, sender=User)
def update_user_quota_on_create(sender, instance, created, **kwargs):
    """Atualiza quota de usuários quando um novo usuário é criado"""
    if created:
        # Verificar se estamos em um schema de tenant
        from django.db import connection
        schema_name = connection.schema_name
        
        if schema_name and schema_name != 'public':
            # Buscar tenant pelo schema
            from tenants.models import Tenant
            try:
                tenant = Tenant.objects.get(schema_name=schema_name)
                quota_usage, _ = QuotaUsage.objects.get_or_create(tenant=tenant)
                quota_usage.increment_quota('users', 1)
            except Tenant.DoesNotExist:
                pass


@receiver(post_delete, sender=User)
def update_user_quota_on_delete(sender, instance, **kwargs):
    """Atualiza quota de usuários quando um usuário é deletado"""
    from django.db import connection
    schema_name = connection.schema_name
    
    if schema_name and schema_name != 'public':
        from tenants.models import Tenant
        try:
            tenant = Tenant.objects.get(schema_name=schema_name)
            quota_usage = getattr(tenant, 'quota_usage', None)
            if quota_usage:
                quota_usage.decrement_quota('users', 1)
        except Tenant.DoesNotExist:
            pass


@receiver(post_save, sender=Empresa)
def update_empresa_quota_on_create(sender, instance, created, **kwargs):
    """Atualiza quota de empresas quando uma nova empresa é criada"""
    if created:
        tenant = instance.tenant
        quota_usage, _ = QuotaUsage.objects.get_or_create(tenant=tenant)
        quota_usage.increment_quota('empresas', 1)


@receiver(post_delete, sender=Empresa)
def update_empresa_quota_on_delete(sender, instance, **kwargs):
    """Atualiza quota de empresas quando uma empresa é deletada"""
    tenant = instance.tenant
    quota_usage = getattr(tenant, 'quota_usage', None)
    if quota_usage:
        quota_usage.decrement_quota('empresas', 1)


@receiver(post_save, sender=Filial)
def update_filial_quota_on_create(sender, instance, created, **kwargs):
    """Atualiza quota de filiais quando uma nova filial é criada"""
    if created:
        tenant = instance.empresa.tenant
        quota_usage, _ = QuotaUsage.objects.get_or_create(tenant=tenant)
        quota_usage.increment_quota('filiais', 1)


@receiver(post_delete, sender=Filial)
def update_filial_quota_on_delete(sender, instance, **kwargs):
    """Atualiza quota de filiais quando uma filial é deletada"""
    tenant = instance.empresa.tenant
    quota_usage = getattr(tenant, 'quota_usage', None)
    if quota_usage:
        quota_usage.decrement_quota('filiais', 1)

