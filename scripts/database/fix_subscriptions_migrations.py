"""
Script para verificar e corrigir migrações do app subscriptions
Verifica se as colunas do SiscrModelBase existem e aplica migrações se necessário
Uso: docker-compose exec web python scripts/database/fix_subscriptions_migrations.py
"""
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.db import connection
from django.core.management import call_command

def check_column_exists(table_name, column_name):
    """Verifica se uma coluna existe em uma tabela"""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        """, [table_name, column_name])
        return cursor.fetchone() is not None

def fix_subscriptions_migrations():
    """Verifica e corrige migrações do subscriptions"""
    print("🔍 Verificando migrações do app subscriptions...")
    
    # Tabelas do subscriptions que devem ter colunas do SiscrModelBase
    tables_to_check = [
        'subscriptions_plan',
        'subscriptions_feature',
        'subscriptions_subscription',
        'subscriptions_quotausage',
    ]
    
    # Colunas obrigatórias do SiscrModelBase
    required_columns = [
        'created_at',
        'updated_at',
        'created_by_id',
        'updated_by_id',
        'owner_id',
        'is_deleted',
        'deleted_at',
        'deleted_by_id',
    ]
    
    missing_columns = {}
    
    for table in tables_to_check:
        missing = []
        for column in required_columns:
            if not check_column_exists(table, column):
                missing.append(column)
        
        if missing:
            missing_columns[table] = missing
            print(f"  ❌ Tabela {table} está faltando colunas: {', '.join(missing)}")
        else:
            print(f"  ✅ Tabela {table} está OK")
    
    if missing_columns:
        print("\n⚠️  Algumas colunas estão faltando. Tentando corrigir...")
        try:
            # Primeiro, tentar aplicar migrações normalmente
            print("  1. Aplicando migrações normalmente...")
            call_command('migrate_schemas', '--shared', verbosity=0)
            
            # Se ainda faltarem colunas, adicionar manualmente via SQL
            print("  2. Verificando se ainda faltam colunas...")
            still_missing = {}
            for table in tables_to_check:
                missing = []
                for column in required_columns:
                    if not check_column_exists(table, column):
                        missing.append(column)
                if missing:
                    still_missing[table] = missing
            
            if still_missing:
                print("  3. Adicionando colunas faltantes manualmente via SQL...")
                with connection.cursor() as cursor:
                    for table, missing_cols in still_missing.items():
                        print(f"     Adicionando colunas na tabela {table}...")
                        for col in missing_cols:
                            try:
                                if col == 'created_at':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
                                elif col == 'updated_at':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP')
                                elif col == 'is_deleted':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE')
                                elif col == 'deleted_at':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL')
                                elif col == 'created_by_id':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                                elif col == 'updated_by_id':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS updated_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                                elif col == 'owner_id':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS owner_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                                elif col == 'deleted_by_id':
                                    cursor.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_by_id BIGINT NULL REFERENCES auth_user(id) ON DELETE SET NULL')
                                print(f"       ✅ Coluna {col} adicionada")
                            except Exception as e:
                                print(f"       ⚠️  Erro ao adicionar coluna {col}: {e}")
                
                # Verificar novamente
                print("\n🔍 Verificando novamente...")
                all_ok = True
                for table in tables_to_check:
                    missing = []
                    for column in required_columns:
                        if not check_column_exists(table, column):
                            missing.append(column)
                    
                    if missing:
                        all_ok = False
                        print(f"  ❌ Tabela {table} ainda está faltando colunas: {', '.join(missing)}")
                    else:
                        print(f"  ✅ Tabela {table} está OK")
                
                if all_ok:
                    print("\n✅ Todas as colunas foram adicionadas com sucesso!")
                    return True
                else:
                    print("\n⚠️  Algumas colunas ainda estão faltando.")
                    print("   Pode ser necessário recriar as tabelas ou aplicar migrações manualmente.")
                    return False
            else:
                print("\n✅ Todas as migrações foram aplicadas com sucesso!")
                return True
        except Exception as e:
            print(f"\n❌ Erro ao aplicar migrações: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print("\n✅ Todas as tabelas estão com as colunas corretas!")
        return True

if __name__ == '__main__':
    success = fix_subscriptions_migrations()
    sys.exit(0 if success else 1)

