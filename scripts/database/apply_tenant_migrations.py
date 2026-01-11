"""
Script para aplicar migrações apenas nos tenants existentes e válidos
Uso: python manage.py shell < scripts/database/apply_tenant_migrations.py
Ou: docker-compose exec web python scripts/database/apply_tenant_migrations.py
"""
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from tenants.models import Tenant
from django.core.management import call_command
from django.db import connection

def apply_migrations_to_tenants():
    """Aplica migrações apenas nos tenants existentes e válidos"""
    tenants = Tenant.objects.filter(is_active=True)
    applied = 0
    failed = 0
    
    print(f"Encontrados {tenants.count()} tenants ativos")
    
    for tenant in tenants:
        try:
            print(f"Aplicando migrações no tenant: {tenant.schema_name}...")
            call_command('migrate_schemas', schema_name=tenant.schema_name, verbosity=0)
            applied += 1
            print(f"✅ Migrações aplicadas no tenant: {tenant.schema_name}")
        except Exception as e:
            failed += 1
            print(f"❌ Erro ao aplicar migrações no tenant {tenant.schema_name}: {e}")
    
    print(f"\nResumo: {applied} aplicadas com sucesso, {failed} falhas")
    return applied, failed

if __name__ == '__main__':
    apply_migrations_to_tenants()
    sys.exit(0)

