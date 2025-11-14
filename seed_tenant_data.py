#!/usr/bin/env python
"""
Script para executar seed_data no contexto de um tenant específico
Uso: python seed_tenant_data.py <schema_name>
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.core.management import call_command
from django_tenants.utils import schema_context
from tenants.models import Tenant

schema_name = sys.argv[1] if len(sys.argv) > 1 else 'teste_tenant'

try:
    tenant = Tenant.objects.get(schema_name=schema_name)
    print(f'Executando seed_data no tenant: {tenant.name} ({schema_name})')
    
    with schema_context(schema_name):
        call_command('seed_data')
    
    print('✅ Seed concluído com sucesso!')
except Tenant.DoesNotExist:
    print(f'❌ Tenant com schema "{schema_name}" não encontrado!')
    sys.exit(1)
except Exception as e:
    print(f'❌ Erro ao executar seed: {e}')
    sys.exit(1)

