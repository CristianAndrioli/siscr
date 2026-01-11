"""
Comando Django para verificar e corrigir migrações nos schemas dos tenants
Uso: python manage.py fix_tenant_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django_tenants.utils import schema_context
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Verifica e corrige migrações nos schemas dos tenants'

    def check_schema_exists(self, schema_name):
        """Verifica se o schema existe no PostgreSQL"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.schemata
                    WHERE schema_name = %s
                );
            """, [schema_name])
            return cursor.fetchone()[0]

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando migrações nos schemas dos tenants...")
        
        tenants = Tenant.objects.filter(is_active=True)
        self.stdout.write(f"Encontrados {tenants.count()} tenants ativos\n")
        
        # Tabelas que devem ter colunas do SiscrModelBase
        tables_to_check = {
            'tenants_empresa': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
            'tenants_filial': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
            'estoque_location': ['created_at', 'updated_at', 'created_by_id', 'updated_by_id', 'owner_id', 'is_deleted', 'deleted_at', 'deleted_by_id'],
        }
        
        def check_table_exists(table_name, schema_name='public'):
            """Verifica se uma tabela existe"""
            with connection.cursor() as cursor:
                if schema_name != 'public':
                    cursor.execute(f"SET search_path TO {schema_name}")
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = %s AND table_name = %s
                """, [schema_name, table_name])
                result = cursor.fetchone()
                if schema_name != 'public':
                    cursor.execute("SET search_path TO public")
                return result is not None
        
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
                        self.stdout.write(self.style.WARNING(f"       ⚠️  Erro ao adicionar coluna {col}: {e}"))
                
                if schema_name != 'public':
                    cursor.execute("SET search_path TO public")
        
        all_ok = True
        skipped = 0
        
        for tenant in tenants:
            # Verificar se o schema existe antes de tentar processar
            if not self.check_schema_exists(tenant.schema_name):
                skipped += 1
                self.stdout.write(self.style.WARNING(f"⚠️  Schema '{tenant.schema_name}' não existe. Pulando tenant '{tenant.name}'..."))
                self.stdout.write("")
                continue
            
            self.stdout.write(f"Processando tenant: {tenant.schema_name}")
            with schema_context(tenant.schema_name):
                tenant_ok = True
                for table, required_cols in tables_to_check.items():
                    # Primeiro verificar se a tabela existe
                    if not check_table_exists(table, tenant.schema_name):
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Tabela {table} não existe. Tentando criar..."))
                        from django.core.management import call_command
                        try:
                            # Primeiro tentar aplicar migrações
                            call_command('migrate_schemas', schema_name=tenant.schema_name, verbosity=0)
                            # Se ainda não existir, tentar criar manualmente
                            if not check_table_exists(table, tenant.schema_name):
                                self.stdout.write(self.style.WARNING(f"     Migrações não criaram a tabela. Tentando criar manualmente..."))
                                call_command('create_tenant_tables', verbosity=0)
                                # Verificar novamente
                                if not check_table_exists(table, tenant.schema_name):
                                    self.stdout.write(self.style.ERROR(f"  ❌ Tabela {table} ainda não existe após tentativas"))
                                    tenant_ok = False
                                    all_ok = False
                                    continue
                                else:
                                    self.stdout.write(self.style.SUCCESS(f"     ✅ Tabela {table} criada manualmente"))
                            else:
                                self.stdout.write(self.style.SUCCESS(f"     ✅ Migrações aplicadas"))
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(f"  ❌ Erro ao criar tabela: {e}"))
                            tenant_ok = False
                            all_ok = False
                            continue
                    
                    # Se a tabela existe, verificar colunas
                    missing = []
                    for col in required_cols:
                        if not check_column_exists(table, col, tenant.schema_name):
                            missing.append(col)
                    
                    if missing:
                        tenant_ok = False
                        all_ok = False
                        self.stdout.write(self.style.ERROR(f"  ❌ Tabela {table} está faltando colunas: {', '.join(missing)}"))
                        self.stdout.write(f"     Adicionando colunas faltantes...")
                        add_missing_columns(table, missing, tenant.schema_name)
                        self.stdout.write(self.style.SUCCESS(f"     ✅ Colunas adicionadas"))
                    else:
                        self.stdout.write(self.style.SUCCESS(f"  ✅ Tabela {table} está OK"))
            
            if tenant_ok:
                self.stdout.write(self.style.SUCCESS(f"  ✅ Tenant {tenant.schema_name} está OK\n"))
            else:
                self.stdout.write(self.style.WARNING(f"  ⚠️  Tenant {tenant.schema_name} teve correções aplicadas\n"))
        
        if skipped > 0:
            self.stdout.write(self.style.WARNING(f"⚠️  {skipped} tenant(s) pulado(s) porque o schema não existe."))
        
        if all_ok:
            self.stdout.write(self.style.SUCCESS("✅ Todos os tenants processados estão com as colunas corretas!"))
        else:
            self.stdout.write(self.style.WARNING("⚠️  Alguns tenants tiveram correções aplicadas."))

