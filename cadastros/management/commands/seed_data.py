"""
Comando para popular o banco de dados com dados de exemplo (seed)
Uso: python manage.py seed_data [--clear] [--migrate]
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction, connection
from decimal import Decimal
from datetime import date, timedelta
from cadastros.models import Pessoa, Produto, Servico, ContaReceber, ContaPagar
from tenants.models import Empresa, Filial


class Command(BaseCommand):
    help = 'Popula o banco de dados com dados de exemplo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Limpa os dados existentes antes de popular',
        )
        parser.add_argument(
            '--migrate',
            action='store_true',
            help='Aplica migrações antes de popular (se necessário)',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        migrate = options['migrate']
        
        # Verificar se as tabelas existem
        if migrate or not self._tabelas_existem():
            self.stdout.write(self.style.WARNING('Aplicando migrações...'))
            try:
                # Verificar se estamos em um contexto de tenant
                current_schema = self._get_current_schema()
                if current_schema and current_schema != 'public':
                    # Estamos em um tenant, usar migrate_schemas
                    call_command('migrate_schemas', schema_name=current_schema, verbosity=0)
                else:
                    # Schema público, usar migrate normal
                    call_command('migrate', 'cadastros', verbosity=0)
                self.stdout.write(self.style.SUCCESS('Migrações aplicadas!'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Migrações não aplicadas: {e}'))
                # Tentar criar tabelas manualmente
                try:
                    self.stdout.write(self.style.WARNING('Tentando criar tabelas manualmente...'))
                    call_command('create_tables', verbosity=0)
                    self.stdout.write(self.style.SUCCESS('Tabelas criadas manualmente!'))
                except Exception as e2:
                    self.stdout.write(self.style.ERROR(f'Erro ao criar tabelas: {e2}'))
                    self.stdout.write(self.style.WARNING('Execute: python manage.py create_tables'))
        
        if clear:
            self.stdout.write(self.style.WARNING('Limpando dados existentes...'))
            try:
                ContaReceber.objects.all().delete()
                ContaPagar.objects.all().delete()
                Pessoa.objects.all().delete()
                Produto.objects.all().delete()
                Servico.objects.all().delete()
                self.stdout.write(self.style.SUCCESS('Dados limpos com sucesso!'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Aviso ao limpar: {e}'))

        self.stdout.write('Criando dados de exemplo...')
        
        # Obter empresa e filiais do tenant
        empresa, filiais = self._get_empresa_filiais()
        
        if empresa:
            self.stdout.write(f'  Empresa: {empresa.nome}')
            if filiais:
                self.stdout.write(f'  Filiais encontradas: {len(filiais)}')
            else:
                self.stdout.write('  Nenhuma filial encontrada - dados serão associados apenas à empresa')
        else:
            self.stdout.write(self.style.WARNING('  ⚠ Nenhuma empresa encontrada - dados serão criados como compartilhados'))
        
        # Seed Pessoas
        self._seed_pessoas(empresa, filiais)
        
        # Seed Produtos
        self._seed_produtos(empresa, filiais)
        
        # Seed Serviços
        self._seed_servicos(empresa, filiais)
        
        # Seed Financeiro (precisa de pessoas criadas primeiro)
        self._seed_contas_receber(empresa, filiais)
        self._seed_contas_pagar(empresa, filiais)
        
        # Contar registros criados (com tratamento de erro)
        try:
            pessoas_count = Pessoa.objects.count()
            produtos_count = Produto.objects.count()
            servicos_count = Servico.objects.count()
            contas_receber_count = ContaReceber.objects.count()
            contas_pagar_count = ContaPagar.objects.count()
            
            self.stdout.write(self.style.SUCCESS('\n✅ Seed concluído com sucesso!'))
            self.stdout.write(f'  - {pessoas_count} pessoas criadas')
            self.stdout.write(f'  - {produtos_count} produtos criados')
            self.stdout.write(f'  - {servicos_count} serviços criados')
            self.stdout.write(f'  - {contas_receber_count} contas a receber criadas')
            self.stdout.write(f'  - {contas_pagar_count} contas a pagar criadas')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'\n⚠ Não foi possível contar registros: {e}'))
            self.stdout.write(self.style.SUCCESS('✅ Seed executado (alguns dados podem ter sido criados)'))
    
    def _get_current_schema(self):
        """Obtém o schema atual da conexão"""
        try:
            # Tentar obter do django-tenants primeiro
            if hasattr(connection, 'schema_name') and connection.schema_name:
                return connection.schema_name
            
            # Fallback: consultar o banco
            with connection.cursor() as cursor:
                # Obter o primeiro schema do search_path (geralmente o schema do tenant)
                cursor.execute("""
                    SELECT unnest(string_to_array(current_setting('search_path'), ','))[1] as schema_name;
                """)
                result = cursor.fetchone()
                if result and result[0]:
                    # Remover espaços e aspas
                    schema = result[0].strip().strip('"')
                    return schema if schema != 'public' else None
        except Exception:
            pass
        return None
    
    def _tabelas_existem(self):
        """Verifica se as tabelas principais existem no schema atual"""
        try:
            current_schema = self._get_current_schema()
            if not current_schema:
                # Se não conseguir determinar o schema, verificar no public
                current_schema = 'public'
                
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = %s 
                        AND table_name = 'cadastros_pessoa'
                    );
                """, [current_schema])
                return cursor.fetchone()[0]
        except Exception:
            return False
    
    def _get_empresa_filiais(self):
        """
        Obtém a primeira empresa e todas as filiais ativas do tenant atual.
        Returns: (empresa, lista_filiais)
        """
        try:
            # Tentar obter empresa do tenant atual
            empresa = Empresa.objects.filter(is_active=True).first()
            
            if not empresa:
                return (None, [])
            
            # Obter todas as filiais ativas da empresa
            filiais = list(Filial.objects.filter(empresa=empresa, is_active=True))
            
            return (empresa, filiais)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  ⚠ Erro ao obter empresa/filiais: {e}'))
            return (None, [])

    def _seed_pessoas(self, empresa=None, filiais=None):
        """Cria pessoas de exemplo (clientes, fornecedores, funcionários)"""
        pessoas_data = [
            # Pessoas Físicas - Clientes
            {
                'codigo_cadastro': 1,
                'tipo': 'PF',
                'cpf_cnpj': '12345678901',
                'nome_completo': 'João Silva Santos',
                'logradouro': 'Rua das Flores',
                'numero': '123',
                'bairro': 'Centro',
                'cidade': 'Florianópolis',
                'estado': 'SC',
                'cep': '88010-000',
                'telefone_celular': '48999887766',
                'email': 'joao.silva@email.com',
            },
            {
                'codigo_cadastro': 2,
                'tipo': 'PF',
                'cpf_cnpj': '98765432100',
                'nome_completo': 'Maria Oliveira Costa',
                'logradouro': 'Avenida Beira Mar',
                'numero': '456',
                'complemento': 'Apto 101',
                'bairro': 'Beira Mar',
                'cidade': 'Florianópolis',
                'estado': 'SC',
                'cep': '88015-700',
                'telefone_fixo': '4833334444',
                'telefone_celular': '48988776655',
                'email': 'maria.oliveira@email.com',
            },
            {
                'codigo_cadastro': 3,
                'tipo': 'PF',
                'cpf_cnpj': '11122233344',
                'nome_completo': 'Carlos Eduardo Pereira',
                'logradouro': 'Rua XV de Novembro',
                'numero': '789',
                'bairro': 'Centro',
                'cidade': 'Joinville',
                'estado': 'SC',
                'cep': '89201-000',
                'telefone_celular': '47977665544',
                'email': 'carlos.pereira@email.com',
            },
            
            # Pessoas Jurídicas - Clientes
            {
                'codigo_cadastro': 10,
                'tipo': 'PJ',
                'cpf_cnpj': '12345678000190',
                'razao_social': 'Tech Solutions Ltda',
                'nome_fantasia': 'Tech Solutions',
                'contribuinte': True,
                'inscricao_estadual': '123456789',
                'logradouro': 'Avenida Paulista',
                'numero': '1000',
                'complemento': 'Sala 501',
                'bairro': 'Bela Vista',
                'cidade': 'São Paulo',
                'estado': 'SP',
                'cep': '01310-100',
                'nome_contato': 'Roberto Almeida',
                'telefone_fixo': '1133334444',
                'telefone_celular': '11988776655',
                'email': 'contato@techsolutions.com.br',
                'cargo': 'Gerente Comercial',
            },
            {
                'codigo_cadastro': 11,
                'tipo': 'PJ',
                'cpf_cnpj': '98765432000111',
                'razao_social': 'Comércio Exterior Importadora S.A.',
                'nome_fantasia': 'Importadora Global',
                'contribuinte': True,
                'inscricao_estadual': '987654321',
                'logradouro': 'Rua do Comércio',
                'numero': '500',
                'bairro': 'Centro',
                'cidade': 'Rio de Janeiro',
                'estado': 'RJ',
                'cep': '20010-000',
                'nome_contato': 'Ana Paula Souza',
                'telefone_fixo': '2122223333',
                'telefone_celular': '21977665544',
                'email': 'comercial@importadoraglobal.com.br',
                'cargo': 'Diretora Comercial',
            },
            
            # Fornecedores
            {
                'codigo_cadastro': 20,
                'tipo': 'PJ',
                'cpf_cnpj': '11223344000155',
                'razao_social': 'Fornecedora Nacional Ltda',
                'nome_fantasia': 'FornNac',
                'contribuinte': True,
                'inscricao_estadual': '112233445',
                'logradouro': 'Rodovia BR-101',
                'numero': 'KM 50',
                'bairro': 'Distrito Industrial',
                'cidade': 'Blumenau',
                'estado': 'SC',
                'cep': '89050-000',
                'nome_contato': 'Fernando Lima',
                'telefone_fixo': '4733332222',
                'telefone_celular': '47966554433',
                'email': 'vendas@fornnac.com.br',
                'cargo': 'Vendedor',
            },
            {
                'codigo_cadastro': 21,
                'tipo': 'PJ',
                'cpf_cnpj': '55667788000122',
                'razao_social': 'Importadora Internacional S.A.',
                'nome_fantasia': 'ImportInt',
                'contribuinte': True,
                'inscricao_estadual': '556677889',
                'logradouro': 'Avenida Atlântica',
                'numero': '2000',
                'bairro': 'Porto',
                'cidade': 'Itajaí',
                'estado': 'SC',
                'cep': '88301-000',
                'nome_contato': 'Patricia Mendes',
                'telefone_fixo': '4734445555',
                'telefone_celular': '47955443322',
                'email': 'compras@importint.com.br',
                'cargo': 'Gerente de Compras',
            },
            
            # Funcionários
            {
                'codigo_cadastro': 30,
                'tipo': 'PF',
                'cpf_cnpj': '99887766550',
                'nome_completo': 'Pedro Henrique Alves',
                'logradouro': 'Rua das Acácias',
                'numero': '321',
                'bairro': 'Jardim América',
                'cidade': 'Florianópolis',
                'estado': 'SC',
                'cep': '88030-000',
                'telefone_celular': '48911223344',
                'email': 'pedro.alves@empresa.com.br',
                'cargo': 'Vendedor',
                'comissoes': Decimal('5.00'),
            },
            {
                'codigo_cadastro': 31,
                'tipo': 'PF',
                'cpf_cnpj': '44332211000',
                'nome_completo': 'Juliana Ferreira',
                'logradouro': 'Rua dos Lírios',
                'numero': '654',
                'bairro': 'Trindade',
                'cidade': 'Florianópolis',
                'estado': 'SC',
                'cep': '88040-000',
                'telefone_celular': '48922334455',
                'email': 'juliana.ferreira@empresa.com.br',
                'cargo': 'Gerente de Vendas',
                'comissoes': Decimal('3.00'),
            },
        ]
        
        # Associar pessoas à empresa/filial
        pessoas_para_criar = []
        for index, data in enumerate(pessoas_data):
            pessoa_data = data.copy()
            
            # Distribuir pessoas entre filiais e algumas como compartilhadas
            if empresa:
                if filiais and len(filiais) > 0:
                    # Se tem filiais, distribuir entre elas
                    # Primeiros 30%: compartilhados (empresa=None, filial=None)
                    # Próximos 40%: primeira filial
                    # Restantes: outras filiais (se houver)
                    if index < len(pessoas_data) * 0.3:
                        # Compartilhados
                        pessoa_data['empresa'] = None
                        pessoa_data['filial'] = None
                    elif index < len(pessoas_data) * 0.7:
                        # Primeira filial
                        pessoa_data['empresa'] = empresa
                        pessoa_data['filial'] = filiais[0]
                    else:
                        # Outras filiais (distribuir)
                        if len(filiais) > 1:
                            filial_idx = ((index - int(len(pessoas_data) * 0.7)) % (len(filiais) - 1)) + 1
                        else:
                            filial_idx = 0
                        pessoa_data['empresa'] = empresa
                        pessoa_data['filial'] = filiais[filial_idx]
                else:
                    # Sem filiais, associar apenas à empresa (compartilhado na empresa)
                    pessoa_data['empresa'] = empresa
                    pessoa_data['filial'] = None
            else:
                # Sem empresa, manter como compartilhado
                pessoa_data['empresa'] = None
                pessoa_data['filial'] = None
            
            pessoas_para_criar.append(Pessoa(**pessoa_data))
        
        if pessoas_para_criar:
            try:
                Pessoa.objects.bulk_create(pessoas_para_criar, ignore_conflicts=True)
                self.stdout.write(f'  ✓ {len(pessoas_para_criar)} pessoas criadas')
            except Exception as e:
                # Se bulk_create falhar, tenta criar um por um
                criadas = 0
                for pessoa in pessoas_para_criar:
                    try:
                        pessoa.save(force_insert=True)
                        criadas += 1
                    except Exception:
                        pass
                if criadas > 0:
                    self.stdout.write(f'  ✓ {criadas} pessoas criadas (modo individual)')
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠ Nenhuma pessoa criada. Erro: {e}'))

    def _seed_produtos(self, empresa=None, filiais=None):
        """Cria produtos de exemplo"""
        produtos_data = [
            {
                'codigo_produto': 1001,
                'nome': 'Notebook Dell Inspiron 15',
                'descricao': 'Notebook 15.6" Intel Core i5, 8GB RAM, 256GB SSD',
                'ativo': True,
                'valor_custo': Decimal('2500.00'),
                'valor_venda': Decimal('3299.00'),
                'unidade_medida': 'UN',
                'peso_liquido': Decimal('2.100'),
                'peso_bruto': Decimal('2.500'),
                'codigo_ncm': '84713012',
                'cfop_interno': '5102',
                'origem_mercadoria': '1',
                'cst_icms': '00',
                'aliquota_icms': Decimal('18.00'),
                'aliquota_ipi': Decimal('15.00'),
                'moeda_negociacao': 'BRL',
            },
            {
                'codigo_produto': 1002,
                'nome': 'Mouse Logitech MX Master 3',
                'descricao': 'Mouse sem fio ergonômico para produtividade',
                'ativo': True,
                'valor_custo': Decimal('350.00'),
                'valor_venda': Decimal('499.00'),
                'unidade_medida': 'UN',
                'peso_liquido': Decimal('0.141'),
                'peso_bruto': Decimal('0.200'),
                'codigo_ncm': '84716052',
                'cfop_interno': '5102',
                'origem_mercadoria': '1',
                'cst_icms': '00',
                'aliquota_icms': Decimal('18.00'),
                'aliquota_ipi': Decimal('0.00'),
                'moeda_negociacao': 'BRL',
            },
            {
                'codigo_produto': 1003,
                'nome': 'Teclado Mecânico RGB',
                'descricao': 'Teclado mecânico com switches Cherry MX, RGB',
                'ativo': True,
                'valor_custo': Decimal('450.00'),
                'valor_venda': Decimal('699.00'),
                'unidade_medida': 'UN',
                'peso_liquido': Decimal('1.200'),
                'peso_bruto': Decimal('1.500'),
                'codigo_ncm': '84716060',
                'cfop_interno': '5102',
                'origem_mercadoria': '1',
                'cst_icms': '00',
                'aliquota_icms': Decimal('18.00'),
                'aliquota_ipi': Decimal('0.00'),
                'moeda_negociacao': 'BRL',
            },
            {
                'codigo_produto': 2001,
                'nome': 'Aço Inox 304 - Chapa',
                'descricao': 'Chapa de aço inoxidável 304, espessura 3mm',
                'ativo': True,
                'valor_custo': Decimal('85.00'),
                'valor_venda': Decimal('120.00'),
                'unidade_medida': 'M2',
                'peso_liquido': Decimal('24.000'),
                'peso_bruto': Decimal('25.000'),
                'codigo_ncm': '72191200',
                'cfop_interno': '5102',
                'origem_mercadoria': '0',
                'cst_icms': '00',
                'aliquota_icms': Decimal('18.00'),
                'aliquota_ipi': Decimal('0.00'),
                'moeda_negociacao': 'BRL',
            },
            {
                'codigo_produto': 2002,
                'nome': 'Produto Importado - Componente Eletrônico',
                'descricao': 'Componente eletrônico importado da China',
                'ativo': True,
                'valor_custo': Decimal('150.00'),
                'valor_venda': Decimal('250.00'),
                'unidade_medida': 'UN',
                'peso_liquido': Decimal('0.050'),
                'peso_bruto': Decimal('0.100'),
                'codigo_ncm': '85414011',
                'cfop_interno': '5102',
                'origem_mercadoria': '1',
                'cst_icms': '00',
                'aliquota_icms': Decimal('18.00'),
                'aliquota_ipi': Decimal('10.00'),
                'codigo_di': 'DI123456789',
                'incoterm': 'CIF',
                'moeda_negociacao': 'USD',
                'aliquota_ii': Decimal('16.00'),
            },
        ]
        
        # Associar produtos à empresa/filial (maioria compartilhada, alguns por filial)
        produtos_para_criar = []
        for index, data in enumerate(produtos_data):
            produto_data = data.copy()
            
            if empresa:
                if filiais and len(filiais) > 0:
                    # 60% compartilhados, 40% distribuídos entre filiais
                    if index < len(produtos_data) * 0.6:
                        produto_data['empresa'] = empresa
                        produto_data['filial'] = None  # Compartilhado na empresa
                    else:
                        filial_idx = (index % len(filiais))
                        produto_data['empresa'] = empresa
                        produto_data['filial'] = filiais[filial_idx]
                else:
                    # Sem filiais, associar apenas à empresa
                    produto_data['empresa'] = empresa
                    produto_data['filial'] = None
            else:
                produto_data['empresa'] = None
                produto_data['filial'] = None
            
            produtos_para_criar.append(Produto(**produto_data))
        
        if produtos_para_criar:
            try:
                Produto.objects.bulk_create(produtos_para_criar, ignore_conflicts=True)
                self.stdout.write(f'  ✓ {len(produtos_para_criar)} produtos criados')
            except Exception as e:
                criados = 0
                for produto in produtos_para_criar:
                    try:
                        produto.save(force_insert=True)
                        criados += 1
                    except Exception:
                        pass
                if criados > 0:
                    self.stdout.write(f'  ✓ {criados} produtos criados (modo individual)')
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠ Nenhum produto criado. Erro: {e}'))

    def _seed_servicos(self, empresa=None, filiais=None):
        """Cria serviços de exemplo"""
        servicos_data = [
            {
                'codigo_servico': 3001,
                'nome': 'Consultoria em Comércio Exterior',
                'descricao': 'Serviço de consultoria especializada em importação e exportação',
                'ativo': True,
                'valor_base': Decimal('5000.00'),
                'tipo_contrato': 'Mensal',
                'prazo_execucao': 30,
                'valor_impostos_estimado': Decimal('900.00'),
                'codigo_ncm': '85234900',
                'cfop': '1403',
                'tributacao_pis': Decimal('1.65'),
                'tributacao_cofins': Decimal('7.60'),
                'icms_tributado': False,
            },
            {
                'codigo_servico': 3002,
                'nome': 'Despacho Aduaneiro',
                'descricao': 'Serviço completo de despacho aduaneiro para importação',
                'ativo': True,
                'valor_base': Decimal('1500.00'),
                'tipo_contrato': 'Avulso',
                'prazo_execucao': 5,
                'valor_impostos_estimado': Decimal('270.00'),
                'codigo_ncm': '85234900',
                'cfop': '1403',
                'tributacao_pis': Decimal('1.65'),
                'tributacao_cofins': Decimal('7.60'),
                'icms_tributado': False,
            },
            {
                'codigo_servico': 3003,
                'nome': 'Gestão de Documentação',
                'descricao': 'Gestão completa de documentação para exportação',
                'ativo': True,
                'valor_base': Decimal('800.00'),
                'tipo_contrato': 'Avulso',
                'prazo_execucao': 3,
                'valor_impostos_estimado': Decimal('144.00'),
                'codigo_ncm': '85234900',
                'cfop': '1403',
                'tributacao_pis': Decimal('1.65'),
                'tributacao_cofins': Decimal('7.60'),
                'icms_tributado': False,
            },
            {
                'codigo_servico': 3004,
                'nome': 'Análise de Viabilidade de Importação',
                'descricao': 'Análise completa de viabilidade técnica e econômica',
                'ativo': True,
                'valor_base': Decimal('2500.00'),
                'tipo_contrato': 'Projeto',
                'prazo_execucao': 15,
                'valor_impostos_estimado': Decimal('450.00'),
                'codigo_ncm': '85234900',
                'cfop': '1403',
                'tributacao_pis': Decimal('1.65'),
                'tributacao_cofins': Decimal('7.60'),
                'icms_tributado': False,
            },
            {
                'codigo_servico': 3005,
                'nome': 'Suporte Técnico Especializado',
                'descricao': 'Suporte técnico especializado em sistemas de gestão',
                'ativo': True,
                'valor_base': Decimal('3000.00'),
                'tipo_contrato': 'Mensal',
                'prazo_execucao': None,
                'valor_impostos_estimado': Decimal('540.00'),
                'codigo_ncm': '85234900',
                'cfop': '1403',
                'tributacao_pis': Decimal('1.65'),
                'tributacao_cofins': Decimal('7.60'),
                'icms_tributado': False,
            },
        ]
        
        # Associar serviços à empresa/filial (maioria compartilhada)
        servicos_para_criar = []
        for index, data in enumerate(servicos_data):
            servico_data = data.copy()
            
            if empresa:
                # Serviços geralmente são compartilhados na empresa
                servico_data['empresa'] = empresa
                servico_data['filial'] = None
            else:
                servico_data['empresa'] = None
                servico_data['filial'] = None
            
            servicos_para_criar.append(Servico(**servico_data))
        
        if servicos_para_criar:
            try:
                Servico.objects.bulk_create(servicos_para_criar, ignore_conflicts=True)
                self.stdout.write(f'  ✓ {len(servicos_para_criar)} serviços criados')
            except Exception as e:
                criados = 0
                for servico in servicos_para_criar:
                    try:
                        servico.save(force_insert=True)
                        criados += 1
                    except Exception:
                        pass
                if criados > 0:
                    self.stdout.write(f'  ✓ {criados} serviços criados (modo individual)')
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠ Nenhum serviço criado. Erro: {e}'))

    def _seed_contas_receber(self, empresa=None, filiais=None):
        """Cria contas a receber de exemplo"""
        try:
            # Buscar clientes (PJ) - já filtrados por empresa/filial se aplicável
            clientes = list(Pessoa.objects.filter(tipo='PJ')[:2])
            if not clientes:
                self.stdout.write(self.style.WARNING('  ⚠ Nenhum cliente encontrado. Criando contas a receber ignorado.'))
                return
            
            hoje = date.today()
            contas_data = [
                {
                    'codigo_conta': 1,
                    'numero_documento': 'CR-001/2024',
                    'cliente': clientes[0],
                    'valor_total': Decimal('5000.00'),
                    'valor_recebido': Decimal('0.00'),
                    'data_emissao': hoje - timedelta(days=10),
                    'data_vencimento': hoje + timedelta(days=20),
                    'status': 'Pendente',
                    'forma_pagamento': 'Boleto',
                    'descricao': 'Prestação de serviços de consultoria',
                },
                {
                    'codigo_conta': 2,
                    'numero_documento': 'CR-002/2024',
                    'cliente': clientes[0] if len(clientes) > 0 else clientes[0],
                    'valor_total': Decimal('15000.00'),
                    'valor_recebido': Decimal('5000.00'),
                    'data_emissao': hoje - timedelta(days=30),
                    'data_vencimento': hoje - timedelta(days=5),
                    'status': 'Parcial',
                    'forma_pagamento': 'PIX',
                    'descricao': 'Venda de produtos - parcela 1 de 3',
                },
                {
                    'codigo_conta': 3,
                    'numero_documento': 'CR-003/2024',
                    'cliente': clientes[1] if len(clientes) > 1 else clientes[0],
                    'valor_total': Decimal('8000.00'),
                    'valor_recebido': Decimal('8000.00'),
                    'data_emissao': hoje - timedelta(days=45),
                    'data_vencimento': hoje - timedelta(days=15),
                    'data_recebimento': hoje - timedelta(days=10),
                    'status': 'Pago',
                    'forma_pagamento': 'Transferência',
                    'descricao': 'Serviço de despacho aduaneiro',
                },
                {
                    'codigo_conta': 4,
                    'numero_documento': 'CR-004/2024',
                    'cliente': clientes[0],
                    'valor_total': Decimal('3000.00'),
                    'valor_recebido': Decimal('0.00'),
                    'data_emissao': hoje - timedelta(days=60),
                    'data_vencimento': hoje - timedelta(days=30),
                    'status': 'Vencido',
                    'forma_pagamento': 'Boleto',
                    'descricao': 'Conta vencida - aguardando pagamento',
                },
            ]
            
            # Associar contas à empresa/filial (usar mesma empresa/filial do cliente)
            contas_para_criar = []
            for index, data in enumerate(contas_data):
                conta_data = data.copy()
                cliente = conta_data.get('cliente')
                
                # Usar empresa/filial do cliente, ou empresa/filial padrão
                if cliente and hasattr(cliente, 'empresa') and cliente.empresa:
                    conta_data['empresa'] = cliente.empresa
                    conta_data['filial'] = cliente.filial if hasattr(cliente, 'filial') else None
                elif empresa:
                    # Se cliente não tem empresa, usar empresa padrão
                    if filiais and len(filiais) > 0:
                        # Distribuir entre filiais
                        filial_idx = index % len(filiais)
                        conta_data['empresa'] = empresa
                        conta_data['filial'] = filiais[filial_idx]
                    else:
                        conta_data['empresa'] = empresa
                        conta_data['filial'] = None
                else:
                    conta_data['empresa'] = None
                    conta_data['filial'] = None
                
                contas_para_criar.append(ContaReceber(**conta_data))
            
            if contas_para_criar:
                try:
                    ContaReceber.objects.bulk_create(contas_para_criar, ignore_conflicts=True)
                    self.stdout.write(f'  ✓ {len(contas_para_criar)} contas a receber criadas')
                except Exception as e:
                    criadas = 0
                    for conta in contas_para_criar:
                        try:
                            conta.save(force_insert=True)
                            criadas += 1
                        except Exception:
                            pass
                    if criadas > 0:
                        self.stdout.write(f'  ✓ {criadas} contas a receber criadas (modo individual)')
                    else:
                        self.stdout.write(self.style.WARNING(f'  ⚠ Nenhuma conta a receber criada. Erro: {e}'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  ⚠ Erro ao criar contas a receber: {e}'))

    def _seed_contas_pagar(self, empresa=None, filiais=None):
        """Cria contas a pagar de exemplo"""
        try:
            # Buscar fornecedores (PJ) - já filtrados por empresa/filial se aplicável
            fornecedores = list(Pessoa.objects.filter(tipo='PJ').exclude(codigo_cadastro__in=[10, 11])[:2])
            if not fornecedores:
                self.stdout.write(self.style.WARNING('  ⚠ Nenhum fornecedor encontrado. Criando contas a pagar ignorado.'))
                return
            
            hoje = date.today()
            contas_data = [
                {
                    'codigo_conta': 1,
                    'numero_documento': 'CP-001/2024',
                    'fornecedor': fornecedores[0],
                    'valor_total': Decimal('12000.00'),
                    'valor_pago': Decimal('0.00'),
                    'data_emissao': hoje - timedelta(days=5),
                    'data_vencimento': hoje + timedelta(days=25),
                    'status': 'Pendente',
                    'forma_pagamento': 'Boleto',
                    'descricao': 'Compra de materiais para estoque',
                },
                {
                    'codigo_conta': 2,
                    'numero_documento': 'CP-002/2024',
                    'fornecedor': fornecedores[0] if len(fornecedores) > 0 else fornecedores[0],
                    'valor_total': Decimal('8500.00'),
                    'valor_pago': Decimal('4250.00'),
                    'data_emissao': hoje - timedelta(days=20),
                    'data_vencimento': hoje + timedelta(days=10),
                    'status': 'Parcial',
                    'forma_pagamento': 'PIX',
                    'descricao': 'Serviços de importação - parcela 1 de 2',
                },
                {
                    'codigo_conta': 3,
                    'numero_documento': 'CP-003/2024',
                    'fornecedor': fornecedores[1] if len(fornecedores) > 1 else fornecedores[0],
                    'valor_total': Decimal('6000.00'),
                    'valor_pago': Decimal('6000.00'),
                    'data_emissao': hoje - timedelta(days=40),
                    'data_vencimento': hoje - timedelta(days=10),
                    'data_pagamento': hoje - timedelta(days=8),
                    'status': 'Pago',
                    'forma_pagamento': 'Transferência',
                    'descricao': 'Pagamento de fornecedor - quitado',
                },
                {
                    'codigo_conta': 4,
                    'numero_documento': 'CP-004/2024',
                    'fornecedor': fornecedores[0],
                    'valor_total': Decimal('4500.00'),
                    'valor_pago': Decimal('0.00'),
                    'data_emissao': hoje - timedelta(days=50),
                    'data_vencimento': hoje - timedelta(days=20),
                    'status': 'Vencido',
                    'forma_pagamento': 'Boleto',
                    'descricao': 'Conta vencida - aguardando pagamento',
                },
            ]
            
            # Associar contas à empresa/filial (usar mesma empresa/filial do fornecedor)
            contas_para_criar = []
            for index, data in enumerate(contas_data):
                conta_data = data.copy()
                fornecedor = conta_data.get('fornecedor')
                
                # Usar empresa/filial do fornecedor, ou empresa/filial padrão
                if fornecedor and hasattr(fornecedor, 'empresa') and fornecedor.empresa:
                    conta_data['empresa'] = fornecedor.empresa
                    conta_data['filial'] = fornecedor.filial if hasattr(fornecedor, 'filial') else None
                elif empresa:
                    # Se fornecedor não tem empresa, usar empresa padrão
                    if filiais and len(filiais) > 0:
                        # Distribuir entre filiais
                        filial_idx = index % len(filiais)
                        conta_data['empresa'] = empresa
                        conta_data['filial'] = filiais[filial_idx]
                    else:
                        conta_data['empresa'] = empresa
                        conta_data['filial'] = None
                else:
                    conta_data['empresa'] = None
                    conta_data['filial'] = None
                
                contas_para_criar.append(ContaPagar(**conta_data))
            
            if contas_para_criar:
                try:
                    ContaPagar.objects.bulk_create(contas_para_criar, ignore_conflicts=True)
                    self.stdout.write(f'  ✓ {len(contas_para_criar)} contas a pagar criadas')
                except Exception as e:
                    criadas = 0
                    for conta in contas_para_criar:
                        try:
                            conta.save(force_insert=True)
                            criadas += 1
                        except Exception:
                            pass
                    if criadas > 0:
                        self.stdout.write(f'  ✓ {criadas} contas a pagar criadas (modo individual)')
                    else:
                        self.stdout.write(self.style.WARNING(f'  ⚠ Nenhuma conta a pagar criada. Erro: {e}'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  ⚠ Erro ao criar contas a pagar: {e}'))

