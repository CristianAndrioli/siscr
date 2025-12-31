#!/usr/bin/env python
"""
Script para verificar se um usuário existe no banco de dados

Uso:
    python scripts/dev/check_user.py [username] [password]
    python scripts/dev/check_user.py teste_user

Se nenhum username for fornecido, usa 'teste_user' como padrão.
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import UserProfile, TenantMembership
from django_tenants.utils import schema_context
from django.db import connection

User = get_user_model()

def check_user(username, check_password=None):
    """
    Verifica se um usuário existe e onde
    
    Args:
        username: Nome do usuário a verificar
        check_password: Senha para verificar (opcional)
    
    Returns:
        bool: True se usuário encontrado, False caso contrário
    """
    print(f"\n{'='*60}")
    print(f"Verificando usuário: {username}")
    print(f"{'='*60}\n")
    
    # Verificar no schema público
    print("1. Verificando no schema PÚBLICO:")
    users_public = User.objects.filter(username=username)
    if users_public.exists():
        for user in users_public:
            print(f"   ✓ Usuário encontrado: {user.username} (ID: {user.id}, Email: {user.email})")
            print(f"   - Ativo: {user.is_active}")
            print(f"   - Staff: {user.is_staff}")
            print(f"   - Superuser: {user.is_superuser}")
            
            # Verificar senha se fornecida
            if check_password:
                if user.check_password(check_password):
                    print(f"   ✅ Senha '{check_password}' está correta")
                else:
                    print(f"   ❌ Senha '{check_password}' está incorreta")
            
            # Verificar UserProfile
            profiles = UserProfile.objects.filter(user=user)
            if profiles.exists():
                for profile in profiles:
                    print(f"   - UserProfile: ID {profile.id}, Tenant atual: {profile.current_tenant}")
            else:
                print(f"   - UserProfile: NÃO encontrado")
            
            # Verificar TenantMemberships
            memberships = TenantMembership.objects.filter(user=user)
            if memberships.exists():
                print(f"   - TenantMemberships encontrados: {memberships.count()}")
                for membership in memberships:
                    print(f"     * Tenant: {membership.tenant.name} ({membership.tenant.schema_name})")
                    print(f"       Role: {membership.role}, Ativo: {membership.is_active}")
            else:
                print(f"   - TenantMemberships: NÃO encontrado")
        found_public = True
    else:
        print(f"   ✗ Usuário NÃO encontrado no schema público")
        found_public = False
    
    # Verificar em todos os schemas de tenant
    print("\n2. Verificando em schemas de TENANT:")
    from tenants.models import Tenant
    
    tenants = Tenant.objects.all()
    found_in_tenant = False
    
    for tenant in tenants:
        with schema_context(tenant.schema_name):
            users_tenant = User.objects.filter(username=username)
            if users_tenant.exists():
                found_in_tenant = True
                print(f"   ✓ Usuário encontrado no tenant: {tenant.name} ({tenant.schema_name})")
                for user in users_tenant:
                    print(f"     - ID: {user.id}, Email: {user.email}")
                    print(f"     - Ativo: {user.is_active}")
                    # Verificar senha se fornecida
                    if check_password:
                        if user.check_password(check_password):
                            print(f"     ✅ Senha '{check_password}' está correta")
                        else:
                            print(f"     ❌ Senha '{check_password}' está incorreta")
    
    if not found_in_tenant:
        print(f"   ✗ Usuário NÃO encontrado em nenhum schema de tenant")
    
    print(f"\n{'='*60}\n")
    return found_public or found_in_tenant

if __name__ == '__main__':
    username = sys.argv[1] if len(sys.argv) > 1 else 'teste_user'
    password = sys.argv[2] if len(sys.argv) > 2 else None
    
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help']:
        print(__doc__)
        sys.exit(0)
    
    check_user(username, password)

