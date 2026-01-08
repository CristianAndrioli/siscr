#!/usr/bin/env python
"""
Script para verificar se os dados do tenant já existem

Uso:
    python scripts/database/check_tenant_data.py [schema_name]

Argumentos:
    schema_name: Nome do schema do tenant (padrão: 'teste_tenant')

Retorna:
    0 se dados existem, 1 se não existem
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django_tenants.utils import schema_context
from cadastros.models import Pessoa, Produto
from tenants.models import Tenant

schema_name = sys.argv[1] if len(sys.argv) > 1 else 'teste_tenant'

try:
    tenant = Tenant.objects.get(schema_name=schema_name)
    with schema_context(tenant.schema_name):
        if Pessoa.objects.exists() or Produto.objects.exists():
            sys.exit(0)  # Dados existem
        else:
            sys.exit(1)  # Dados não existem
except Tenant.DoesNotExist:
    sys.exit(1)  # Tenant não existe
except Exception as e:
    sys.exit(1)  # Erro ao verificar

