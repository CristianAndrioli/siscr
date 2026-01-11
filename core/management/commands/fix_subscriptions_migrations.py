"""
Comando Django para verificar e corrigir migrações do app subscriptions
Uso: python manage.py fix_subscriptions_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Verifica e corrige migrações do app subscriptions'

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando migrações do app subscriptions...")
        
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
        
        def check_column_exists(table_name, column_name):
            """Verifica se uma coluna existe em uma tabela"""
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = %s AND column_name = %s
                """, [table_name, column_name])
                return cursor.fetchone() is not None
        
        missing_columns = {}
        
        for table in tables_to_check:
            missing = []
            for column in required_columns:
                if not check_column_exists(table, column):
                    missing.append(column)
            
            if missing:
                missing_columns[table] = missing
                self.stdout.write(self.style.ERROR(f"  ❌ Tabela {table} está faltando colunas: {', '.join(missing)}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  ✅ Tabela {table} está OK"))
        
        if missing_columns:
            self.stdout.write("\n⚠️  Algumas colunas estão faltando. Tentando corrigir...")
            try:
                # Primeiro, tentar aplicar migrações normalmente
                self.stdout.write("  1. Aplicando migrações normalmente...")
                call_command('migrate_schemas', '--shared', verbosity=0)
                
                # Se ainda faltarem colunas, adicionar manualmente via SQL
                self.stdout.write("  2. Verificando se ainda faltam colunas...")
                still_missing = {}
                for table in tables_to_check:
                    missing = []
                    for column in required_columns:
                        if not check_column_exists(table, column):
                            missing.append(column)
                    if missing:
                        still_missing[table] = missing
                
                if still_missing:
                    self.stdout.write("  3. Adicionando colunas faltantes manualmente via SQL...")
                    with connection.cursor() as cursor:
                        for table, missing_cols in still_missing.items():
                            self.stdout.write(f"     Adicionando colunas na tabela {table}...")
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
                                    self.stdout.write(self.style.SUCCESS(f"       ✅ Coluna {col} adicionada"))
                                except Exception as e:
                                    self.stdout.write(self.style.WARNING(f"       ⚠️  Erro ao adicionar coluna {col}: {e}"))
                    
                    # Verificar novamente
                    self.stdout.write("\n🔍 Verificando novamente...")
                    all_ok = True
                    for table in tables_to_check:
                        missing = []
                        for column in required_columns:
                            if not check_column_exists(table, column):
                                missing.append(column)
                        
                        if missing:
                            all_ok = False
                            self.stdout.write(self.style.ERROR(f"  ❌ Tabela {table} ainda está faltando colunas: {', '.join(missing)}"))
                        else:
                            self.stdout.write(self.style.SUCCESS(f"  ✅ Tabela {table} está OK"))
                    
                    if all_ok:
                        self.stdout.write(self.style.SUCCESS("\n✅ Todas as colunas foram adicionadas com sucesso!"))
                        return
                    else:
                        self.stdout.write(self.style.WARNING("\n⚠️  Algumas colunas ainda estão faltando."))
                        self.stdout.write("   Pode ser necessário recriar as tabelas ou aplicar migrações manualmente.")
                        return
                else:
                    self.stdout.write(self.style.SUCCESS("\n✅ Todas as migrações foram aplicadas com sucesso!"))
                    return
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"\n❌ Erro ao aplicar migrações: {e}"))
                import traceback
                traceback.print_exc()
                return
        else:
            self.stdout.write(self.style.SUCCESS("\n✅ Todas as tabelas estão com as colunas corretas!"))

