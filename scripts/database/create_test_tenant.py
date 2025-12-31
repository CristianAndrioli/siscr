#!/usr/bin/env python
"""
Script para criar tenant de teste

Uso:
    python scripts/database/create_test_tenant.py

Cria:
    - Tenant 'Teste Tenant' com schema 'teste_tenant'
    - Domínio 'teste-tenant.localhost'
    - Usuário 'teste_user' no schema público e no tenant
    - Empresa de teste no tenant
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from tenants.models import Tenant, Domain, Empresa
from django.contrib.auth import get_user_model
from accounts.models import UserProfile, TenantMembership
from django_tenants.utils import schema_context

User = get_user_model()

# Criar tenant
tenant = Tenant.objects.create(
    name='Teste Tenant',
    schema_name='teste_tenant',
    is_active=True
)

# Criar domínio
Domain.objects.create(
    domain='teste-tenant.localhost',
    tenant=tenant,
    is_primary=True
)

# Criar usuário no schema público
user_public = User.objects.create_user(
    username='teste_user',
    email='teste@teste.com',
    password='senha123'
)

# Criar perfil e membership
UserProfile.objects.create(
    user=user_public,
    current_tenant=tenant
)

TenantMembership.objects.create(
    user=user_public,
    tenant=tenant,
    role='admin',
    is_active=True
)

# Migrar schema do tenant
from django.core.management import call_command
call_command('migrate_schemas', schema_name=tenant.schema_name)

# Criar usuário e empresa no schema do tenant
with schema_context(tenant.schema_name):
    user_tenant = User.objects.create_user(
        username='teste_user',
        email='teste@teste.com',
        password='senha123'
    )
    
    empresa = Empresa.objects.create(
        tenant=tenant,
        nome='Empresa Teste',
        razao_social='Empresa Teste LTDA',
        cnpj='12345678000190',
        is_active=True
    )
    
    print(f'✅ Tenant criado: {tenant.name} ({tenant.schema_name})')
    print(f'✅ Domínio: teste-tenant.localhost')
    print(f'✅ Usuário público: {user_public.username}')
    print(f'✅ Usuário no tenant: {user_tenant.username}')
    print(f'✅ Empresa criada: {empresa.nome}')

