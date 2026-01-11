"""
Comando Django para aplicar migrações apenas nos tenants existentes e válidos
Uso: python manage.py apply_tenant_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from tenants.models import Tenant
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Aplica migrações apenas nos tenants existentes e válidos'

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
        tenants = Tenant.objects.filter(is_active=True)
        applied = 0
        failed = 0
        skipped = 0
        
        self.stdout.write(f"Encontrados {tenants.count()} tenants ativos")
        
        for tenant in tenants:
            # Verificar se o schema existe antes de tentar aplicar migrações
            if not self.check_schema_exists(tenant.schema_name):
                skipped += 1
                self.stdout.write(self.style.WARNING(f"⚠️  Schema '{tenant.schema_name}' não existe. Pulando tenant '{tenant.name}'..."))
                continue
            
            try:
                self.stdout.write(f"Aplicando migrações no tenant: {tenant.schema_name}...")
                call_command('migrate_schemas', schema_name=tenant.schema_name, verbosity=0)
                applied += 1
                self.stdout.write(self.style.SUCCESS(f"✅ Migrações aplicadas no tenant: {tenant.schema_name}"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"❌ Erro ao aplicar migrações no tenant {tenant.schema_name}: {e}"))
        
        self.stdout.write(f"\nResumo: {applied} aplicadas com sucesso, {failed} falhas, {skipped} pulados (schema não existe)")

