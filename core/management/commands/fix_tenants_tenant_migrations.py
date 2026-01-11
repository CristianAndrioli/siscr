"""
Comando Django para verificar e corrigir migrações da tabela tenants_tenant no schema público
Uso: python manage.py fix_tenants_tenant_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Verifica e corrige migrações da tabela tenants_tenant no schema público'

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando migrações da tabela tenants_tenant...")
        
        # Colunas que devem existir na tabela tenants_tenant
        required_columns = [
            'created_at',
            'updated_at',
        ]
        
        def check_column_exists(table_name, column_name):
            """Verifica se uma coluna existe em uma tabela"""
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
                """, [table_name, column_name])
                return cursor.fetchone() is not None
        
        missing_columns = []
        
        for column in required_columns:
            if not check_column_exists('tenants_tenant', column):
                missing_columns.append(column)
                self.stdout.write(self.style.ERROR(f"  ❌ Coluna {column} está faltando na tabela tenants_tenant"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  ✅ Coluna {column} existe"))
        
        if missing_columns:
            self.stdout.write("\n⚠️  Algumas colunas estão faltando. Tentando corrigir...")
            try:
                # Primeiro, tentar aplicar migrações normalmente
                self.stdout.write("  1. Aplicando migrações normalmente...")
                call_command('migrate_schemas', '--shared', verbosity=0)
                
                # Se ainda faltarem colunas, adicionar manualmente via SQL
                self.stdout.write("  2. Verificando se ainda faltam colunas...")
                still_missing = []
                for column in required_columns:
                    if not check_column_exists('tenants_tenant', column):
                        still_missing.append(column)
                
                if still_missing:
                    self.stdout.write("  3. Adicionando colunas faltantes manualmente via SQL...")
                    with connection.cursor() as cursor:
                        for col in still_missing:
                            try:
                                if col == 'created_at':
                                    cursor.execute("""
                                        ALTER TABLE tenants_tenant 
                                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE 
                                        DEFAULT CURRENT_TIMESTAMP NOT NULL
                                    """)
                                elif col == 'updated_at':
                                    cursor.execute("""
                                        ALTER TABLE tenants_tenant 
                                        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE 
                                        DEFAULT CURRENT_TIMESTAMP NOT NULL
                                    """)
                                self.stdout.write(self.style.SUCCESS(f"       ✅ Coluna {col} adicionada"))
                            except Exception as e:
                                self.stdout.write(self.style.WARNING(f"       ⚠️  Erro ao adicionar coluna {col}: {e}"))
                    
                    # Verificar novamente
                    self.stdout.write("\n🔍 Verificando novamente...")
                    all_ok = True
                    for column in required_columns:
                        if not check_column_exists('tenants_tenant', column):
                            all_ok = False
                            self.stdout.write(self.style.ERROR(f"  ❌ Coluna {column} ainda está faltando"))
                        else:
                            self.stdout.write(self.style.SUCCESS(f"  ✅ Coluna {column} existe"))
                    
                    if all_ok:
                        self.stdout.write(self.style.SUCCESS("\n✅ Todas as colunas foram adicionadas com sucesso!"))
                        return
                    else:
                        self.stdout.write(self.style.WARNING("\n⚠️  Algumas colunas ainda estão faltando."))
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
            self.stdout.write(self.style.SUCCESS("\n✅ A tabela tenants_tenant está com as colunas corretas!"))

