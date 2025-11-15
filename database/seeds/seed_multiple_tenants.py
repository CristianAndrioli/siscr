#!/usr/bin/env python
"""
Script para criar 3 tenants com dados realistas e completos
- Tenant 1: 1 empresa, 1 filial
- Tenant 2: 1 empresa, 2 filiais
- Tenant 3: 2 empresas, cada uma com 2 filiais

Cria: empresas, filiais, pessoas, produtos, serviços, contas, usuários
"""
import os
import sys
import django
import random
from decimal import Decimal
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

from django.core.management import call_command
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from tenants.models import Tenant, Domain, Empresa, Filial
from accounts.models import UserProfile, TenantMembership
from cadastros.models import Pessoa, Produto, Servico, ContaReceber, ContaPagar
from subscriptions.models import Plan, Subscription, QuotaUsage
from django.utils import timezone

User = get_user_model()

# Dados realistas brasileiros
NOMES_PESSOAS = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Souza',
    'Juliana Ferreira', 'Roberto Alves', 'Fernanda Lima', 'Ricardo Martins', 'Patricia Rocha',
    'Marcos Pereira', 'Camila Barbosa', 'Lucas Rodrigues', 'Amanda Gomes', 'Felipe Araújo',
    'Bruna Ribeiro', 'Thiago Carvalho', 'Larissa Dias', 'Gabriel Monteiro', 'Isabela Nunes',
]

NOMES_EMPRESAS = [
    'Tech Solutions', 'Comércio & Cia', 'Serviços Premium', 'Distribuidora Central',
    'Importadora Global', 'Exportadora Nacional', 'Logística Express', 'Consultoria Avançada',
]

CIDADES = [
    ('Florianópolis', 'SC'), ('São Paulo', 'SP'), ('Rio de Janeiro', 'RJ'),
    ('Curitiba', 'PR'), ('Porto Alegre', 'RS'), ('Belo Horizonte', 'MG'),
    ('Brasília', 'DF'), ('Salvador', 'BA'), ('Recife', 'PE'), ('Fortaleza', 'CE'),
]

PRODUTOS = [
    {'nome': 'Notebook Dell Inspiron 15', 'custo': 2500.00, 'venda': 3500.00, 'ncm': '84713012'},
    {'nome': 'Mouse Logitech MX Master', 'custo': 150.00, 'venda': 250.00, 'ncm': '84716060'},
    {'nome': 'Teclado Mecânico RGB', 'custo': 450.00, 'venda': 699.00, 'ncm': '84716060'},
    {'nome': 'Monitor LG 27" 4K', 'custo': 1200.00, 'venda': 1800.00, 'ncm': '85285210'},
    {'nome': 'Webcam Logitech C920', 'custo': 300.00, 'venda': 450.00, 'ncm': '85258032'},
    {'nome': 'SSD Samsung 1TB', 'custo': 400.00, 'venda': 599.00, 'ncm': '84717010'},
    {'nome': 'Memória RAM 16GB DDR4', 'custo': 350.00, 'venda': 499.00, 'ncm': '84733090'},
    {'nome': 'Placa de Vídeo RTX 3060', 'custo': 2000.00, 'venda': 3200.00, 'ncm': '84715040'},
]

SERVICOS = [
    {'nome': 'Consultoria em TI', 'valor': 5000.00, 'tipo': 'Mensal'},
    {'nome': 'Desenvolvimento de Software', 'valor': 8000.00, 'tipo': 'Projeto'},
    {'nome': 'Suporte Técnico', 'valor': 2000.00, 'tipo': 'Mensal'},
    {'nome': 'Manutenção Preventiva', 'valor': 1500.00, 'tipo': 'Avulso'},
    {'nome': 'Treinamento de Equipe', 'valor': 3000.00, 'tipo': 'Avulso'},
]


def gerar_cnpj():
    """Gera um CNPJ válido (formato apenas, sem validação real)"""
    n1 = random.randint(10, 99)
    n2 = random.randint(100, 999)
    n3 = random.randint(100, 999)
    n4 = random.randint(1, 9)
    d1 = random.randint(0, 9)
    d2 = random.randint(0, 9)
    return f"{n1}.{n2}.{n3}/0001-{n4}{d1}{d2}"


def gerar_cpf():
    """Gera um CPF válido (formato apenas, sem validação real)"""
    n1 = random.randint(100, 999)
    n2 = random.randint(100, 999)
    n3 = random.randint(100, 999)
    d1 = random.randint(0, 9)
    d2 = random.randint(0, 9)
    return f"{n1}.{n2}.{n3}-{d1}{d2}"


