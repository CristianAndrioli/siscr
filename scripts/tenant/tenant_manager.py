#!/usr/bin/env python
"""
Módulo unificado para gerenciamento de tenants

Uso:
    python scripts/tenant/tenant_manager.py create --name "Meu Tenant" --domain "meutenant"
    python scripts/tenant/tenant_manager.py remove --name "teste_tenant"
    python scripts/tenant/tenant_manager.py list
    python scripts/tenant/tenant_manager.py info --name "teste_tenant"
"""
import os
import sys
import django
import argparse

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from tenants.models import Tenant, Domain
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model

User = get_user_model()


def create_tenant(name, domain, plan_id=1, **kwargs):
    """Cria um novo tenant"""
    print(f"Criando tenant: {name} ({domain})...")
    
    # Verificar se já existe
    if Tenant.objects.filter(schema_name=domain).exists():
        print(f"❌ Tenant com schema '{domain}' já existe!")
        return False
    
    # Criar tenant
    tenant = Tenant.objects.create(
        schema_name=domain,
        name=name,
        is_active=True
    )
    
    # Criar domínio
    Domain.objects.create(
        domain=f"{domain}.localhost",
        tenant=tenant,
        is_primary=True
    )
    
    print(f"✅ Tenant criado com sucesso!")
    print(f"   ID: {tenant.id}")
    print(f"   Schema: {tenant.schema_name}")
    print(f"   URL: http://{domain}.localhost:8000")
    
    return True


def remove_tenant(name_or_schema):
    """Remove um tenant"""
    print(f"Removendo tenant: {name_or_schema}...")
    
    tenant = Tenant.objects.filter(
        schema_name=name_or_schema
    ).first() or Tenant.objects.filter(
        name=name_or_schema
    ).first()
    
    if not tenant:
        print(f"❌ Tenant '{name_or_schema}' não encontrado!")
        return False
    
    schema_name = tenant.schema_name
    tenant.delete()
    
    print(f"✅ Tenant '{schema_name}' removido com sucesso!")
    return True


def list_tenants():
    """Lista todos os tenants"""
    tenants = Tenant.objects.all()
    
    if not tenants.exists():
        print("Nenhum tenant encontrado.")
        return
    
    print(f"\n{'='*60}")
    print(f"Tenants encontrados: {tenants.count()}")
    print(f"{'='*60}\n")
    
    for tenant in tenants:
        print(f"ID: {tenant.id}")
        print(f"  Nome: {tenant.name}")
        print(f"  Schema: {tenant.schema_name}")
        print(f"  Ativo: {tenant.is_active}")
        print(f"  Domínios: {', '.join([d.domain for d in tenant.domains.all()])}")
        print()


def tenant_info(name_or_schema):
    """Mostra informações detalhadas de um tenant"""
    tenant = Tenant.objects.filter(
        schema_name=name_or_schema
    ).first() or Tenant.objects.filter(
        name=name_or_schema
    ).first()
    
    if not tenant:
        print(f"❌ Tenant '{name_or_schema}' não encontrado!")
        return
    
    print(f"\n{'='*60}")
    print(f"Informações do Tenant: {tenant.name}")
    print(f"{'='*60}\n")
    
    print(f"ID: {tenant.id}")
    print(f"Nome: {tenant.name}")
    print(f"Schema: {tenant.schema_name}")
    print(f"Ativo: {tenant.is_active}")
    print(f"Criado em: {tenant.created_at}")
    print(f"Atualizado em: {tenant.updated_at}")
    
    print(f"\nDomínios:")
    for domain in tenant.domains.all():
        print(f"  - {domain.domain} (primário: {domain.is_primary})")
    
    # Contar usuários no schema do tenant
    with schema_context(tenant.schema_name):
        user_count = User.objects.count()
        print(f"\nUsuários no tenant: {user_count}")


def main():
    parser = argparse.ArgumentParser(description='Gerenciador de Tenants')
    subparsers = parser.add_subparsers(dest='command', help='Comandos disponíveis')
    
    # Comando create
    create_parser = subparsers.add_parser('create', help='Criar novo tenant')
    create_parser.add_argument('--name', required=True, help='Nome do tenant')
    create_parser.add_argument('--domain', required=True, help='Schema name/domínio')
    create_parser.add_argument('--plan-id', type=int, default=1, help='ID do plano')
    
    # Comando remove
    remove_parser = subparsers.add_parser('remove', help='Remover tenant')
    remove_parser.add_argument('--name', required=True, help='Nome ou schema do tenant')
    
    # Comando list
    subparsers.add_parser('list', help='Listar todos os tenants')
    
    # Comando info
    info_parser = subparsers.add_parser('info', help='Informações de um tenant')
    info_parser.add_argument('--name', required=True, help='Nome ou schema do tenant')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'create':
        create_tenant(args.name, args.domain, args.plan_id)
    elif args.command == 'remove':
        remove_tenant(args.name)
    elif args.command == 'list':
        list_tenants()
    elif args.command == 'info':
        tenant_info(args.name)


if __name__ == '__main__':
    main()

