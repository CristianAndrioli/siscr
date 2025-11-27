"""
Comando Django para remover tenants de teste indesejados
Uso: python manage.py remove_test_tenants
"""
from django.core.management.base import BaseCommand
from django.db import connection
from tenants.models import Tenant, Domain
from django_tenants.utils import schema_context


class Command(BaseCommand):
    help = 'Remove tenants de teste indesejados (minha_empresa_teste2, minha_empresa_teste, teste_tenant)'

    def handle(self, *args, **options):
        # Lista de tenants a serem removidos
        tenants_to_remove = [
            'minha_empresa_teste2',
            'minha_empresa_teste',
            'teste_tenant'
        ]
        
        self.stdout.write("🗑️  Removendo tenants de teste indesejados...")
        self.stdout.write("")
        
        removed_count = 0
        not_found_count = 0
        
        for schema_name in tenants_to_remove:
            try:
                tenant = Tenant.objects.get(schema_name=schema_name)
                
                self.stdout.write(f"  Removendo tenant: {tenant.name} ({schema_name})...")
                
                # Remover domínios associados primeiro
                domains = Domain.objects.filter(tenant=tenant)
                domain_count = domains.count()
                domains.delete()
                if domain_count > 0:
                    self.stdout.write(f"    ✅ {domain_count} domínio(s) removido(s)")
                
                # Remover o schema do banco de dados ANTES de remover o tenant
                # O django-tenants não remove automaticamente quando auto_drop_schema=False
                # Então vamos remover manualmente
                schema_removed = False
                with connection.cursor() as cursor:
                    try:
                        # Verificar se o schema existe
                        cursor.execute(
                            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                            [schema_name]
                        )
                        if cursor.fetchone():
                            # Remover o schema (CASCADE remove todas as tabelas)
                            cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                            self.stdout.write(f"    ✅ Schema '{schema_name}' removido do banco de dados")
                            schema_removed = True
                        else:
                            self.stdout.write(f"    ⚠️  Schema '{schema_name}' não encontrado no banco")
                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(f"    ⚠️  Erro ao remover schema: {str(e)}")
                        )
                
                # Remover o tenant (deve ser feito por último, após remover o schema)
                tenant.delete()
                
                self.stdout.write(
                    self.style.SUCCESS(f"    ✅ Tenant '{schema_name}' removido com sucesso!")
                )
                removed_count += 1
                
            except Tenant.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f"  ⚠️  Tenant '{schema_name}' não encontrado (já foi removido ou nunca existiu)")
                )
                not_found_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  ❌ Erro ao remover tenant '{schema_name}': {str(e)}")
                )
        
        self.stdout.write("")
        self.stdout.write("=" * 60)
        if removed_count > 0:
            self.stdout.write(
                self.style.SUCCESS(f"✅ {removed_count} tenant(s) removido(s) com sucesso!")
            )
        if not_found_count > 0:
            self.stdout.write(
                self.style.WARNING(f"⚠️  {not_found_count} tenant(s) não encontrado(s)")
            )
        if removed_count == 0 and not_found_count == len(tenants_to_remove):
            self.stdout.write(
                self.style.SUCCESS("✅ Nenhum tenant de teste encontrado. Tudo limpo!")
            )
        self.stdout.write("=" * 60)

