"""
Comando Django para fazer backup de um tenant
Uso: python manage.py backup_tenant <schema_name> [--output-dir]
"""
import os
import subprocess
import tempfile
import zipfile
from datetime import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection
from tenants.models import Tenant


class Command(BaseCommand):
    help = 'Faz backup completo de um tenant (schema + dados públicos relacionados)'

    def add_arguments(self, parser):
        parser.add_argument(
            'schema_name',
            type=str,
            help='Nome do schema do tenant a ser feito backup'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            default=None,
            help='Diretório onde salvar o backup (padrão: diretório temporário)'
        )

    def handle(self, *args, **options):
        schema_name = options['schema_name']
        output_dir = options.get('output_dir') or tempfile.gettempdir()
        
        try:
            tenant = Tenant.objects.get(schema_name=schema_name)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Tenant com schema "{schema_name}" não encontrado!'))
            return
        
        self.stdout.write(f'📦 Iniciando backup do tenant: {tenant.name} ({schema_name})...')
        
        # Criar nome do arquivo de backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'backup_{schema_name}_{timestamp}.zip'
        backup_path = os.path.join(output_dir, backup_filename)
        
        try:
            # Obter configurações do banco de dados
            db_config = settings.DATABASES['default']
            db_name = db_config['NAME']
            db_user = db_config['USER']
            db_password = db_config.get('PASSWORD', '')
            db_host = db_config.get('HOST', 'localhost')
            db_port = db_config.get('PORT', '5432')
            
            # Criar arquivo ZIP temporário
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                # 1. Fazer backup do schema do tenant
                self.stdout.write('  📋 Fazendo backup do schema do tenant...')
                schema_backup = self._backup_schema(
                    db_name, db_user, db_password, db_host, db_port, schema_name
                )
                if schema_backup:
                    zip_file.writestr('tenant_schema.sql', schema_backup)
                    self.stdout.write(self.style.SUCCESS('    ✅ Schema do tenant salvo'))
                
                # 2. Fazer backup dos dados públicos relacionados ao tenant
                self.stdout.write('  📋 Fazendo backup dos dados públicos relacionados...')
                public_data_backup = self._backup_public_data(tenant.id)
                if public_data_backup:
                    zip_file.writestr('public_data.sql', public_data_backup)
                    self.stdout.write(self.style.SUCCESS('    ✅ Dados públicos relacionados salvos'))
                
                # 3. Adicionar informações do tenant (JSON)
                tenant_info = {
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'schema_name': tenant.schema_name,
                    'backup_date': timestamp,
                    'backup_version': '1.0'
                }
                import json
                zip_file.writestr('tenant_info.json', json.dumps(tenant_info, indent=2))
            
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS(f'✅ Backup criado com sucesso!'))
            self.stdout.write(self.style.SUCCESS(f'📁 Arquivo: {backup_path}'))
            self.stdout.write(self.style.SUCCESS(f'📊 Tamanho: {os.path.getsize(backup_path) / 1024 / 1024:.2f} MB'))
            self.stdout.write(self.style.SUCCESS('=' * 60))
            
            return backup_path
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Erro ao criar backup: {str(e)}'))
            import traceback
            traceback.print_exc()
            # Remover arquivo parcial se existir
            if os.path.exists(backup_path):
                os.remove(backup_path)
            raise

    def _backup_schema(self, db_name, db_user, db_password, db_host, db_port, schema_name):
        """Faz backup do schema do tenant usando pg_dump"""
        try:
            # Construir comando pg_dump
            env = os.environ.copy()
            if db_password:
                env['PGPASSWORD'] = db_password
            
            cmd = [
                'pg_dump',
                '-h', db_host,
                '-p', str(db_port),
                '-U', db_user,
                '-d', db_name,
                '-n', schema_name,  # Backup apenas do schema específico
                '--no-owner',  # Não incluir comandos de ownership
                '--no-acl',    # Não incluir comandos de ACL
                '--clean',     # Incluir comandos DROP antes de CREATE
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                timeout=300  # 5 minutos de timeout
            )
            
            if result.returncode != 0:
                self.stdout.write(self.style.ERROR(f'    ❌ Erro no pg_dump: {result.stderr}'))
                return None
            
            return result.stdout
            
        except subprocess.TimeoutExpired:
            self.stdout.write(self.style.ERROR('    ❌ Timeout ao fazer backup do schema'))
            return None
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR('    ❌ pg_dump não encontrado. Certifique-se de que o PostgreSQL está instalado.'))
            return None
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'    ❌ Erro ao fazer backup do schema: {str(e)}'))
            return None

    def _backup_public_data(self, tenant_id):
        """Faz backup dos dados públicos relacionados ao tenant"""
        try:
            from django.db import connection
            from io import StringIO
            
            output = StringIO()
            
            # Lista de tabelas públicas que podem ter dados relacionados ao tenant
            tables_to_backup = [
                ('tenants_domain', 'tenant_id'),
                ('subscriptions_subscription', 'tenant_id'),
                ('subscriptions_quotausage', 'tenant_id'),
                ('payments_invoice', 'tenant_id'),
                ('payments_payment', 'tenant_id'),
                ('payments_paymentmethod', 'tenant_id'),
                ('tenants_empresa', 'tenant_id'),
                ('tenants_filial', 'empresa_id'),  # Via empresa
                ('accounts_tenantmembership', 'tenant_id'),
                ('accounts_userprofile', 'current_tenant_id'),
                ('public_pendingsignup', 'tenant_id'),  # Se existir
            ]
            
            with connection.cursor() as cursor:
                for table_name, tenant_field in tables_to_backup:
                    try:
                        # Verificar se a tabela existe
                        cursor.execute("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' 
                                AND table_name = %s
                            )
                        """, [table_name])
                        
                        if not cursor.fetchone()[0]:
                            continue
                        
                        # Buscar dados relacionados ao tenant
                        if tenant_field == 'empresa_id':
                            # Para filiais, buscar via empresa
                            cursor.execute(f"""
                                SELECT * FROM {table_name} 
                                WHERE {tenant_field} IN (
                                    SELECT id FROM tenants_empresa WHERE tenant_id = %s
                                )
                            """, [tenant_id])
                        else:
                            cursor.execute(f"""
                                SELECT * FROM {table_name} 
                                WHERE {tenant_field} = %s
                            """, [tenant_id])
                        
                        rows = cursor.fetchall()
                        if rows:
                            # Obter nomes das colunas
                            columns = [desc[0] for desc in cursor.description]
                            
                            output.write(f'\n-- Backup da tabela {table_name}\n')
                            output.write(f'DELETE FROM {table_name} WHERE {tenant_field} = {tenant_id};\n\n')
                            
                            for row in rows:
                                values = []
                                for val in row:
                                    if val is None:
                                        values.append('NULL')
                                    elif isinstance(val, str):
                                        # Escapar aspas simples
                                        val = val.replace("'", "''")
                                        values.append(f"'{val}'")
                                    else:
                                        values.append(str(val))
                                
                                output.write(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(values)});\n")
                            
                            output.write('\n')
                    except Exception as e:
                        # Continuar mesmo se uma tabela falhar
                        output.write(f'-- Erro ao fazer backup de {table_name}: {str(e)}\n')
            
            return output.getvalue()
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'    ❌ Erro ao fazer backup dos dados públicos: {str(e)}'))
            return None