def criar_tenant_completo(tenant_name, schema_name, empresas_config):
    """
    Cria um tenant completo com empresas, filiais, pessoas, produtos, serviços, contas e usuários
    
    empresas_config: lista de dicts, cada um com:
        {
            'nome': 'Nome da Empresa',
            'cnpj': '12.345.678/0001-90',
            'filiais': [
                {'nome': 'Filial 1', 'codigo': '001'},
                {'nome': 'Filial 2', 'codigo': '002'},
            ]
        }
    """
    print(f"\n{'='*60}")
    print(f"Criando Tenant: {tenant_name} ({schema_name})")
    print(f"{'='*60}")
    
    # Verificar se tenant já existe
    if Tenant.objects.filter(schema_name=schema_name).exists():
        print(f"⚠️  Tenant {schema_name} já existe. Pulando...")
        tenant = Tenant.objects.get(schema_name=schema_name)
    else:
        # Criar tenant
        tenant = Tenant.objects.create(
            name=tenant_name,
            schema_name=schema_name,
            is_active=True
        )
        print(f"✅ Tenant criado: {tenant.name}")
        
        # Criar domínio
        Domain.objects.create(
            domain=f'{schema_name}.localhost',
            tenant=tenant,
            is_primary=True
        )
        print(f"✅ Domínio criado: {schema_name}.localhost")
        
        # Migrar schema
        print("📦 Aplicando migrações...")
        call_command('migrate_schemas', schema_name=schema_name, verbosity=0)
        print("✅ Migrações aplicadas")
    
    # Criar plano básico se não existir
    plan, _ = Plan.objects.get_or_create(
        slug='basico',
        defaults={
            'name': 'Plano Básico',
            'price_monthly': Decimal('99.00'),
            'max_users': 10,
            'max_empresas': 5,
            'max_filiais': 10,
        }
    )
    
    # Criar assinatura
    subscription, _ = Subscription.objects.get_or_create(
        tenant=tenant,
        defaults={
            'plan': plan,
            'status': 'active',
            'current_period_start': timezone.now(),
            'current_period_end': timezone.now() + timedelta(days=365),
        }
    )
    
    # Criar quota usage
    QuotaUsage.objects.get_or_create(tenant=tenant)
    
    # Trabalhar no contexto do schema
    with schema_context(schema_name):
        empresas_criadas = []
        filiais_criadas = []
        
        # Criar empresas e filiais
        for emp_config in empresas_config:
            empresa = Empresa.objects.create(
                tenant=tenant,
                nome=emp_config['nome'],
                razao_social=f"{emp_config['nome']} LTDA",
                cnpj=emp_config['cnpj'],
                cidade=random.choice(CIDADES)[0],
                estado=random.choice(CIDADES)[1],
                email=f"contato@{emp_config['nome'].lower().replace(' ', '')}.com.br",
                telefone=f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                is_active=True,
            )
            empresas_criadas.append(empresa)
            print(f"  ✅ Empresa: {empresa.nome}")
            
            # Criar filiais
            for fil_config in emp_config['filiais']:
                cidade, estado = random.choice(CIDADES)
                filial = Filial.objects.create(
                    empresa=empresa,
                    nome=fil_config['nome'],
                    codigo_filial=fil_config.get('codigo', '001'),
                    cidade=cidade,
                    estado=estado,
                    email=f"filial{fil_config.get('codigo', '001')}@{empresa.nome.lower().replace(' ', '')}.com.br",
                    telefone=f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                    is_active=True,
                )
                filiais_criadas.append(filial)
                print(f"    ✅ Filial: {filial.nome}")
        
        # Criar pessoas (clientes, fornecedores, funcionários)
        print("\n👥 Criando pessoas...")
        pessoas_criadas = []
        codigo = 1
        
        for empresa in empresas_criadas:
            # 3 clientes por empresa
            for i in range(3):
                nome = random.choice(NOMES_PESSOAS)
                cidade, estado = random.choice(CIDADES)
                pessoa = Pessoa.objects.create(
                    codigo_cadastro=codigo,
                    tipo='PJ',
                    cpf_cnpj=gerar_cnpj(),
                    razao_social=f"{nome} Comércio LTDA",
                    nome_fantasia=f"{nome} Comércio",
                    empresa=empresa,
                    filial=None,  # Compartilhado na empresa
                    logradouro=f"Rua {random.choice(['das Flores', 'Principal', 'Comercial', 'do Comércio'])}",
                    numero=str(random.randint(100, 9999)),
                    bairro=random.choice(['Centro', 'Comercial', 'Industrial', 'Norte', 'Sul']),
                    cidade=cidade,
                    estado=estado,
                    cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                    telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                    email=f"contato@{nome.lower().replace(' ', '')}.com.br",
                    contribuinte=True,
                )
                pessoas_criadas.append(pessoa)
                codigo += 1
            
            # 2 fornecedores por empresa
            for i in range(2):
                nome = random.choice(NOMES_PESSOAS)
                cidade, estado = random.choice(CIDADES)
                pessoa = Pessoa.objects.create(
                    codigo_cadastro=codigo,
                    tipo='PJ',
                    cpf_cnpj=gerar_cnpj(),
                    razao_social=f"{nome} Fornecimentos LTDA",
                    nome_fantasia=f"{nome} Fornecimentos",
                    empresa=empresa,
                    filial=None,
                    logradouro=f"Av. {random.choice(['Industrial', 'Comercial', 'Principal'])}",
                    numero=str(random.randint(100, 9999)),
                    bairro=random.choice(['Industrial', 'Comercial', 'Centro']),
                    cidade=cidade,
                    estado=estado,
                    cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                    telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                    email=f"vendas@{nome.lower().replace(' ', '')}.com.br",
                    contribuinte=True,
                )
                pessoas_criadas.append(pessoa)
                codigo += 1
        
        # Criar funcionários (2 por filial)
        for filial in filiais_criadas:
            for i in range(2):
                nome = random.choice(NOMES_PESSOAS)
                cidade, estado = random.choice(CIDADES)
                pessoa = Pessoa.objects.create(
                    codigo_cadastro=codigo,
                    tipo='PF',
                    cpf_cnpj=gerar_cpf(),
                    nome_completo=nome,
                    empresa=filial.empresa,
                    filial=filial,
                    logradouro=f"Rua {random.choice(['das Acácias', 'dos Lírios', 'Principal'])}",
                    numero=str(random.randint(100, 999)),
                    bairro=random.choice(['Centro', 'Residencial', 'Jardim']),
                    cidade=cidade,
                    estado=estado,
                    cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                    telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                    email=f"{nome.lower().replace(' ', '.')}@{filial.empresa.nome.lower().replace(' ', '')}.com.br",
                    cargo=random.choice(['Vendedor', 'Gerente', 'Analista', 'Assistente']),
                    comissoes=Decimal(str(random.choice([0, 2, 3, 5]))),
                )
                pessoas_criadas.append(pessoa)
                codigo += 1
        
        print(f"  ✅ {len(pessoas_criadas)} pessoas criadas")
        
        # Criar produtos (distribuídos entre empresas)
        print("\n📦 Criando produtos...")
        produtos_criados = []
        codigo_produto = 1001
        
        for empresa in empresas_criadas:
            produtos_empresa = random.sample(PRODUTOS, k=min(5, len(PRODUTOS)))
            for prod_data in produtos_empresa:
                produto = Produto.objects.create(
                    codigo_produto=codigo_produto,
                    nome=prod_data['nome'],
                    descricao=f"Descrição do produto {prod_data['nome']}",
                    ativo=True,
                    valor_custo=Decimal(str(prod_data['custo'])),
                    valor_venda=Decimal(str(prod_data['venda'])),
                    unidade_medida='UN',
                    peso_liquido=Decimal(str(random.uniform(0.1, 5.0))),
                    peso_bruto=Decimal(str(random.uniform(0.2, 6.0))),
                    codigo_ncm=prod_data['ncm'],
                    cfop_interno='5102',
                    origem_mercadoria='1',
                    cst_icms='00',
                    aliquota_icms=Decimal('18.00'),
                    aliquota_ipi=Decimal('0.00'),
                    moeda_negociacao='BRL',
                    empresa=empresa,
                    filial=None,  # Compartilhado
                )
                produtos_criados.append(produto)
                codigo_produto += 1
        
        print(f"  ✅ {len(produtos_criados)} produtos criados")
        
        # Criar serviços (compartilhados por empresa)
        print("\n🔧 Criando serviços...")
        servicos_criados = []
        codigo_servico = 3001
        
        for empresa in empresas_criadas:
            servicos_empresa = random.sample(SERVICOS, k=min(3, len(SERVICOS)))
            for serv_data in servicos_empresa:
                servico = Servico.objects.create(
                    codigo_servico=codigo_servico,
                    nome=serv_data['nome'],
                    descricao=f"Serviço de {serv_data['nome']}",
                    ativo=True,
                    valor_base=Decimal(str(serv_data['valor'])),
                    tipo_contrato=serv_data['tipo'],
                    prazo_execucao=random.choice([5, 10, 15, 30, None]),
                    valor_impostos_estimado=Decimal(str(serv_data['valor'] * 0.18)),
                    codigo_ncm='85234900',
                    cfop='1403',
                    tributacao_pis=Decimal('1.65'),
                    tributacao_cofins=Decimal('7.60'),
                    icms_tributado=False,
                    empresa=empresa,
                    filial=None,
                )
                servicos_criados.append(servico)
                codigo_servico += 1
        
        print(f"  ✅ {len(servicos_criados)} serviços criados")
        
        # Criar contas a receber
        print("\n💰 Criando contas a receber...")
        clientes = [p for p in pessoas_criadas if p.tipo == 'PJ' and 'Comércio' in p.razao_social]
        contas_receber = []
        codigo_conta = 1
        
        for i, cliente in enumerate(clientes[:10]):  # Máximo 10 contas
            hoje = date.today()
            conta = ContaReceber.objects.create(
                codigo_conta=codigo_conta,
                numero_documento=f'CR-{codigo_conta:03d}/2024',
                cliente=cliente,
                valor_total=Decimal(str(random.uniform(1000, 10000))),
                valor_recebido=Decimal('0.00') if i % 3 != 0 else Decimal(str(random.uniform(500, 5000))),
                data_emissao=hoje - timedelta(days=random.randint(1, 60)),
                data_vencimento=hoje + timedelta(days=random.randint(1, 30)),
                status='Pendente' if i % 3 == 0 else 'Parcial' if i % 3 == 1 else 'Pago',
                forma_pagamento=random.choice(['Boleto', 'PIX', 'Transferência', 'Cartão']),
                descricao=f'Venda de produtos/serviços - {cliente.razao_social}',
                empresa=cliente.empresa,
                filial=cliente.filial,
            )
            contas_receber.append(conta)
            codigo_conta += 1
        
        print(f"  ✅ {len(contas_receber)} contas a receber criadas")
        
        # Criar contas a pagar
        print("\n💸 Criando contas a pagar...")
        fornecedores = [p for p in pessoas_criadas if p.tipo == 'PJ' and 'Fornecimentos' in p.razao_social]
        contas_pagar = []
        
        for i, fornecedor in enumerate(fornecedores[:8]):  # Máximo 8 contas
            hoje = date.today()
            conta = ContaPagar.objects.create(
                codigo_conta=codigo_conta,
                numero_documento=f'CP-{codigo_conta:03d}/2024',
                fornecedor=fornecedor,
                valor_total=Decimal(str(random.uniform(500, 8000))),
                valor_pago=Decimal('0.00') if i % 2 == 0 else Decimal(str(random.uniform(200, 4000))),
                data_emissao=hoje - timedelta(days=random.randint(1, 45)),
                data_vencimento=hoje + timedelta(days=random.randint(1, 20)),
                status='Pendente' if i % 2 == 0 else 'Pago',
                forma_pagamento=random.choice(['Boleto', 'PIX', 'Transferência']),
                descricao=f'Compra de produtos/serviços - {fornecedor.razao_social}',
                empresa=fornecedor.empresa,
                filial=fornecedor.filial,
            )
            contas_pagar.append(conta)
            codigo_conta += 1
        
        print(f"  ✅ {len(contas_pagar)} contas a pagar criadas")
        
        # Criar usuários (2 por filial) - precisa fazer no schema público
        print("\n👤 Criando usuários...")
        usuarios_criados = []
        
        # Sair do contexto do tenant para criar usuários no schema público
        # (UserProfile e TenantMembership estão no schema público)
        
        for filial in filiais_criadas:
            for i in range(2):
                nome = random.choice(NOMES_PESSOAS)
                username = f"{nome.lower().replace(' ', '.')}.{filial.codigo_filial}"
                # Garantir username único
                if i > 0:
                    username = f"{username}.{i}"
                email = f"{username}@{tenant.schema_name}.com"
                
                # Criar no schema público
                with schema_context('public'):
                    user_public, created = User.objects.get_or_create(
                        username=username,
                        defaults={
                            'email': email,
                            'first_name': nome.split()[0],
                            'last_name': ' '.join(nome.split()[1:]) if len(nome.split()) > 1 else '',
                        }
                    )
                    if created:
                        user_public.set_password('senha123')
                        user_public.save()
                    
                    # Criar perfil
                    profile, _ = UserProfile.objects.get_or_create(
                        user=user_public,
                        defaults={
                            'current_tenant': tenant,
                            'current_empresa': filial.empresa,
                            'current_filial': filial,
                        }
                    )
                    if not profile.current_tenant:
                        profile.current_tenant = tenant
                        profile.current_empresa = filial.empresa
                        profile.current_filial = filial
                        profile.save()
                    
                    # Criar membership
                    TenantMembership.objects.get_or_create(
                        user=user_public,
                        tenant=tenant,
                        defaults={
                            'role': 'user',
                            'is_active': True,
                        }
                    )
                
                # Criar no schema do tenant também
                with schema_context(schema_name):
                    user_tenant, _ = User.objects.get_or_create(
                        username=username,
                        defaults={
                            'email': email,
                            'first_name': nome.split()[0],
                            'last_name': ' '.join(nome.split()[1:]) if len(nome.split()) > 1 else '',
                        }
                    )
                    if not user_tenant.has_usable_password():
                        user_tenant.set_password('senha123')
                        user_tenant.save()
                    usuarios_criados.append(user_tenant)
                    print(f"    ✅ Usuário: {username} ({filial.nome})")
        
        print(f"  ✅ {len(usuarios_criados)} usuários criados")
        
        # Resumo
        print(f"\n{'='*60}")
        print(f"✅ Tenant {tenant_name} criado com sucesso!")
        print(f"{'='*60}")
        print(f"  Empresas: {len(empresas_criadas)}")
        print(f"  Filiais: {len(filiais_criadas)}")
        print(f"  Pessoas: {len(pessoas_criadas)}")
        print(f"  Produtos: {len(produtos_criados)}")
        print(f"  Serviços: {len(servicos_criados)}")
        print(f"  Contas a Receber: {len(contas_receber)}")
        print(f"  Contas a Pagar: {len(contas_pagar)}")
        print(f"  Usuários: {len(usuarios_criados)}")
        print(f"\n  🌐 Acesse: http://{schema_name}.localhost:8000")
        print(f"  👤 Usuários: {', '.join([u.username for u in usuarios_criados[:5]])}... (senha: senha123)")


