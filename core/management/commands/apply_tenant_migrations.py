"""
Comando Django para aplicar migrações apenas nos tenants existentes e válidos
Uso: python manage.py apply_tenant_migrations
"""
from django.core.management.base import BaseCommand
from tenants.models import Tenant
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Aplica migrações apenas nos tenants existentes e válidos'

    def handle(self, *args, **options):
        tenants = Tenant.objects.filter(is_active=True)
        applied = 0
        failed = 0
        
        self.stdout.write(f"Encontrados {tenants.count()} tenants ativos")
        
        for tenant in tenants:
            try:
                self.stdout.write(f"Aplicando migrações no tenant: {tenant.schema_name}...")
                call_command('migrate_schemas', schema_name=tenant.schema_name, verbosity=0)
                applied += 1
                self.stdout.write(self.style.SUCCESS(f"✅ Migrações aplicadas no tenant: {tenant.schema_name}"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"❌ Erro ao aplicar migrações no tenant {tenant.schema_name}: {e}"))
        
        self.stdout.write(f"\nResumo: {applied} aplicadas com sucesso, {failed} falhas")

