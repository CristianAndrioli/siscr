"""
Comando para criar migrações dos campos do SiscrModelBase
com valores padrão para registros existentes
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from django.db import migrations, models
import os
import sys


class Command(BaseCommand):
    help = 'Cria migrações para adicionar campos do SiscrModelBase'

    def handle(self, *args, **options):
        self.stdout.write('Criando migrações para campos do SiscrModelBase...')
        
        # Lista de apps que precisam de migrações
        apps = ['cadastros', 'tenants', 'accounts', 'subscriptions', 'payments']
        
        for app in apps:
            self.stdout.write(f'\n📦 Processando {app}...')
            try:
                # Tentar criar migrações
                call_command('makemigrations', app, verbosity=0, interactive=False)
                self.stdout.write(f'  ✅ Migrações criadas para {app}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  ⚠️  Erro ao criar migrações para {app}: {e}'))
        
        self.stdout.write(self.style.SUCCESS('\n✅ Processo concluído!'))
        self.stdout.write('\n📝 Próximos passos:')
        self.stdout.write('  1. Revise as migrações criadas')
        self.stdout.write('  2. Execute: python manage.py migrate_schemas --shared')
        self.stdout.write('  3. Execute: python manage.py migrate_schemas')

