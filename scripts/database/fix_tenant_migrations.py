"""
Script para verificar e corrigir migrações nos schemas dos tenants
Adiciona colunas do SiscrModelBase se estiverem faltando
Uso: docker-compose exec web python -c "import sys; sys.path.insert(0, '/app'); exec(open('/app/scripts/database/fix_tenant_migrations.py').read())"
"""
import os
import sys

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.db import connection
from django_tenants.utils import schema_context
from tenants.models import Tenant

def check_column_exists(table_name, column_name, schema_name='public'):
    """Verifica se uma coluna existe em uma tabela"""
    with connection.cursor() as cursor:
        if schema_name != 'public':
            cursor.execute(f"SET search_path TO {schema_name}")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = %s AND table_name = %s AND column_name = %s
        """, [schema_name, table_name, column_name])
        result = cursor.fetchone()
        if schema_name != 'public':
            cursor.execute("SET search_path TO public")
        return result is not None

def add_missing_columns(table_name, missing_cols, schema_name='public'):
    """Adiciona colunas faltantes em uma tabela"""
    with connection.cursor() as cursor:
        if schema_name != 'public':
            cursor.execute(f"SET search_path TO {schema_name}")
        
        for col in missing_cols:
            try:
                if col == 'created_at':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
                elif col == 'updated_at':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
                elif col == 'is_deleted':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE')
                elif col == 'deleted_at':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL')
                elif col == 'created_by_id':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS created_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                elif col == 'updated_by_id':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS updated_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                elif col == 'owner_id':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS owner_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                elif col == 'deleted_by_id':
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS deleted_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
            except Exception as e:
                print(f"       ⚠️  Erro ao adicionar coluna {col}: {e}")
        
        if schema_name != 'public':
            cursor.execute("SET search_path TO public")

def fix_tenant_migrations():
    """Verifica e corrige migrações nos tenants"""
    print("🔍 Verificando migrações nos schemas dos tenants...")
    
    tenants = Tenant.objects.filter(is_active=True)
    print(f"Encontrados {tenants.count()} tenants ativos\n")
    
    # Tabelas que devem ter colunas do SiscrModelBase
    tables_to_check = {
        'tenants_empresa': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
        'tenants_filial': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
        'estoque_location': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
    }
    
    all_ok = True
    
    for tenant in tenants:
        print(f"Processando tenant: {tenant.schema_name}")
        with schema_context(tenant.schema_name):
            tenant_ok = True
            for table, required_cols in tables_to_check.items():
                missing = []
                for col in required_cols:
                    if not check_column_exists(table, col, tenant.schema_name):
                        missing.append(col)
                
                if missing:
                    tenant_ok = False
                    all_ok = False
                    print(f"  ❌ Tabela {table} está faltando colunas: {', '.join(missing)}")
                    print(f"     Adicionando colunas faltantes...")
                    add_missing_columns(table, missing, tenant.schema_name)
                    print(f"     ✅ Colunas adicionadas")
                else:
                    print(f"  ✅ Tabela {table} está OK")
            
            if tenant_ok:
                print(f"  ✅ Tenant {tenant.schema_name} está OK\n")
            else:
                print(f"  ⚠️  Tenant {tenant.schema_name} teve correções aplicadas\n")
    
    if all_ok:
        print("✅ Todos os tenants estão com as colunas corretas!")
        return True
    else:
        print("⚠️  Alguns tenants tiveram correções aplicadas.")
        return True  # Retorna True mesmo assim, pois as correções foram aplicadas

if __name__ == '__main__':
    success = fix_tenant_migrations()
    sys.exit(0 if success else 1)

