"""
Comando Django para corrigir migrações do guardian quando tabelas já existem
Uso: python manage.py fix_guardian_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command
from django.db.migrations.recorder import MigrationRecorder
from django_tenants.utils import schema_context
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Corrige migrações do guardian marcando como aplicadas se tabelas já existem (em todos os schemas)'

    def check_tables_exist(self, schema_name):
        """Verifica se as tabelas do guardian existem no schema especificado"""
        guardian_tables = [
            'guardian_groupobjectpermission',
            'guardian_userobjectpermission',
        ]
        
        existing_tables = []
        with connection.cursor() as cursor:
            for table in guardian_tables:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = %s 
                        AND table_name = %s
                    )
                """, [schema_name, table])
                if cursor.fetchone()[0]:
                    existing_tables.append(table)
        
        return len(existing_tables) == len(guardian_tables), existing_tables

    def check_index_exists(self, schema_name, index_name):
        """Verifica se um índice existe no schema especificado"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE schemaname = %s 
                    AND indexname = %s
                )
            """, [schema_name, index_name])
            return cursor.fetchone()[0]

    def mark_guardian_migrations_as_applied(self, schema_name):
        """Marca todas as migrações do guardian como aplicadas no schema especificado"""
        try:
            with schema_context(schema_name):
                # Verificar se as tabelas existem antes de marcar como aplicadas
                all_exist, _ = self.check_tables_exist(schema_name)
                if not all_exist:
                    # Se as tabelas não existem, não marcar como aplicadas
                    return False
                
                # Verificar se o índice problemático já existe
                # Se existir, a migração 0003 já foi aplicada (ou parcialmente)
                index_exists = self.check_index_exists(schema_name, 'guardian_gr_permiss_83545c_idx')
                
                # Método 1: Usar --fake para marcar todas as migrações pendentes como aplicadas
                call_command('migrate', 'guardian', '--fake', verbosity=0)
                return True
        except Exception as e:
            try:
                # Método 2: Marcar migrações individualmente usando MigrationRecorder
                with schema_context(schema_name):
                    # Verificar se as tabelas existem antes de marcar como aplicadas
                    all_exist, _ = self.check_tables_exist(schema_name)
                    if not all_exist:
                        return False
                    
                    recorder = MigrationRecorder(connection)
                    applied = recorder.applied_migrations()
                    
                    # Lista de todas as migrações do guardian conhecidas
                    guardian_migrations = [
                        ('guardian', '0001_initial'),
                        ('guardian', '0002_generic_permissions_index'),
                        ('guardian', '0003_remove_groupobjectpermission_guardian_gr_content_ae6aec_idx_and_more'),
                    ]
                    
                    fake_count = 0
                    for migration_key in guardian_migrations:
                        if migration_key not in applied:
                            recorder.record_applied(*migration_key)
                            fake_count += 1
                    
                    return fake_count >= 0  # Retorna True mesmo se não houver migrações para marcar
            except Exception as e2:
                return False

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando migrações do guardian em todos os schemas...")
        
        # Processar schema público
        self.stdout.write("\n📋 Processando schema público...")
        all_exist, existing_tables = self.check_tables_exist('public')
        
        if all_exist:
            self.stdout.write("  ✅ Todas as tabelas do guardian existem no schema público")
            self.stdout.write("     Marcando migrações como aplicadas...")
            if self.mark_guardian_migrations_as_applied('public'):
                self.stdout.write(self.style.SUCCESS("  ✅ Migrações do guardian marcadas como aplicadas no schema público!"))
            else:
                self.stdout.write(self.style.WARNING("  ⚠️  Não foi possível marcar todas as migrações (pode ser normal)"))
        else:
            self.stdout.write(self.style.WARNING("  ⚠️  Nem todas as tabelas do guardian existem no schema público"))
        
        # Processar schemas de tenant
        try:
            with schema_context('public'):
                tenants = Tenant.objects.filter(is_active=True)
                tenant_count = tenants.count()
                
                if tenant_count > 0:
                    self.stdout.write(f"\n📋 Processando {tenant_count} schema(s) de tenant...")
                    fixed_count = 0
                    skipped_count = 0
                    
                    for tenant in tenants:
                        self.stdout.write(f"  Processando tenant: {tenant.schema_name}...")
                        all_exist, existing_tables = self.check_tables_exist(tenant.schema_name)
                        
                        if all_exist:
                            if self.mark_guardian_migrations_as_applied(tenant.schema_name):
                                self.stdout.write(self.style.SUCCESS(f"    ✅ Migrações marcadas como aplicadas"))
                                fixed_count += 1
                            else:
                                self.stdout.write(self.style.WARNING(f"    ⚠️  Não foi possível marcar todas as migrações"))
                                skipped_count += 1
                        else:
                            self.stdout.write(self.style.WARNING(f"    ⚠️  Nem todas as tabelas existem (pulando)"))
                            skipped_count += 1
                    
                    self.stdout.write(f"\n📊 Resumo: {fixed_count} tenant(s) corrigido(s), {skipped_count} pulado(s)")
                else:
                    self.stdout.write("\n📋 Nenhum tenant ativo encontrado")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"\n⚠️  Erro ao processar tenants: {e}"))
        
        self.stdout.write(self.style.SUCCESS("\n✅ Verificação de migrações do guardian concluída!"))
