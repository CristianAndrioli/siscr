"""
Comando Django para criar tabelas tenants_empresa e tenants_filial nos schemas dos tenants
Uso: python manage.py create_tenant_tables
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django_tenants.utils import schema_context
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Cria as tabelas tenants_empresa e tenants_filial nos schemas dos tenants usando SQL direto'

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

    def check_table_exists(self, table_name, schema_name):
        """Verifica se uma tabela existe"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = %s AND table_name = %s
                );
            """, [schema_name, table_name])
            return cursor.fetchone()[0]

    def handle(self, *args, **options):
        self.stdout.write("🔧 Criando tabelas tenants_empresa e tenants_filial nos schemas dos tenants...")
        
        tenants = Tenant.objects.filter(is_active=True)
        self.stdout.write(f"Encontrados {tenants.count()} tenants ativos\n")
        
        created_count = 0
        skipped_count = 0
        
        for tenant in tenants:
            # Verificar se o schema existe
            if not self.check_schema_exists(tenant.schema_name):
                skipped_count += 1
                self.stdout.write(self.style.WARNING(f"⚠️  Schema '{tenant.schema_name}' não existe. Pulando..."))
                continue
            
            self.stdout.write(f"Processando tenant: {tenant.schema_name}")
            
            # Verificar se as tabelas já existem
            empresa_exists = self.check_table_exists('tenants_empresa', tenant.schema_name)
            filial_exists = self.check_table_exists('tenants_filial', tenant.schema_name)
            
            if empresa_exists and filial_exists:
                self.stdout.write(self.style.SUCCESS(f"  ✅ Tabelas já existem"))
                continue
            
            # Criar tabelas usando SQL direto
            with connection.cursor() as cursor:
                cursor.execute(f"SET search_path TO {tenant.schema_name}")
                
                try:
                    # Criar tabela tenants_empresa se não existir
                    if not empresa_exists:
                        self.stdout.write(f"  📦 Criando tabela tenants_empresa...")
                        cursor.execute("""
                            CREATE TABLE IF NOT EXISTS tenants_empresa (
                                id BIGSERIAL PRIMARY KEY,
                                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                                deleted_at TIMESTAMP NULL,
                                nome VARCHAR(255) NOT NULL,
                                razao_social VARCHAR(255) NOT NULL,
                                cnpj VARCHAR(18) NOT NULL UNIQUE,
                                endereco TEXT,
                                cidade VARCHAR(100),
                                estado VARCHAR(2),
                                cep VARCHAR(9),
                                telefone VARCHAR(15),
                                email VARCHAR(254),
                                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                                created_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                updated_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                owner_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                deleted_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                tenant_id BIGINT NOT NULL REFERENCES public.tenants_tenant(id) ON DELETE CASCADE
                            );
                        """)
                        
                        # Criar índices
                        cursor.execute("""
                            CREATE INDEX IF NOT EXISTS tenants_emp_tenant__2d84b2_idx 
                            ON tenants_empresa(tenant_id, is_active);
                        """)
                        
                        self.stdout.write(self.style.SUCCESS(f"     ✅ Tabela tenants_empresa criada"))
                    
                    # Criar tabela tenants_filial se não existir
                    if not filial_exists:
                        self.stdout.write(f"  📦 Criando tabela tenants_filial...")
                        cursor.execute("""
                            CREATE TABLE IF NOT EXISTS tenants_filial (
                                id BIGSERIAL PRIMARY KEY,
                                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                                deleted_at TIMESTAMP NULL,
                                nome VARCHAR(255) NOT NULL,
                                codigo_filial VARCHAR(20),
                                cnpj VARCHAR(18),
                                endereco TEXT,
                                cidade VARCHAR(100),
                                estado VARCHAR(2),
                                cep VARCHAR(9),
                                telefone VARCHAR(15),
                                email VARCHAR(254),
                                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                                created_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                updated_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                owner_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                deleted_by_id BIGINT NULL REFERENCES public.auth_user(id) ON DELETE SET NULL,
                                empresa_id BIGINT NOT NULL REFERENCES tenants_empresa(id) ON DELETE CASCADE
                            );
                        """)
                        
                        # Criar índices
                        cursor.execute("""
                            CREATE INDEX IF NOT EXISTS tenants_fil_empresa_004c9d_idx 
                            ON tenants_filial(empresa_id, is_active);
                        """)
                        
                        self.stdout.write(self.style.SUCCESS(f"     ✅ Tabela tenants_filial criada"))
                    
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f"  ✅ Tenant {tenant.schema_name} processado com sucesso\n"))
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ❌ Erro ao criar tabelas: {e}\n"))
                finally:
                    cursor.execute("SET search_path TO public")
        
        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"✅ {created_count} tenant(s) processado(s) com sucesso"))
        if skipped_count > 0:
            self.stdout.write(self.style.WARNING(f"⚠️  {skipped_count} tenant(s) pulado(s) porque o schema não existe"))
        self.stdout.write(f"{'='*60}")

