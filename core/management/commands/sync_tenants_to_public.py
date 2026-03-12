"""
Comando Django para sincronizar tenants dos schemas para a tabela tenants_tenant do schema público
Uso: python manage.py sync_tenants_to_public
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django_tenants.utils import schema_context
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Sincroniza tenants dos schemas para a tabela tenants_tenant do schema público'

    def handle(self, *args, **options):
        self.stdout.write("🔄 Sincronizando tenants dos schemas para a tabela tenants_tenant...")
        
        # Buscar todos os schemas que não são do sistema
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'public')
                AND schema_name NOT LIKE 'pg_%'
                ORDER BY schema_name
            """)
            schema_names = [row[0] for row in cursor.fetchall()]
        
        if not schema_names:
            self.stdout.write(self.style.WARNING("  ⚠️  Nenhum schema de tenant encontrado."))
            return
        
        self.stdout.write(f"  📋 Encontrados {len(schema_names)} schema(s) de tenant(s)")
        
        # Para cada schema, verificar se existe um tenant na tabela tenants_tenant
        with schema_context('public'):
            tenants_synced = 0
            tenants_created = 0
            tenants_updated = 0
            
            for schema_name in schema_names:
                try:
                    # Verificar se o tenant já existe na tabela tenants_tenant
                    tenant = Tenant.objects.filter(schema_name=schema_name).first()
                    
                    if tenant:
                        # Tenant já existe, verificar se precisa atualizar
                        self.stdout.write(f"  ℹ️  Tenant {schema_name} já existe na tabela tenants_tenant")
                        tenants_synced += 1
                    else:
                        # Tenant não existe, criar
                        # Buscar informações do schema se possível
                        try:
                            with schema_context(schema_name):
                                # Tentar buscar informações do tenant do schema
                                # Como não temos acesso direto, vamos criar com nome baseado no schema_name
                                tenant_name = schema_name.replace('_', ' ').title()
                                
                                tenant = Tenant.objects.create(
                                    schema_name=schema_name,
                                    name=tenant_name,
                                    description=f'Tenant sincronizado do schema {schema_name}',
                                    is_active=True,
                                )
                                tenants_created += 1
                                self.stdout.write(self.style.SUCCESS(f"  ✅ Tenant {schema_name} criado na tabela tenants_tenant"))
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao criar tenant {schema_name}: {e}"))
                            continue
                
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao processar tenant {schema_name}: {e}"))
                    continue
            
            self.stdout.write(f"\n📊 Resumo:")
            self.stdout.write(f"  ✅ {tenants_synced} tenant(s) já existiam")
            self.stdout.write(f"  ✅ {tenants_created} tenant(s) criado(s)")
            self.stdout.write(self.style.SUCCESS(f"\n✅ Sincronização concluída!"))

