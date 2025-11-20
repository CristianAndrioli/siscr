#!/usr/bin/env python
"""
Script para corrigir o usuário teste_user e torná-lo staff
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.contrib.auth import get_user_model
from tenants.models import Tenant
from accounts.models import TenantMembership
from django_tenants.utils import schema_context

User = get_user_model()

# Corrigir usuário no schema público
print("=== Corrigindo usuário no schema público ===")
user_public = User.objects.filter(username='teste_user').first()
if user_public:
    user_public.is_staff = True
    user_public.is_superuser = True
    user_public.set_password('senha123')
    user_public.save()
    print(f"✅ Usuário {user_public.username} agora é staff e superuser")
else:
    print("❌ Usuário não encontrado")

# Corrigir usuário no schema do tenant
print("\n=== Corrigindo usuário no schema do tenant ===")
tenant = Tenant.objects.filter(schema_name='teste_tenant').first()
if tenant:
    with schema_context(tenant.schema_name):
        user_tenant = User.objects.filter(username='teste_user').first()
        if user_tenant:
            user_tenant.is_staff = True
            user_tenant.is_superuser = True
            user_tenant.set_password('senha123')
            user_tenant.save()
            print(f"✅ Usuário {user_tenant.username} no tenant agora é staff e superuser")
        else:
            print("❌ Usuário não encontrado no tenant")

print("\n✅ Usuário corrigido!")
print("\nCredenciais:")
print("  Username: teste_user")
print("  Password: senha123")
print("  URL Login: http://teste-tenant.localhost:8000/api/auth/login/")
print("  URL Admin: http://teste-tenant.localhost:8000/admin/")

