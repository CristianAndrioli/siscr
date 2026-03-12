"""
Comando Django para corrigir foreign keys de tenants_empresa para apontar para public.tenants_tenant
Uso: python manage.py fix_tenant_foreign_keys
"""
from django.core.management.base import BaseCommand
from django.db import connection
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Corrige foreign keys de tenants_empresa para apontar para public.tenants_tenant'

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
        self.stdout.write("🔧 Corrigindo foreign keys de tenants_empresa...")
        
        tenants = Tenant.objects.filter(is_active=True)
        self.stdout.write(f"Encontrados {tenants.count()} tenants ativos\n")
        
        fixed = 0
        skipped = 0
        
        for tenant in tenants:
            schema_name = tenant.schema_name
            
            # Verificar se o schema existe
            if not self.check_schema_exists(schema_name):
                skipped += 1
                self.stdout.write(self.style.WARNING(f"⚠️  Schema '{schema_name}' não existe. Pulando tenant '{tenant.name}'..."))
                continue
            
            # Verificar se a tabela tenants_empresa existe
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = %s AND table_name = 'tenants_empresa'
                    );
                """, [schema_name])
                table_exists = cursor.fetchone()[0]
                
                if not table_exists:
                    self.stdout.write(self.style.WARNING(f"⚠️  Tabela tenants_empresa não existe no schema '{schema_name}'. Pulando..."))
                    skipped += 1
                    continue
            
            # Corrigir a foreign key
            try:
                with connection.cursor() as cursor:
                    # Primeiro, verificar qual é a constraint atual
                    cursor.execute("""
                        SELECT conname, pg_get_constraintdef(oid) as definition
                        FROM pg_constraint 
                        WHERE conrelid = %s::regclass 
                        AND conname = 'tenants_empresa_tenant_id_80759698_fk_tenants_tenant_id';
                    """, [f"{schema_name}.tenants_empresa"])
                    current_constraint = cursor.fetchone()
                    
                    if current_constraint:
                        definition = current_constraint[1]
                        # Verificar se já aponta para public.tenants_tenant
                        if 'public.tenants_tenant' in definition:
                            self.stdout.write(self.style.SUCCESS(f"✅ Foreign key já está correta para tenant '{tenant.name}' ({schema_name})"))
                            fixed += 1
                            continue
                    
                    # Dropar constraint antiga se existir
                    # IMPORTANTE: Usar SET search_path para garantir que estamos no contexto correto
                    cursor.execute("SET search_path TO public, pg_catalog;")
                    cursor.execute(f"""
                        ALTER TABLE "{schema_name}".tenants_empresa 
                        DROP CONSTRAINT IF EXISTS tenants_empresa_tenant_id_80759698_fk_tenants_tenant_id;
                    """)
                    
                    # Criar constraint nova apontando explicitamente para public.tenants_tenant
                    # Usar formato completo com schema explícito
                    cursor.execute(f"""
                        ALTER TABLE "{schema_name}".tenants_empresa 
                        ADD CONSTRAINT tenants_empresa_tenant_id_80759698_fk_tenants_tenant_id 
                        FOREIGN KEY (tenant_id) 
                        REFERENCES public.tenants_tenant(id) 
                        ON DELETE CASCADE;
                    """)
                    cursor.execute("RESET search_path;")
                    
                    # Verificar se foi criada corretamente
                    cursor.execute("""
                        SELECT pg_get_constraintdef(oid) as definition
                        FROM pg_constraint 
                        WHERE conrelid = %s::regclass 
                        AND conname = 'tenants_empresa_tenant_id_80759698_fk_tenants_tenant_id';
                    """, [f"{schema_name}.tenants_empresa"])
                    new_constraint = cursor.fetchone()
                    
                    if new_constraint and 'public.tenants_tenant' in new_constraint[0]:
                        self.stdout.write(self.style.SUCCESS(f"✅ Foreign key corrigida para tenant '{tenant.name}' ({schema_name})"))
                        fixed += 1
                    else:
                        self.stdout.write(self.style.WARNING(f"⚠️  Foreign key criada mas pode não estar correta para tenant '{tenant.name}' ({schema_name})"))
                        if new_constraint:
                            self.stdout.write(self.style.WARNING(f"   Definição: {new_constraint[0]}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Erro ao corrigir foreign key para tenant '{tenant.name}': {e}"))
                import traceback
                self.stdout.write(self.style.ERROR(traceback.format_exc()))
        
        self.stdout.write("")
        if skipped > 0:
            self.stdout.write(self.style.WARNING(f"⚠️  {skipped} tenant(s) pulado(s)."))
        
        if fixed > 0:
            self.stdout.write(self.style.SUCCESS(f"✅ {fixed} foreign key(s) corrigida(s) com sucesso!"))
        else:
            self.stdout.write(self.style.WARNING("⚠️  Nenhuma foreign key foi corrigida."))
