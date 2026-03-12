"""
Comando para migrar dados existentes associando-os à primeira empresa/filial do tenant
Uso: python manage.py migrate_empresa_filial [--schema=SCHEMA_NAME] [--associate-to-first]
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from tenants.models import Tenant, Empresa, Filial
from cadastros.models import Pessoa, Produto, Servico
from financeiro.models import ContaReceber, ContaPagar


class Command(BaseCommand):
    help = 'Associa dados existentes à primeira empresa/filial do tenant ou marca como compartilhados'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schema',
            type=str,
            help='Schema do tenant a processar (se não fornecido, processa todos)',
        )
        parser.add_argument(
            '--associate-to-first',
            action='store_true',
            help='Associa dados à primeira empresa/filial ao invés de marcar como compartilhados',
        )

    def handle(self, *args, **options):
        schema_name = options.get('schema')
        associate_to_first = options.get('associate_to_first', False)
        
        if schema_name:
            tenants = Tenant.objects.filter(schema_name=schema_name)
        else:
            tenants = Tenant.objects.filter(is_active=True)
        
        if not tenants.exists():
            self.stdout.write(self.style.WARNING('Nenhum tenant encontrado!'))
            return
        
        for tenant in tenants:
            self.stdout.write(f'\nProcessando tenant: {tenant.name} ({tenant.schema_name})')
            
            with schema_context(tenant.schema_name):
                # Obter primeira empresa e filial
                primeira_empresa = Empresa.objects.filter(tenant=tenant, is_active=True).first()
                primeira_filial = None
                if primeira_empresa:
                    primeira_filial = Filial.objects.filter(empresa=primeira_empresa, is_active=True).first()
                
                if not primeira_empresa:
                    self.stdout.write(self.style.WARNING(f'  ⚠ Tenant {tenant.name} não tem empresas. Dados serão marcados como compartilhados.'))
                
                # Migrar cada modelo
                self._migrate_model(Pessoa, 'pessoas', primeira_empresa, primeira_filial, associate_to_first)
                self._migrate_model(Produto, 'produtos', primeira_empresa, primeira_filial, associate_to_first)
                self._migrate_model(Servico, 'serviços', primeira_empresa, primeira_filial, associate_to_first)
                self._migrate_model(ContaReceber, 'contas a receber', primeira_empresa, primeira_filial, associate_to_first)
                self._migrate_model(ContaPagar, 'contas a pagar', primeira_empresa, primeira_filial, associate_to_first)
        
        self.stdout.write(self.style.SUCCESS('\n✅ Migração concluída!'))

    def _migrate_model(self, model, nome_modelo, primeira_empresa, primeira_filial, associate_to_first):
        """Migra um modelo específico"""
        try:
            # Contar registros sem empresa/filial
            registros_sem_empresa = model.objects.filter(empresa__isnull=True).count()
            
            if registros_sem_empresa == 0:
                self.stdout.write(f'  ✓ {nome_modelo.capitalize()}: Nenhum registro para migrar')
                return
            
            if associate_to_first and primeira_empresa:
                # Associar à primeira empresa/filial
                updated = model.objects.filter(empresa__isnull=True).update(
                    empresa=primeira_empresa,
                    filial=primeira_filial
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ {nome_modelo.capitalize()}: {updated} registros associados à '
                        f'{primeira_empresa.nome}' + (f' - {primeira_filial.nome}' if primeira_filial else '')
                    )
                )
            else:
                # Manter como compartilhados (já estão com empresa=None, filial=None)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ {nome_modelo.capitalize()}: {registros_sem_empresa} registros mantidos como compartilhados'
                    )
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  ❌ Erro ao migrar {nome_modelo}: {e}')
            )

