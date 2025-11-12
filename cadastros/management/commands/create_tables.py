"""
Comando para criar as tabelas manualmente (workaround para django-tenants)
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Cria as tabelas manualmente no schema público'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Criar tabela cadastros_pessoa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cadastros_pessoa (
                    codigo_cadastro INTEGER PRIMARY KEY,
                    tipo VARCHAR(2) DEFAULT 'PF',
                    cpf_cnpj VARCHAR(18) UNIQUE,
                    nome_completo VARCHAR(255),
                    razao_social VARCHAR(255),
                    nome_fantasia VARCHAR(255),
                    inscricao_estadual VARCHAR(20),
                    contribuinte BOOLEAN DEFAULT TRUE,
                    logradouro VARCHAR(255),
                    numero VARCHAR(10),
                    letra VARCHAR(2),
                    complemento VARCHAR(100),
                    bairro VARCHAR(100),
                    cidade VARCHAR(100),
                    estado VARCHAR(2) DEFAULT 'SC',
                    cep VARCHAR(9) DEFAULT '99999-999',
                    nome_contato VARCHAR(100),
                    telefone_fixo VARCHAR(15),
                    telefone_celular VARCHAR(15),
                    email VARCHAR(255),
                    cargo VARCHAR(100),
                    comissoes DECIMAL(5,2) DEFAULT 0.00,
                    observacoes TEXT
                );
            """)
            
            # Criar tabela cadastros_produto
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cadastros_produto (
                    codigo_produto INTEGER PRIMARY KEY,
                    nome VARCHAR(255),
                    descricao TEXT,
                    ativo BOOLEAN DEFAULT TRUE,
                    valor_custo DECIMAL(10,2) DEFAULT 0.00,
                    valor_venda DECIMAL(10,2) DEFAULT 0.00,
                    unidade_medida VARCHAR(10) DEFAULT 'UN',
                    peso_liquido DECIMAL(10,3),
                    peso_bruto DECIMAL(10,3),
                    codigo_ncm VARCHAR(10),
                    cfop_interno VARCHAR(4),
                    origem_mercadoria VARCHAR(2) DEFAULT '0',
                    cst_icms VARCHAR(3),
                    aliquota_icms DECIMAL(5,2) DEFAULT 0.00,
                    aliquota_ipi DECIMAL(5,2) DEFAULT 0.00,
                    codigo_di VARCHAR(20),
                    incoterm VARCHAR(10),
                    moeda_negociacao VARCHAR(3) DEFAULT 'BRL',
                    aliquota_ii DECIMAL(5,2) DEFAULT 0.00
                );
            """)
            
            # Criar tabela cadastros_servico
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cadastros_servico (
                    codigo_servico INTEGER PRIMARY KEY,
                    nome VARCHAR(255),
                    descricao TEXT,
                    ativo BOOLEAN DEFAULT TRUE,
                    valor_base DECIMAL(10,2),
                    tipo_contrato VARCHAR(50) DEFAULT 'Avulso',
                    prazo_execucao INTEGER,
                    valor_impostos_estimado DECIMAL(10,2) DEFAULT 0.00,
                    codigo_ncm VARCHAR(10),
                    cfop VARCHAR(4),
                    tributacao_pis DECIMAL(5,2) DEFAULT 0.00,
                    tributacao_cofins DECIMAL(5,2) DEFAULT 0.00,
                    icms_tributado BOOLEAN DEFAULT FALSE
                );
            """)
            
            self.stdout.write(self.style.SUCCESS('✅ Tabelas criadas com sucesso!'))

