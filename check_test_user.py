#!/usr/bin/env python
"""
Script para verificar o usuário teste_user
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

# Verificar usuário no schema público
print("=== Schema Público ===")
user_public = User.objects.filter(username='teste_user').first()
if user_public:
    print(f"✅ Usuário existe: {user_public.username}")
    print(f"   Email: {user_public.email}")
    print(f"   Ativo: {user_public.is_active}")
    print(f"   Staff: {user_public.is_staff}")
    print(f"   Superuser: {user_public.is_superuser}")
    # Verificar senha
    if user_public.check_password('senha123'):
        print(f"   ✅ Senha 'senha123' está correta")
    else:
        print(f"   ❌ Senha 'senha123' está incorreta")
        print(f"   🔧 Corrigindo senha...")
        user_public.set_password('senha123')
        user_public.save()
        print(f"   ✅ Senha corrigida!")
else:
    print("❌ Usuário não encontrado no schema público")

# Verificar tenant
print("\n=== Tenant ===")
tenant = Tenant.objects.filter(schema_name='teste_tenant').first()
if tenant:
    print(f"✅ Tenant encontrado: {tenant.name} ({tenant.schema_name})")
    print(f"   Ativo: {tenant.is_active}")
    
    # Verificar membership
    if user_public:
        membership = TenantMembership.objects.filter(user=user_public, tenant=tenant).first()
        if membership:
            print(f"\n✅ Membership encontrado:")
            print(f"   Role: {membership.role}")
            print(f"   Ativo: {membership.is_active}")
        else:
            print(f"\n❌ Membership não encontrado!")
            print(f"   🔧 Criando membership...")
            membership = TenantMembership.objects.create(
                user=user_public,
                tenant=tenant,
                role='admin',
                is_active=True
            )
            print(f"   ✅ Membership criado!")
else:
    print("❌ Tenant não encontrado")

# Verificar usuário no schema do tenant
print("\n=== Schema do Tenant ===")
if tenant:
    with schema_context(tenant.schema_name):
        user_tenant = User.objects.filter(username='teste_user').first()
        if user_tenant:
            print(f"✅ Usuário existe no tenant: {user_tenant.username}")
            print(f"   Ativo: {user_tenant.is_active}")
            # Verificar senha
            if user_tenant.check_password('senha123'):
                print(f"   ✅ Senha 'senha123' está correta")
            else:
                print(f"   ❌ Senha 'senha123' está incorreta")
                print(f"   🔧 Corrigindo senha...")
                user_tenant.set_password('senha123')
                user_tenant.save()
                print(f"   ✅ Senha corrigida!")
        else:
            print("❌ Usuário não encontrado no schema do tenant")
            print("   🔧 Criando usuário no tenant...")
            user_tenant = User.objects.create_user(
                username='teste_user',
                email='teste@teste.com',
                password='senha123'
            )
            print(f"   ✅ Usuário criado no tenant!")

print("\n=== Resumo ===")
print("Para fazer login, use:")
print("  URL: http://teste-tenant.localhost:8000/api/auth/login/")
print("  Username: teste_user")
print("  Password: senha123")

