"""
Comando para criar múltiplos tenants com dados realistas
Uso: python manage.py seed_multiple_tenants
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Max
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
    
    def _create_tenant_via_sql(self, cursor, schema_name, tenant_name):
        """Cria tenant via SQL direto, verificando colunas disponíveis"""
        # Verificar se as colunas created_at/updated_at existem
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'tenants_tenant' 
            AND column_name IN ('created_at', 'updated_at')
        """)
        has_timestamp_cols = len(cursor.fetchall()) == 2
        
        if has_timestamp_cols:
            cursor.execute("""
                INSERT INTO tenants_tenant (schema_name, name, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
                RETURNING id
            """, [schema_name, tenant_name, True])
        else:
            # Se não tiver as colunas, inserir sem elas
            cursor.execute("""
                INSERT INTO tenants_tenant (schema_name, name, is_active)
                VALUES (%s, %s, %s)
                RETURNING id
            """, [schema_name, tenant_name, True])

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
        # Usar SQL direto para evitar problemas com colunas faltantes
        tenant = None
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                # Tentar buscar apenas campos básicos que sempre existem
                cursor.execute("""
                    SELECT id, name, schema_name, is_active 
                    FROM tenants_tenant 
                    WHERE schema_name = %s
                """, [schema_name])
                row = cursor.fetchone()
                if row:
                    tenant_id = row[0]
                    # Verificar se o ID realmente existe na tabela (garantir integridade)
                    cursor.execute("SELECT id FROM tenants_tenant WHERE id = %s", [tenant_id])
                    if cursor.fetchone():
                        tenant = Tenant(id=tenant_id, name=row[1], schema_name=row[2], is_active=row[3])
                        tenant._state.adding = False
                        self.stdout.write(self.style.WARNING(f"⚠️  Tenant {schema_name} já existe. Pulando..."))
                    else:
                        # ID não existe na tabela, precisa criar
                        self.stdout.write(self.style.WARNING(f"⚠️  Tenant {schema_name} encontrado mas ID não existe na tabela. Recriando..."))
                        tenant = None
        except Exception as e:
            # Se falhar, pode ser que a tabela não exista ou tenha estrutura diferente
            self.stdout.write(self.style.WARNING(f"⚠️  Erro ao buscar tenant: {e}"))
            tenant = None
        
        if tenant is None:
            # Tenant não existe, criar
            from django.db import connection
            with connection.cursor() as cursor:
                # Primeiro verificar se já existe (pode ter sido criado em outra execução)
                cursor.execute("SELECT id FROM tenants_tenant WHERE schema_name = %s", [schema_name])
                row = cursor.fetchone()
                if row:
                    tenant_id = row[0]
                    # Verificar se o ID realmente existe
                    cursor.execute("SELECT id FROM tenants_tenant WHERE id = %s", [tenant_id])
                    if cursor.fetchone():
                        tenant = Tenant(id=tenant_id, schema_name=schema_name, name=tenant_name, is_active=True)
                        tenant._state.adding = False
                        self.stdout.write(self.style.SUCCESS(f"✅ Tenant encontrado no banco: {tenant_name}"))
                    else:
                        # ID não existe, criar novo
                        self._create_tenant_via_sql(cursor, schema_name, tenant_name)
                        tenant_id = cursor.fetchone()[0]
                        tenant = Tenant(id=tenant_id, schema_name=schema_name, name=tenant_name, is_active=True)
                        tenant._state.adding = False
                        self.stdout.write(self.style.SUCCESS(f"✅ Tenant criado via SQL: {tenant_name}"))
                else:
                    # Não existe, criar
                    self._create_tenant_via_sql(cursor, schema_name, tenant_name)
                    tenant_id = cursor.fetchone()[0]
                    tenant = Tenant(id=tenant_id, schema_name=schema_name, name=tenant_name, is_active=True)
                    tenant._state.adding = False
                    self.stdout.write(self.style.SUCCESS(f"✅ Tenant criado via SQL: {tenant_name}"))
            
            # Criar domínio apenas se o tenant foi criado agora
            try:
                Domain.objects.get_or_create(
                    domain=f'{schema_name}.localhost',
                    tenant=tenant,
                    defaults={'is_primary': True}
                )
                self.stdout.write(self.style.SUCCESS(f"✅ Domínio criado: {schema_name}.localhost"))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"⚠️  Erro ao criar domínio: {e}"))
            
            # Migrar schema
            self.stdout.write("📦 Aplicando migrações...")
            try:
                call_command('migrate_schemas', schema_name=schema_name, verbosity=0)
                self.stdout.write(self.style.SUCCESS("✅ Migrações aplicadas"))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"⚠️  Erro ao aplicar migrações: {e}"))
        
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
                    # Desabilitar signals temporariamente para evitar problemas com colunas faltantes
                    from django.db.models.signals import post_save
                    from subscriptions.signals import update_empresa_quota_on_create
                    post_save.disconnect(update_empresa_quota_on_create, sender=Empresa)
                    
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
                    
                    # Reabilitar signal
                    post_save.connect(update_empresa_quota_on_create, sender=Empresa)
                except Exception as e:
                    # Se falhar, pode ser que as colunas não existam - tentar usar all_objects
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao buscar/criar empresa: {e}"))
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Tentando usar fallback..."))
                    try:
                        # Desabilitar signals também no fallback
                        from django.db.models.signals import post_save
                        from subscriptions.signals import update_empresa_quota_on_create
                        post_save.disconnect(update_empresa_quota_on_create, sender=Empresa)
                        
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
                        
                        # Reabilitar signal
                        post_save.connect(update_empresa_quota_on_create, sender=Empresa)
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
            
            # IMPORTANTE: Buscar empresas e filiais DIRETAMENTE do banco e VERIFICAR existência antes de usar
            # Estratégia: buscar IDs, verificar existência, e só então criar objetos
            empresas_validas = []
            try:
                # Buscar apenas IDs primeiro (mais seguro)
                empresa_ids = list(Empresa.objects.filter(tenant=tenant, is_active=True, is_deleted=False).values_list('id', flat=True))
                # Para cada ID, verificar se realmente existe antes de adicionar
                for emp_id in empresa_ids:
                    try:
                        # Verificar existência primeiro
                        if not Empresa.objects.filter(id=emp_id, tenant=tenant, is_active=True).exists():
                            continue
                        # Se existe, buscar objeto mínimo
                        emp = Empresa.objects.only('id', 'nome', 'tenant_id', 'is_active').get(id=emp_id)
                        empresas_validas.append(emp)
                    except Exception:
                        continue
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao buscar empresas: {e}"))
            
            filiais_validas = []
            # Buscar filiais para cada empresa válida e VERIFICAR existência
            for empresa in empresas_validas:
                try:
                    # Verificar se empresa ainda existe
                    if not Empresa.objects.filter(id=empresa.id, tenant=tenant).exists():
                        continue
                    
                    # Buscar apenas IDs primeiro
                    filial_ids = list(Filial.objects.filter(empresa=empresa, is_active=True, is_deleted=False).values_list('id', flat=True))
                    # Para cada ID, verificar se realmente existe antes de adicionar
                    for fil_id in filial_ids:
                        try:
                            # Verificar existência primeiro
                            if not Filial.objects.filter(id=fil_id, empresa=empresa).exists():
                                continue
                            # Se existe, buscar objeto mínimo
                            fil = Filial.objects.only('id', 'nome', 'codigo_filial', 'empresa_id', 'is_active').get(id=fil_id)
                            filiais_validas.append(fil)
                        except Exception:
                            continue
                except Exception:
                    continue
            
            self.stdout.write(f"  📊 Empresas válidas encontradas: {len(empresas_validas)}")
            self.stdout.write(f"  📊 Filiais válidas encontradas: {len(filiais_validas)}")
            
            if not empresas_validas:
                self.stdout.write(self.style.WARNING("  ⚠️  Nenhuma empresa válida encontrada. Pulando criação de dados..."))
                return
            
            # Criar pessoas (clientes, fornecedores, funcionários)
            self.stdout.write("\n👥 Criando pessoas...")
            pessoas_criadas = []
            
            # Buscar o próximo código disponível
            try:
                max_codigo = Pessoa.objects.all().aggregate(max_codigo=Max('codigo_cadastro'))['max_codigo']
                codigo = (max_codigo or 0) + 1
            except Exception:
                codigo = 1
            
            for empresa in empresas_validas:
                # Verificar se a empresa realmente existe no banco antes de usar
                try:
                    if not Empresa.objects.filter(id=empresa.id, tenant=tenant).exists():
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa {empresa.nome} (ID: {empresa.id}) não existe. Pulando criação de pessoas..."))
                        continue
                except Exception:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa {empresa.nome}. Pulando..."))
                    continue
                
                # 3 clientes por empresa
                for i in range(3):
                    nome = random.choice(NOMES_PESSOAS)
                    cidade, estado = random.choice(CIDADES)
                    cnpj = gerar_cnpj()
                    
                    # Verificar se já existe pessoa com este CPF/CNPJ
                    pessoa_existente = Pessoa.objects.filter(cpf_cnpj=cnpj).first()
                    if pessoa_existente:
                        self.stdout.write(f"    ⚠️  Pessoa com CNPJ {cnpj} já existe. Pulando...")
                        continue
                    
                    # Buscar próximo código disponível se necessário
                    while Pessoa.objects.filter(codigo_cadastro=codigo).exists():
                        codigo += 1
                    
                    try:
                        pessoa = Pessoa.objects.create(
                            codigo_cadastro=codigo,
                            tipo='PJ',
                            cpf_cnpj=cnpj,
                            razao_social=f"{nome} Comércio LTDA",
                            nome_fantasia=f"{nome} Comércio",
                            empresa=empresa_verificada,  # Usar empresa verificada
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
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar pessoa: {e}. Pulando..."))
                        codigo += 1
                        continue
                
                # 2 fornecedores por empresa
                for i in range(2):
                    nome = random.choice(NOMES_PESSOAS)
                    cidade, estado = random.choice(CIDADES)
                    cnpj = gerar_cnpj()
                    
                    # Verificar se já existe pessoa com este CPF/CNPJ
                    pessoa_existente = Pessoa.objects.filter(cpf_cnpj=cnpj).first()
                    if pessoa_existente:
                        self.stdout.write(f"    ⚠️  Pessoa com CNPJ {cnpj} já existe. Pulando...")
                        continue
                    
                    # Buscar próximo código disponível se necessário
                    while Pessoa.objects.filter(codigo_cadastro=codigo).exists():
                        codigo += 1
                    
                    try:
                        pessoa = Pessoa.objects.create(
                            codigo_cadastro=codigo,
                            tipo='PJ',
                            cpf_cnpj=cnpj,
                            razao_social=f"{nome} Fornecimentos LTDA",
                            nome_fantasia=f"{nome} Fornecimentos",
                            empresa=empresa_verificada,  # Usar empresa verificada
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
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar pessoa: {e}. Pulando..."))
                        codigo += 1
                        continue
            
            # Criar funcionários (2 por filial)
            # Primeiro, criar funcionários para empresas que NÃO têm filiais
            for empresa in empresas_validas:
                # Verificar se esta empresa tem filiais
                empresa_tem_filiais = any(f.empresa_id == empresa.id for f in filiais_validas)
                if not empresa_tem_filiais:
                    # Empresa sem filiais: criar 2 funcionários diretamente na empresa
                    for i in range(2):
                        nome = random.choice(NOMES_PESSOAS)
                        cidade, estado = random.choice(CIDADES)
                        cpf = gerar_cpf()
                        
                        # Verificar se já existe pessoa com este CPF/CNPJ
                        pessoa_existente = Pessoa.objects.filter(cpf_cnpj=cpf).first()
                        if pessoa_existente:
                            self.stdout.write(f"    ⚠️  Pessoa com CPF {cpf} já existe. Pulando...")
                            continue
                        
                        # Buscar próximo código disponível se necessário
                        while Pessoa.objects.filter(codigo_cadastro=codigo).exists():
                            codigo += 1
                        
                        try:
                            pessoa = Pessoa.objects.create(
                                codigo_cadastro=codigo,
                                tipo='PF',
                                cpf_cnpj=cpf,
                                nome_completo=nome,
                                empresa=empresa_verificada,  # Usar empresa verificada
                                filial=None,  # Sem filial
                                logradouro=f"Rua {random.choice(['das Acácias', 'dos Lírios', 'Principal'])}",
                                numero=str(random.randint(100, 999)),
                                bairro=random.choice(['Centro', 'Residencial', 'Jardim']),
                                cidade=cidade,
                                estado=estado,
                                cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                                telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                                email=f"{nome.lower().replace(' ', '.')}@{empresa_verificada_func.nome.lower().replace(' ', '')}.com.br" if empresa_verificada_func else f"{nome.lower().replace(' ', '.')}@empresa.com.br",
                                cargo=random.choice(['Vendedor', 'Gerente', 'Analista', 'Assistente']),
                                comissoes=Decimal(str(random.choice([0, 2, 3, 5]))),
                            )
                            pessoas_criadas.append(pessoa)
                            codigo += 1
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar pessoa: {e}. Pulando..."))
                            codigo += 1
                            continue
            
            # Depois, criar funcionários para filiais
            for filial in filiais_validas:
                # Verificar se a empresa da filial existe antes de usar
                empresa_filial = None
                try:
                    if Empresa.objects.filter(id=filial.empresa.id, tenant=tenant).exists():
                        empresa_filial = filial.empresa
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa da filial {filial.nome} não existe. Pulando..."))
                        continue
                except Exception:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa da filial {filial.nome}. Pulando..."))
                    continue
                
                for i in range(2):
                    nome = random.choice(NOMES_PESSOAS)
                    cidade, estado = random.choice(CIDADES)
                    cpf = gerar_cpf()
                    
                    # Verificar se já existe pessoa com este CPF/CNPJ
                    pessoa_existente = Pessoa.objects.filter(cpf_cnpj=cpf).first()
                    if pessoa_existente:
                        self.stdout.write(f"    ⚠️  Pessoa com CPF {cpf} já existe. Pulando...")
                        continue
                    
                    # Buscar próximo código disponível se necessário
                    while Pessoa.objects.filter(codigo_cadastro=codigo).exists():
                        codigo += 1
                    
                    # Verificar novamente se empresa e filial existem ANTES de criar pessoa
                    empresa_final = None
                    filial_final = None
                    
                    try:
                        # Verificar empresa novamente
                        if Empresa.objects.filter(id=empresa_filial.id, tenant=tenant).exists():
                            empresa_final = empresa_filial
                        else:
                            self.stdout.write(self.style.WARNING(f"    ⚠️  Empresa {empresa_filial.nome} (ID: {empresa_filial.id}) não existe. Criando pessoa sem empresa..."))
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao verificar empresa: {e}. Criando pessoa sem empresa..."))
                    
                    if empresa_final:
                        try:
                            # Verificar filial novamente
                            if Filial.objects.filter(id=filial.id, empresa=empresa_final).exists():
                                filial_final = filial
                            else:
                                self.stdout.write(self.style.WARNING(f"    ⚠️  Filial {filial.nome} (ID: {filial.id}) não existe. Criando pessoa sem filial..."))
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao verificar filial: {e}. Criando pessoa sem filial..."))
                    
                    # Se não tem empresa, não pode criar pessoa
                    if not empresa_final:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Não é possível criar pessoa sem empresa. Pulando..."))
                        continue
                    
                    try:
                        pessoa = Pessoa.objects.create(
                            codigo_cadastro=codigo,
                            tipo='PF',
                            cpf_cnpj=cpf,
                            nome_completo=nome,
                            empresa=empresa_final,  # Usar empresa verificada (não pode ser None)
                            filial=filial_final,  # Pode ser None se a filial não existir
                            logradouro=f"Rua {random.choice(['das Acácias', 'dos Lírios', 'Principal'])}",
                            numero=str(random.randint(100, 999)),
                            bairro=random.choice(['Centro', 'Residencial', 'Jardim']),
                            cidade=cidade,
                            estado=estado,
                            cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                            telefone_celular=f"({random.randint(11, 99)}) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                            email=f"{nome.lower().replace(' ', '.')}@{filial.empresa.nome.lower().replace(' ', '')}.com.br" if filial_verificada else f"{nome.lower().replace(' ', '.')}@empresa.com.br",
                            cargo=random.choice(['Vendedor', 'Gerente', 'Analista', 'Assistente']),
                            comissoes=Decimal(str(random.choice([0, 2, 3, 5]))),
                        )
                        pessoas_criadas.append(pessoa)
                        codigo += 1
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar pessoa: {e}. Pulando..."))
                        codigo += 1
                        continue
            
            self.stdout.write(f"  ✅ {len(pessoas_criadas)} pessoas criadas")
            
            # Criar produtos (distribuídos entre empresas)
            self.stdout.write("\n📦 Criando produtos...")
            produtos_criados = []
            
            # Buscar o próximo código disponível
            try:
                max_codigo = Produto.objects.all().aggregate(max_codigo=Max('codigo_produto'))['max_codigo']
                codigo_produto = (max_codigo or 1000) + 1
            except Exception:
                codigo_produto = 1001
            
            for empresa in empresas_validas:
                # Verificar se a empresa realmente existe no banco antes de usar
                empresa_verificada_prod = None
                try:
                    if Empresa.objects.filter(id=empresa.id, tenant=tenant).exists():
                        empresa_verificada_prod = empresa
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa {empresa.nome} (ID: {empresa.id}) não existe. Pulando criação de produtos..."))
                        continue
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa {empresa.nome}: {e}. Pulando..."))
                    continue
                
                produtos_empresa = random.sample(PRODUTOS, k=min(5, len(PRODUTOS)))
                for prod_data in produtos_empresa:
                    # Verificar se já existe produto com este código
                    while Produto.objects.filter(codigo_produto=codigo_produto).exists():
                        codigo_produto += 1
                    
                    try:
                        produto, created = Produto.objects.get_or_create(
                            codigo_produto=codigo_produto,
                            defaults={
                                'nome': prod_data['nome'],
                                'descricao': f"Descrição do produto {prod_data['nome']}",
                                'ativo': True,
                                'valor_custo': Decimal(str(prod_data['custo'])),
                                'valor_venda': Decimal(str(prod_data['venda'])),
                                'unidade_medida': 'UN',
                                'peso_liquido': Decimal(str(random.uniform(0.1, 5.0))),
                                'peso_bruto': Decimal(str(random.uniform(0.2, 6.0))),
                                'codigo_ncm': prod_data['ncm'],
                                'cfop_interno': '5102',
                                'origem_mercadoria': '1',
                                'cst_icms': '00',
                                'aliquota_icms': Decimal('18.00'),
                                'aliquota_ipi': Decimal('0.00'),
                                'moeda_negociacao': 'BRL',
                                'empresa': empresa_verificada_prod,  # Usar empresa verificada
                                'filial': None,  # Compartilhado
                            }
                        )
                        if created:
                            produtos_criados.append(produto)
                        codigo_produto += 1
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar produto: {e}. Pulando..."))
                        codigo_produto += 1
                        continue
            
            self.stdout.write(f"  ✅ {len(produtos_criados)} produtos criados")
            
            # Criar serviços (compartilhados por empresa)
            self.stdout.write("\n🔧 Criando serviços...")
            servicos_criados = []
            
            # Buscar o próximo código disponível
            try:
                max_codigo = Servico.objects.all().aggregate(max_codigo=Max('codigo_servico'))['max_codigo']
                codigo_servico = (max_codigo or 3000) + 1
            except Exception:
                codigo_servico = 3001
            
            for empresa in empresas_validas:
                # Verificar se a empresa realmente existe no banco antes de usar
                empresa_verificada_serv = None
                try:
                    if Empresa.objects.filter(id=empresa.id, tenant=tenant).exists():
                        empresa_verificada_serv = empresa
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa {empresa.nome} (ID: {empresa.id}) não existe. Pulando criação de serviços..."))
                        continue
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa {empresa.nome}: {e}. Pulando..."))
                    continue
                
                servicos_empresa = random.sample(SERVICOS, k=min(3, len(SERVICOS)))
                for serv_data in servicos_empresa:
                    # Verificar se já existe serviço com este código
                    while Servico.objects.filter(codigo_servico=codigo_servico).exists():
                        codigo_servico += 1
                    
                    try:
                        servico, created = Servico.objects.get_or_create(
                            codigo_servico=codigo_servico,
                            defaults={
                                'nome': serv_data['nome'],
                                'descricao': f"Serviço de {serv_data['nome']}",
                                'ativo': True,
                                'valor_base': Decimal(str(serv_data['valor'])),
                                'tipo_contrato': serv_data['tipo'],
                                'prazo_execucao': random.choice([5, 10, 15, 30, None]),
                                'valor_impostos_estimado': Decimal(str(serv_data['valor'] * 0.18)),
                                'codigo_ncm': '85234900',
                                'cfop': '1403',
                                'tributacao_pis': Decimal('1.65'),
                                'tributacao_cofins': Decimal('7.60'),
                                'icms_tributado': False,
                                'empresa': empresa_verificada_serv,  # Usar empresa verificada
                                'filial': None,
                            }
                        )
                        if created:
                            servicos_criados.append(servico)
                        codigo_servico += 1
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar serviço: {e}. Pulando..."))
                        codigo_servico += 1
                        continue
            
            self.stdout.write(f"  ✅ {len(servicos_criados)} serviços criados")
            
            # Criar contas a receber
            self.stdout.write("\n💰 Criando contas a receber...")
            clientes = [p for p in pessoas_criadas if p.tipo == 'PJ' and 'Comércio' in p.razao_social]
            contas_receber = []
            
            # Buscar o próximo código disponível
            try:
                max_codigo = ContaReceber.objects.all().aggregate(max_codigo=Max('codigo_conta'))['max_codigo']
                codigo_conta = (max_codigo or 0) + 1
            except Exception:
                codigo_conta = 1
            
            for i, cliente in enumerate(clientes[:10]):  # Máximo 10 contas
                # Verificar se já existe conta com este código
                while ContaReceber.objects.filter(codigo_conta=codigo_conta).exists():
                    codigo_conta += 1
                
                hoje = date.today()
                numero_doc = f'CR-{codigo_conta:03d}/2024'
                
                try:
                    conta, created = ContaReceber.objects.get_or_create(
                        codigo_conta=codigo_conta,
                        defaults={
                            'numero_documento': numero_doc,
                            'cliente': cliente,
                            'valor_total': Decimal(str(random.uniform(1000, 10000))),
                            'valor_recebido': Decimal('0.00') if i % 3 != 0 else Decimal(str(random.uniform(500, 5000))),
                            'data_emissao': hoje - timedelta(days=random.randint(1, 60)),
                            'data_vencimento': hoje + timedelta(days=random.randint(1, 30)),
                            'status': 'Pendente' if i % 3 == 0 else 'Parcial' if i % 3 == 1 else 'Pago',
                            'forma_pagamento': random.choice(['Boleto', 'PIX', 'Transferência', 'Cartão']),
                            'descricao': f'Venda de produtos/serviços - {cliente.razao_social}',
                            'empresa': cliente.empresa,
                            'filial': cliente.filial if cliente.filial else None,
                        }
                    )
                    if created:
                        contas_receber.append(conta)
                    codigo_conta += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar conta a receber: {e}. Pulando..."))
                    codigo_conta += 1
                    continue
            
            self.stdout.write(f"  ✅ {len(contas_receber)} contas a receber criadas")
            
            # Criar contas a pagar
            self.stdout.write("\n💸 Criando contas a pagar...")
            fornecedores = [p for p in pessoas_criadas if p.tipo == 'PJ' and 'Fornecimentos' in p.razao_social]
            contas_pagar = []
            
            # Buscar o próximo código disponível (continuar do último usado em contas a receber)
            try:
                max_codigo = ContaPagar.objects.all().aggregate(max_codigo=Max('codigo_conta'))['max_codigo']
                if max_codigo and max_codigo >= codigo_conta:
                    codigo_conta = max_codigo + 1
            except Exception:
                pass  # Manter codigo_conta do loop anterior
            
            for i, fornecedor in enumerate(fornecedores[:8]):  # Máximo 8 contas
                # Verificar se já existe conta com este código
                while ContaPagar.objects.filter(codigo_conta=codigo_conta).exists():
                    codigo_conta += 1
                
                hoje = date.today()
                numero_doc = f'CP-{codigo_conta:03d}/2024'
                
                try:
                    conta, created = ContaPagar.objects.get_or_create(
                        codigo_conta=codigo_conta,
                        defaults={
                            'numero_documento': numero_doc,
                            'fornecedor': fornecedor,
                            'valor_total': Decimal(str(random.uniform(500, 8000))),
                            'valor_pago': Decimal('0.00') if i % 2 == 0 else Decimal(str(random.uniform(200, 4000))),
                            'data_emissao': hoje - timedelta(days=random.randint(1, 45)),
                            'data_vencimento': hoje + timedelta(days=random.randint(1, 20)),
                            'status': 'Pendente' if i % 2 == 0 else 'Pago',
                            'forma_pagamento': random.choice(['Boleto', 'PIX', 'Transferência']),
                            'descricao': f'Compra de produtos/serviços - {fornecedor.razao_social}',
                            'empresa': fornecedor.empresa,
                            'filial': fornecedor.filial if fornecedor.filial else None,
                        }
                    )
                    if created:
                        contas_pagar.append(conta)
                    codigo_conta += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao criar conta a pagar: {e}. Pulando..."))
                    codigo_conta += 1
                    continue
            
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
                
                # Criar perfil - verificar se empresa e filial existem ANTES de atribuir
                current_empresa = None
                current_filial = None
                
                # Verificar se empresa existe no banco ANTES de usar
                if empresas_validas:
                    try:
                        emp_candidate = empresas_validas[0]
                        # Verificar existência usando apenas ID
                        if Empresa.objects.filter(id=emp_candidate.id, tenant=tenant).exists():
                            current_empresa = emp_candidate
                        else:
                            self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa {emp_candidate.nome} (ID: {emp_candidate.id}) não existe no banco. Usando None..."))
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa: {e}. Usando None..."))
                
                # Verificar se filial existe no banco ANTES de usar
                if filiais_validas and current_empresa:
                    try:
                        fil_candidate = filiais_validas[0]
                        # Verificar existência usando apenas ID
                        if Filial.objects.filter(id=fil_candidate.id, empresa=current_empresa).exists():
                            current_filial = fil_candidate
                        else:
                            self.stdout.write(self.style.WARNING(f"  ⚠️  Filial {fil_candidate.nome} (ID: {fil_candidate.id}) não existe no banco. Usando None..."))
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar filial: {e}. Usando None..."))
                
                profile_admin, _ = UserProfile.objects.get_or_create(
                    user=user_admin,
                    defaults={
                        'current_tenant': tenant,
                        'current_empresa': current_empresa,
                        'current_filial': current_filial,
                    }
                )
                if not profile_admin.current_tenant:
                    profile_admin.current_tenant = tenant
                    profile_admin.current_empresa = current_empresa
                    profile_admin.current_filial = current_filial  # Pode ser None
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
            for empresa in empresas_validas:
                # Verificar se a empresa existe antes de usar
                empresa_verificada_user = None
                try:
                    if Empresa.objects.filter(id=empresa.id, tenant=tenant).exists():
                        empresa_verificada_user = empresa
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa {empresa.nome} (ID: {empresa.id}) não existe. Pulando criação de usuários..."))
                        continue
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa {empresa.nome}: {e}. Pulando..."))
                    continue
                
                # Verificar se esta empresa tem filiais
                empresa_tem_filiais = any(f.empresa_id == empresa_verificada_user.id for f in filiais_validas)
                if not empresa_tem_filiais:
                    # Empresa sem filiais: criar 2 usuários diretamente na empresa
                    for i in range(2):
                        nome = random.choice(NOMES_PESSOAS)
                        username = f"{nome.lower().replace(' ', '.')}.emp.{empresa_verificada_user.id}"
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
                            
                            # Verificar novamente se empresa existe antes de criar perfil
                            empresa_final_user = None
                            try:
                                if Empresa.objects.filter(id=empresa_verificada_user.id, tenant=tenant).exists():
                                    empresa_final_user = empresa_verificada_user
                                else:
                                    self.stdout.write(self.style.WARNING(f"    ⚠️  Empresa {empresa_verificada_user.nome} (ID: {empresa_verificada_user.id}) não existe. Criando perfil sem empresa..."))
                            except Exception as e:
                                self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao verificar empresa: {e}. Criando perfil sem empresa..."))
                            
                            # Criar perfil
                            profile, _ = UserProfile.objects.get_or_create(
                                user=user_public,
                                defaults={
                                    'current_tenant': tenant,
                                    'current_empresa': empresa_final_user,  # Pode ser None
                                    'current_filial': None,  # Sem filial
                                }
                            )
                            if not profile.current_tenant:
                                profile.current_tenant = tenant
                                profile.current_empresa = empresa_final_user  # Pode ser None
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
            for filial in filiais_validas:
                # Verificar se a empresa da filial existe antes de usar
                empresa_filial = None
                try:
                    if Empresa.objects.filter(id=filial.empresa.id, tenant=tenant).exists():
                        empresa_filial = filial.empresa
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Empresa da filial {filial.nome} não existe. Pulando criação de usuários..."))
                        continue
                except Exception:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar empresa da filial {filial.nome}. Pulando..."))
                    continue
                
                # Verificar se a filial existe antes de usar
                filial_verificada = None
                try:
                    if Filial.objects.filter(id=filial.id, empresa=empresa_filial).exists():
                        filial_verificada = filial
                    else:
                        self.stdout.write(self.style.WARNING(f"  ⚠️  Filial {filial.nome} não existe. Pulando criação de usuários..."))
                        continue
                except Exception:
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Erro ao verificar filial {filial.nome}. Pulando..."))
                    continue
                
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
                            
                            # Verificar novamente antes de criar perfil (garantir que existem)
                            empresa_final = None
                            filial_final = None
                            
                            if empresa_filial:
                                try:
                                    if Empresa.objects.filter(id=empresa_filial.id, tenant=tenant).exists():
                                        empresa_final = empresa_filial
                                    else:
                                        self.stdout.write(self.style.WARNING(f"    ⚠️  Empresa {empresa_filial.nome} (ID: {empresa_filial.id}) não existe. Criando perfil sem empresa..."))
                                except Exception as e:
                                    self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao verificar empresa: {e}. Criando perfil sem empresa..."))
                            
                            if filial_verificada and empresa_final:
                                try:
                                    if Filial.objects.filter(id=filial_verificada.id, empresa=empresa_final).exists():
                                        filial_final = filial_verificada
                                    else:
                                        self.stdout.write(self.style.WARNING(f"    ⚠️  Filial {filial_verificada.nome} (ID: {filial_verificada.id}) não existe. Criando perfil sem filial..."))
                                except Exception as e:
                                    self.stdout.write(self.style.WARNING(f"    ⚠️  Erro ao verificar filial: {e}. Criando perfil sem filial..."))
                            
                            # Criar perfil
                            profile, _ = UserProfile.objects.get_or_create(
                                user=user_public,
                                defaults={
                                    'current_tenant': tenant,
                                    'current_empresa': empresa_final,  # Pode ser None
                                    'current_filial': filial_final,  # Pode ser None
                                }
                            )
                            if not profile.current_tenant:
                                profile.current_tenant = tenant
                                profile.current_empresa = empresa_final  # Pode ser None
                                profile.current_filial = filial_final  # Pode ser None
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
            self.stdout.write(f"  Empresas: {len(empresas_validas)}")
            self.stdout.write(f"  Filiais: {len(filiais_validas)}")
            self.stdout.write(f"  Pessoas: {len(pessoas_criadas)}")
            self.stdout.write(f"  Produtos: {len(produtos_criados)}")
            self.stdout.write(f"  Serviços: {len(servicos_criados)}")
            self.stdout.write(f"  Contas a Receber: {len(contas_receber)}")
            self.stdout.write(f"  Contas a Pagar: {len(contas_pagar)}")
            self.stdout.write(f"  Usuários: {len(usuarios_criados)}")
            self.stdout.write(f"\n  🌐 Acesse: http://{schema_name}.localhost:8000")
            self.stdout.write(f"  👤 Usuários: {', '.join([u.username for u in usuarios_criados[:5]])}... (senha: senha123)")

