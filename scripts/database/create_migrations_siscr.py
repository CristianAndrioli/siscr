#!/usr/bin/env python
"""
Script para criar migrações dos campos do SiscrModelBase

Uso:
    python scripts/database/create_migrations_siscr.py

Nota: Este script é uma referência. É recomendado criar migrações manualmente:
    docker-compose exec web python manage.py makemigrations --name add_siscr_fields
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.utils import timezone
from django.db import migrations, models
from django.conf import settings

# Função para adicionar campos do SiscrModelBase
def add_siscr_fields(app_label, model_name):
    """Retorna operações de migração para adicionar campos do SiscrModelBase"""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    operations = [
        migrations.AddField(
            model_name=model_name.lower(),
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                default=timezone.now,
                verbose_name='Data de Criação'
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='updated_at',
            field=models.DateTimeField(
                auto_now=True,
                default=timezone.now,
                verbose_name='Data de Atualização'
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='created_by',
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name=f'{model_name.lower()}_created',
                verbose_name='Criado por'
            ),
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='updated_by',
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name=f'{model_name.lower()}_updated',
                verbose_name='Atualizado por'
            ),
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='owner',
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name=f'{model_name.lower()}_owned',
                verbose_name='Proprietário'
            ),
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='is_deleted',
            field=models.BooleanField(default=False, verbose_name='Excluído'),
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='deleted_at',
            field=models.DateTimeField(null=True, blank=True, verbose_name='Data de Exclusão'),
        ),
        migrations.AddField(
            model_name=model_name.lower(),
            name='deleted_by',
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=models.SET_NULL,
                null=True,
                blank=True,
                related_name=f'{model_name.lower()}_deleted',
                verbose_name='Excluído por'
            ),
        ),
    ]
    return operations

# Modelos que precisam de migrações
MODELS_TO_MIGRATE = {
    'cadastros': ['Pessoa', 'Produto', 'Servico', 'ContaReceber', 'ContaPagar'],
    'tenants': ['Empresa', 'Filial'],
    'accounts': ['UserProfile', 'TenantMembership'],
    'subscriptions': ['Plan', 'Feature', 'Subscription', 'QuotaUsage'],
    'payments': ['PaymentMethod', 'Payment', 'Invoice'],
}

print("Este script criaria migrações, mas é melhor fazer manualmente.")
print("Execute: docker-compose exec web python manage.py makemigrations --name add_siscr_fields")
print("E quando perguntar sobre o default, escolha opção 1 e use: timezone.now")

