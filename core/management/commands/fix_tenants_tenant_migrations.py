"""
Comando Django para verificar e corrigir migrações da tabela tenants_tenant no schema público
e em todos os schemas de tenant (evita erro "column created_at does not exist" quando search_path usa schema do tenant).
Uso: python manage.py fix_tenants_tenant_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Verifica e corrige migrações da tabela tenants_tenant no schema público e nos schemas de tenant'

    REQUIRED_COLUMNS = [
        ('created_at', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL'),
        ('updated_at', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL'),
        ('last_backup_at', 'TIMESTAMP WITH TIME ZONE NULL'),
    ]

    def get_schemas_with_tenants_tenant(self, cursor):
        """Retorna todos os schemas que possuem a tabela tenants_tenant."""
        cursor.execute("""
            SELECT DISTINCT table_schema
            FROM information_schema.tables
            WHERE table_name = 'tenants_tenant'
            AND table_schema NOT IN ('pg_catalog', 'information_schema')
        """)
        return [row[0] for row in cursor.fetchall()]

    def check_column_exists(self, cursor, schema, table_name, column_name):
        """Verifica se uma coluna existe em uma tabela no schema dado."""
        cursor.execute("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s AND column_name = %s
        """, [schema, table_name, column_name])
        return cursor.fetchone() is not None

    def add_column_if_missing(self, cursor, schema, table_name, col_spec):
        """Adiciona coluna se não existir. col_spec é (nome, definição_sql) ou só nome (usa definição padrão)."""
        if isinstance(col_spec, (list, tuple)):
            column_name, definition = col_spec[0], col_spec[1]
        else:
            column_name = col_spec
            definition = 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL'
        if self.check_column_exists(cursor, schema, table_name, column_name):
            return True
        quoted_schema = f'"{schema}"'
        quoted_table = f'"{table_name}"'
        cursor.execute(f"""
            ALTER TABLE {quoted_schema}.{quoted_table}
            ADD COLUMN {column_name} {definition}
        """)
        return True

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando migrações da tabela tenants_tenant...")

        with connection.cursor() as cursor:
            schemas = self.get_schemas_with_tenants_tenant(cursor)
            if not schemas:
                self.stdout.write(self.style.WARNING("  Nenhuma tabela tenants_tenant encontrada."))
                return

            for schema in schemas:
                self.stdout.write(f"\n  Schema: {schema}")
                missing = []
                for col_spec in self.REQUIRED_COLUMNS:
                    col = col_spec[0] if isinstance(col_spec, (list, tuple)) else col_spec
                    if self.check_column_exists(cursor, schema, 'tenants_tenant', col):
                        self.stdout.write(self.style.SUCCESS(f"    ✅ Coluna {col} existe"))
                    else:
                        missing.append(col_spec)
                        self.stdout.write(self.style.ERROR(f"    ❌ Coluna {col} está faltando"))

                if missing:
                    self.stdout.write(f"    Adicionando colunas faltantes em {schema}...")
                    try:
                        for col_spec in missing:
                            col = col_spec[0] if isinstance(col_spec, (list, tuple)) else col_spec
                            self.add_column_if_missing(cursor, schema, 'tenants_tenant', col_spec)
                            self.stdout.write(self.style.SUCCESS(f"    ✅ Coluna {col} adicionada"))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"    ❌ Erro: {e}"))

        try:
            call_command('migrate_schemas', '--shared', verbosity=0)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  Aviso ao rodar migrate_schemas --shared: {e}"))

        with connection.cursor() as cursor:
            all_ok = True
            for schema in self.get_schemas_with_tenants_tenant(cursor):
                for col_spec in self.REQUIRED_COLUMNS:
                    col = col_spec[0] if isinstance(col_spec, (list, tuple)) else col_spec
                    if not self.check_column_exists(cursor, schema, 'tenants_tenant', col):
                        all_ok = False
                        self.stdout.write(self.style.ERROR(f"  ❌ {schema}.tenants_tenant ainda sem {col}"))

        if all_ok:
            self.stdout.write(self.style.SUCCESS("\n✅ A tabela tenants_tenant está com as colunas corretas em todos os schemas!"))
        else:
            self.stdout.write(self.style.WARNING("\n⚠️  Revise os erros acima e execute novamente se necessário."))

