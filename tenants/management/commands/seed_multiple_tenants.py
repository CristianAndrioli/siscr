"""
Comando para criar múltiplos tenants com dados realistas
Uso: python manage.py seed_multiple_tenants
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
import random

from tenants.models import Tenant, Domain, Empresa, Filial
from accounts.models import UserProfile, TenantMembership
from cadastros.models import Pessoa, Produto, Servico
from financeiro.models import ContaReceber, ContaPagar
from subscriptions.models import Plan, Subscription, QuotaUsage

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


class Command(BaseCommand):
    help = 'Cria 3 tenants com dados realistas e completos'

    def handle(self, *args, **options):
        self.stdout.write("🚀 Iniciando criação de tenants com dados realistas...")
        
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
                        'filiais': []  # Empresa SEM filiais para testar comportamento sem estrutura de filiais
                    }
                ]
            }
        ]
        
        # Criar cada tenant
        for config in tenants_config:
            try:
                self.criar_tenant_completo(
                    config['name'],
                    config['schema'],
                    config['empresas']
                )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Erro ao criar tenant {config['name']}: {e}"))
                import traceback
                traceback.print_exc()
        
        self.stdout.write(self.style.SUCCESS(f"\n{'='*60}"))
        self.stdout.write(self.style.SUCCESS("✅ Todos os tenants criados com sucesso!"))
        self.stdout.write(self.style.SUCCESS(f"{'='*60}"))
        self.stdout.write("\n📋 Resumo:")
        self.stdout.write("  1. Comércio Simples: 1 empresa, 1 filial")
        self.stdout.write("  2. Grupo Expansão: 1 empresa, 2 filiais")
        self.stdout.write("  3. Holding Diversificada: 2 empresas")
        self.stdout.write("     - Tech Solutions Brasil: 2 filiais")
        self.stdout.write("     - Comércio & Serviços Premium: 0 filiais (sem filial)")
        self.stdout.write("\n🔐 Senha padrão para todos os usuários: senha123")

    def criar_tenant_completo(self, tenant_name, schema_name, empresas_config):
        """
        Cria um tenant completo com empresas, filiais, pessoas, produtos, serviços, contas e usuários
        """
        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(f"Criando Tenant: {tenant_name} ({schema_name})")
        self.stdout.write(f"{'='*60}")
        
        # Verificar se tenant já existe
        if Tenant.objects.filter(schema_name=schema_name).exists():
            self.stdout.write(self.style.WARNING(f"⚠️  Tenant {schema_name} já existe. Pulando..."))
            tenant = Tenant.objects.get(schema_name=schema_name)
        else:
            # Criar tenant
            tenant = Tenant.objects.create(
                name=tenant_name,
                schema_name=schema_name,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f"✅ Tenant criado: {tenant.name}"))
            
            # Criar domínio
            Domain.objects.create(
                domain=f'{schema_name}.localhost',
                tenant=tenant,
                is_primary=True
            )
            self.stdout.write(self.style.SUCCESS(f"✅ Domínio criado: {schema_name}.localhost"))
            
            # Migrar schema
            self.stdout.write("📦 Aplicando migrações...")
            call_command('migrate_schemas', schema_name=schema_name, verbosity=0)
            self.stdout.write(self.style.SUCCESS("✅ Migrações aplicadas"))
        
        # Criar plano básico se não existir
        # Usar only() para buscar apenas campos básicos caso migrações não estejam aplicadas
        try:
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
        except Exception as e:
            # Se falhar, tentar usar all_objects e apenas campos básicos
            self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao buscar plano: {e}"))
            self.stdout.write(self.style.WARNING(f"  ⚠️  Tentando criar plano com campos básicos..."))
            try:
                # Tentar buscar apenas com campos básicos
                plan = Plan.all_objects.filter(slug='basico').only('id', 'slug', 'name', 'price_monthly', 'max_users', 'max_empresas', 'max_filiais', 'is_active').first()
                if not plan:
                    # Criar usando apenas campos básicos
                    plan = Plan.all_objects.create(
                        slug='basico',
                        name='Plano Básico',
                        price_monthly=Decimal('99.00'),
                        max_users=10,
                        max_empresas=5,
                        max_filiais=10,
                        is_active=True,
                    )
            except Exception as e2:
                self.stdout.write(self.style.ERROR(f"  ❌ Erro ao criar plano: {e2}"))
                self.stdout.write(self.style.ERROR(f"  ❌ As migrações do app subscriptions podem não estar aplicadas corretamente."))
                self.stdout.write(self.style.ERROR(f"  ❌ Execute: docker-compose exec web python manage.py migrate_schemas --shared"))
                raise
        
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
                # Usar get_or_create para evitar duplicatas se o script for executado múltiplas vezes
                # IMPORTANTE: Filtrar por tenant também para garantir isolamento correto
                cidade, estado = random.choice(CIDADES)
                try:
                    empresa, created = Empresa.objects.get_or_create(
                        cnpj=emp_config['cnpj'],
                        tenant=tenant,  # Adicionar tenant na busca para garantir isolamento
                        defaults={
                            'nome': emp_config['nome'],
                            'razao_social': f"{emp_config['nome']} LTDA",
                            'cidade': cidade,
                            'estado': estado,
                            'email': f"contato@{emp_config['nome'].lower().replace(' ', '')}.com.br",
                            'telefone': f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                            'is_active': True,
                        }
                    )
                except Exception as e:
                    # Se falhar, pode ser que as colunas não existam - tentar usar all_objects
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao buscar/criar empresa: {e}"))
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Tentando usar fallback..."))
                    try:
                        empresa = Empresa.all_objects.filter(cnpj=emp_config['cnpj'], tenant=tenant).first()
                        if not empresa:
                            # Criar usando apenas campos básicos que sabemos que existem
                            empresa = Empresa.all_objects.create(
                                cnpj=emp_config['cnpj'],
                                tenant=tenant,
                                nome=emp_config['nome'],
                                razao_social=f"{emp_config['nome']} LTDA",
                                cidade=cidade,
                                estado=estado,
                                email=f"contato@{emp_config['nome'].lower().replace(' ', '')}.com.br",
                                telefone=f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                                is_active=True,
                            )
                            created = True
                        else:
                            created = False
                    except Exception as e2:
                        self.stdout.write(self.style.ERROR(f"  ❌ Erro ao criar empresa: {e2}"))
                        self.stdout.write(self.style.ERROR(f"  ❌ As migrações podem não estar aplicadas corretamente."))
                        self.stdout.write(self.style.ERROR(f"  ❌ Execute: docker-compose exec web python manage.py fix_tenant_migrations"))
                        raise
                empresas_criadas.append(empresa)
                if created:
                    self.stdout.write(f"  ✅ Empresa criada: {empresa.nome}")
                else:
                    self.stdout.write(f"  ⚠️  Empresa já existe: {empresa.nome}")
                
                # Criar filiais
                for fil_config in emp_config['filiais']:
                    cidade, estado = random.choice(CIDADES)
                    codigo_filial = fil_config.get('codigo', '001')
                    # Usar get_or_create para evitar duplicatas
                    try:
                        filial, created = Filial.objects.get_or_create(
                            empresa=empresa,
                            codigo_filial=codigo_filial,
                            defaults={
                                'nome': fil_config['nome'],
                                'cidade': cidade,
                                'estado': estado,
                                'email': f"filial{codigo_filial}@{empresa.nome.lower().replace(' ', '')}.com.br",
                                'telefone': f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                                'is_active': True,
                            }
                        )
                    except Exception as e:
                        # Se falhar, tentar usar all_objects
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao buscar/criar filial: {e}"))
                        try:
                            filial = Filial.all_objects.filter(empresa=empresa, codigo_filial=codigo_filial).first()
                            if not filial:
                                filial = Filial.all_objects.create(
                                    empresa=empresa,
                                    codigo_filial=codigo_filial,
                                    nome=fil_config['nome'],
                                    cidade=cidade,
                                    estado=estado,
                                    email=f"filial{codigo_filial}@{empresa.nome.lower().replace(' ', '')}.com.br",
                                    telefone=f"({random.randint(11, 99)}) {random.randint(3000, 9999)}-{random.randint(1000, 9999)}",
                                    is_active=True,
                                )
                                created = True
                            else:
                                created = False
                        except Exception as e2:
                            self.stdout.write(self.style.ERROR(f"    ❌ Erro ao criar filial: {e2}"))
                            # Continuar mesmo se falhar
                            continue
                    filiais_criadas.append(filial)
                    if created:
                        self.stdout.write(f"    ✅ Filial criada: {filial.nome}")
                    else:
                        self.stdout.write(f"    ⚠️  Filial já existe: {filial.nome}")
            
            # Criar pessoas (clientes, fornecedores, funcionários)
            self.stdout.write("\n👥 Criando pessoas...")
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
            # Primeiro, criar funcionários para empresas que NÃO têm filiais
            for empresa in empresas_criadas:
                # Verificar se esta empresa tem filiais
                empresa_tem_filiais = any(f.empresa == empresa for f in filiais_criadas)
                if not empresa_tem_filiais:
                    # Empresa sem filiais: criar 2 funcionários diretamente na empresa
                    for i in range(2):
                        nome = random.choice(NOMES_PESSOAS)
                        cidade, estado = random.choice(CIDADES)
                        pessoa = Pessoa.objects.create(
                            codigo_cadastro=codigo,
                            tipo='PF',
                            cpf_cnpj=gerar_cpf(),
                            nome_completo=nome,
                            empresa=empresa,
                            filial=None,  # Sem filial
                            logradouro=f"Rua {random.choice(['das Acácias', 'dos Lírios', 'Principal'])}",
                            numero=str(random.randint(100, 999)),
                            bairro=random.choice(['Centro', 'Residencial', 'Jardim']),
                            cidade=cidade,
                            estado=estado,
                            cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                            telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                            email=f"{nome.lower().replace(' ', '.')}@{empresa.nome.lower().replace(' ', '')}.com.br",
                            cargo=random.choice(['Vendedor', 'Gerente', 'Analista', 'Assistente']),
                            comissoes=Decimal(str(random.choice([0, 2, 3, 5]))),
                        )
                        pessoas_criadas.append(pessoa)
                        codigo += 1
            
            # Depois, criar funcionários para filiais
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
            
            self.stdout.write(f"  ✅ {len(pessoas_criadas)} pessoas criadas")
            
            # Criar produtos (distribuídos entre empresas)
            self.stdout.write("\n📦 Criando produtos...")
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
            
            self.stdout.write(f"  ✅ {len(produtos_criados)} produtos criados")
            
            # Criar serviços (compartilhados por empresa)
            self.stdout.write("\n🔧 Criando serviços...")
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
            
            self.stdout.write(f"  ✅ {len(servicos_criados)} serviços criados")
            
            # Criar contas a receber
            self.stdout.write("\n💰 Criando contas a receber...")
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
            
            self.stdout.write(f"  ✅ {len(contas_receber)} contas a receber criadas")
            
            # Criar contas a pagar
            self.stdout.write("\n💸 Criando contas a pagar...")
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
            
            self.stdout.write(f"  ✅ {len(contas_pagar)} contas a pagar criadas")
            
            # Criar usuário admin primeiro (um por tenant)
            self.stdout.write("\n👤 Criando usuários...")
            usuarios_criados = []
            
            # Criar usuário admin do tenant
            admin_nome = f"Admin {tenant_name}"
            admin_username = f"admin.{schema_name}"
            admin_email = f"admin@{schema_name}.com"
            
            with schema_context('public'):
                user_admin, created = User.objects.get_or_create(
                    username=admin_username,
                    defaults={
                        'email': admin_email,
                        'first_name': 'Admin',
                        'last_name': tenant_name,
                    }
                )
                if created:
                    user_admin.set_password('senha123')
                    user_admin.save()
                
                # Criar perfil
                profile_admin, _ = UserProfile.objects.get_or_create(
                    user=user_admin,
                    defaults={
                        'current_tenant': tenant,
                        'current_empresa': empresas_criadas[0] if empresas_criadas else None,
                        'current_filial': filiais_criadas[0] if filiais_criadas else None,
                    }
                )
                if not profile_admin.current_tenant:
                    profile_admin.current_tenant = tenant
                    if empresas_criadas:
                        profile_admin.current_empresa = empresas_criadas[0]
                    if filiais_criadas:
                        profile_admin.current_filial = filiais_criadas[0]
                    profile_admin.save()
                
                # Criar membership como admin
                membership_admin, _ = TenantMembership.objects.get_or_create(
                    user=user_admin,
                    tenant=tenant,
                    defaults={
                        'role': 'admin',
                        'is_active': True,
                    }
                )
                # Garantir que seja admin mesmo se já existir
                if membership_admin.role != 'admin':
                    membership_admin.role = 'admin'
                    membership_admin.save()
            
            # Criar no schema do tenant também
            with schema_context(schema_name):
                user_admin_tenant, _ = User.objects.get_or_create(
                    username=admin_username,
                    defaults={
                        'email': admin_email,
                        'first_name': 'Admin',
                        'last_name': tenant_name,
                    }
                )
                if not user_admin_tenant.has_usable_password():
                    user_admin_tenant.set_password('senha123')
                    user_admin_tenant.save()
                usuarios_criados.append(user_admin_tenant)
                self.stdout.write(f"    ✅ Admin: {admin_username} (role: admin)")
            
            # Criar usuários normais (2 por filial)
            # Primeiro, criar usuários para empresas que NÃO têm filiais
            for empresa in empresas_criadas:
                # Verificar se esta empresa tem filiais
                empresa_tem_filiais = any(f.empresa == empresa for f in filiais_criadas)
                if not empresa_tem_filiais:
                    # Empresa sem filiais: criar 2 usuários diretamente na empresa
                    for i in range(2):
                        nome = random.choice(NOMES_PESSOAS)
                        username = f"{nome.lower().replace(' ', '.')}.emp.{empresa.id}"
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
                                    'current_empresa': empresa,
                                    'current_filial': None,  # Sem filial
                                }
                            )
                            if not profile.current_tenant:
                                profile.current_tenant = tenant
                                profile.current_empresa = empresa
                                profile.current_filial = None
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
                            self.stdout.write(f"    ✅ Usuário: {username} ({empresa.nome} - sem filial)")
            
            # Depois, criar usuários para filiais
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
                        self.stdout.write(f"    ✅ Usuário: {username} ({filial.nome})")
            
            self.stdout.write(f"  ✅ {len(usuarios_criados)} usuários criados")
            
            # Resumo
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(self.style.SUCCESS(f"✅ Tenant {tenant_name} criado com sucesso!"))
            self.stdout.write(f"{'='*60}")
            self.stdout.write(f"  Empresas: {len(empresas_criadas)}")
            self.stdout.write(f"  Filiais: {len(filiais_criadas)}")
            self.stdout.write(f"  Pessoas: {len(pessoas_criadas)}")
            self.stdout.write(f"  Produtos: {len(produtos_criados)}")
            self.stdout.write(f"  Serviços: {len(servicos_criados)}")
            self.stdout.write(f"  Contas a Receber: {len(contas_receber)}")
            self.stdout.write(f"  Contas a Pagar: {len(contas_pagar)}")
            self.stdout.write(f"  Usuários: {len(usuarios_criados)}")
            self.stdout.write(f"\n  🌐 Acesse: http://{schema_name}.localhost:8000")
            self.stdout.write(f"  👤 Usuários: {', '.join([u.username for u in usuarios_criados[:5]])}... (senha: senha123)")

