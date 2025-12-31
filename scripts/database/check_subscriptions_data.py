#!/usr/bin/env python
"""
Script para verificar se os dados de subscriptions já existem

Uso:
    python scripts/database/check_subscriptions_data.py

Retorna:
    0 se dados existem, 1 se não existem
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from subscriptions.models import Plan, Feature
from django.db import connection

# Garantir que estamos no schema público
connection.set_schema_to_public()

if Plan.objects.exists() and Feature.objects.exists():
    sys.exit(0)  # Dados existem
else:
    sys.exit(1)  # Dados não existem