def main():
    """Função principal"""
    print("🚀 Iniciando criação de tenants com dados realistas...")
    
    # Configuração dos 3 tenants
    tenants_config = [
        {
            'name': 'Comércio Simples',
            'schema': 'comercio_simples',
            'empresas': [
                {
                    'nome': 'Comércio Simples LTDA',
                    'cnpj': '12.345.678/0001-90',
                    'filiais': [
                        {'nome': 'Matriz', 'codigo': '001'},
                    ]
                }
            ]
        },
        {
            'name': 'Grupo Expansão',
            'schema': 'grupo_expansao',
            'empresas': [
                {
                    'nome': 'Grupo Expansão LTDA',
                    'cnpj': '23.456.789/0001-01',
                    'filiais': [
                        {'nome': 'Matriz - Centro', 'codigo': '001'},
                        {'nome': 'Filial Norte', 'codigo': '002'},
                    ]
                }
            ]
        },
        {
            'name': 'Holding Diversificada',
            'schema': 'holding_diversificada',
            'empresas': [
                {
                    'nome': 'Tech Solutions Brasil',
                    'cnpj': '34.567.890/0001-12',
                    'filiais': [
                        {'nome': 'Matriz - São Paulo', 'codigo': '001'},
                        {'nome': 'Filial - Rio de Janeiro', 'codigo': '002'},
                    ]
                },
                {
                    'nome': 'Comércio & Serviços Premium',
                    'cnpj': '45.678.901/0001-23',
                    'filiais': [
                        {'nome': 'Matriz - Florianópolis', 'codigo': '001'},
                        {'nome': 'Filial - Curitiba', 'codigo': '002'},
                    ]
                }
            ]
        }
    ]
    
    # Criar cada tenant
    for config in tenants_config:
        try:
            criar_tenant_completo(
                config['name'],
                config['schema'],
                config['empresas']
            )
        except Exception as e:
            print(f"❌ Erro ao criar tenant {config['name']}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*60}")
    print("✅ Todos os tenants criados com sucesso!")
    print(f"{'='*60}")
    print("\n📋 Resumo:")
    print("  1. Comércio Simples: 1 empresa, 1 filial")
    print("  2. Grupo Expansão: 1 empresa, 2 filiais")
    print("  3. Holding Diversificada: 2 empresas, 2 filiais cada")
    print("\n🔐 Senha padrão para todos os usuários: senha123")


if __name__ == '__main__':
    main()

