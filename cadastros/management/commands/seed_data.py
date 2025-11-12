"""
Comando para popular o banco de dados com dados de exemplo (seed)
Uso: python manage.py seed_data [--clear] [--migrate]
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction, connection
from decimal import Decimal
from cadastros.models import Pessoa, Produto, Servico


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
                Pessoa.objects.all().delete()
                Produto.objects.all().delete()
                Servico.objects.all().delete()
                self.stdout.write(self.style.SUCCESS('Dados limpos com sucesso!'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Aviso ao limpar: {e}'))

        self.stdout.write('Criando dados de exemplo...')
        
        # Seed Pessoas
        self._seed_pessoas()
        
        # Seed Produtos
        self._seed_produtos()
        
        # Seed Serviços
        self._seed_servicos()
        
        # Contar registros criados (com tratamento de erro)
        try:
            pessoas_count = Pessoa.objects.count()
            produtos_count = Produto.objects.count()
            servicos_count = Servico.objects.count()
            
            self.stdout.write(self.style.SUCCESS('\n✅ Seed concluído com sucesso!'))
            self.stdout.write(f'  - {pessoas_count} pessoas criadas')
            self.stdout.write(f'  - {produtos_count} produtos criados')
            self.stdout.write(f'  - {servicos_count} serviços criados')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'\n⚠ Não foi possível contar registros: {e}'))
            self.stdout.write(self.style.SUCCESS('✅ Seed executado (alguns dados podem ter sido criados)'))
    
    def _tabelas_existem(self):
        """Verifica se as tabelas principais existem"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'cadastros_pessoa'
                    );
                """)
                return cursor.fetchone()[0]
        except Exception:
            return False

    def _seed_pessoas(self):
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
        
        pessoas_para_criar = [Pessoa(**data) for data in pessoas_data]
        
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

    def _seed_produtos(self):
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
        
        produtos_para_criar = [Produto(**data) for data in produtos_data]
        
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

    def _seed_servicos(self):
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
        
        servicos_para_criar = [Servico(**data) for data in servicos_data]
        
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

