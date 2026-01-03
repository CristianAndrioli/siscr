"""
Testes unitários para os modelos do módulo de Estoque
"""
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context
from decimal import Decimal
from tenants.models import Tenant, Domain, Empresa, Filial
from cadastros.models import Produto
from estoque.models import Location, Estoque, MovimentacaoEstoque, ReservaEstoque, PrevisaoMovimentacao
from estoque.services import (
    processar_entrada_estoque,
    processar_saida_estoque,
    calcular_custo_medio_ponderado,
    validar_location_permite_entrada,
    validar_location_permite_saida,
    validar_estoque_disponivel,
    validar_filial_pertence_empresa,
    criar_reserva,
    confirmar_reserva,
    cancelar_reserva,
    processar_transferencia,
    EstoqueServiceError
)
from estoque.models import GrupoFilial
from django.utils import timezone
from datetime import timedelta
from subscriptions.models import Plan

User = get_user_model()


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class LocationModelTests(TestCase):
    """Testes para o modelo Location"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        # Criar tenant de teste
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_estoque',
                name='Tenant de Teste Estoque',
                is_active=True
            )
            Domain.objects.create(
                domain='test-estoque.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            # Criar plano
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        # Criar dados no schema do tenant
        with schema_context(self.tenant.schema_name):
            # Criar empresa
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            # Criar filial
            self.filial = Filial.objects.create(
                empresa=self.empresa,
                nome='Filial Teste',
                codigo_filial='FIL001',
                cidade='Rio de Janeiro',
                estado='RJ',
                is_active=True
            )
    
    def test_create_location_with_empresa_only(self):
        """Testa criação de location vinculada apenas à empresa (sem filial)"""
        with schema_context(self.tenant.schema_name):
            location = Location.objects.create(
                empresa=self.empresa,
                filial=None,
                nome='Loja Central',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.assertEqual(location.empresa, self.empresa)
            self.assertIsNone(location.filial)
            self.assertEqual(location.nome, 'Loja Central')
            self.assertEqual(location.codigo, 'LOC001')
            self.assertEqual(location.tipo, 'LOJA')
    
    def test_create_location_with_filial(self):
        """Testa criação de location vinculada à empresa e filial"""
        with schema_context(self.tenant.schema_name):
            location = Location.objects.create(
                empresa=self.empresa,
                filial=self.filial,
                nome='Loja Filial',
                codigo='LOC002',
                tipo='LOJA',
                logradouro='Rua Filial',
                numero='456',
                bairro='Copacabana',
                cidade='Rio de Janeiro',
                estado='RJ',
                cep='22000-000',
                is_active=True
            )
            
            self.assertEqual(location.empresa, self.empresa)
            self.assertEqual(location.filial, self.filial)
            self.assertEqual(location.filial.empresa, self.empresa)
    
    def test_location_endereco_completo(self):
        """Testa a propriedade endereco_completo"""
        with schema_context(self.tenant.schema_name):
            location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Completa',
                codigo='LOC003',
                tipo='LOJA',
                logradouro='Avenida Principal',
                numero='789',
                letra='A',
                complemento='Sala 101',
                bairro='Jardim Teste',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            endereco = location.endereco_completo
            self.assertIn('Avenida Principal', endereco)
            self.assertIn('789', endereco)
            self.assertIn('A', endereco)
            self.assertIn('Sala 101', endereco)
            self.assertIn('Jardim Teste', endereco)
            self.assertIn('São Paulo/SP', endereco)
            self.assertIn('01234-567', endereco)
    
    def test_location_str_representation(self):
        """Testa a representação string do modelo"""
        with schema_context(self.tenant.schema_name):
            location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Teste',
                codigo='LOC004',
                tipo='ARMAZEM',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            str_repr = str(location)
            self.assertIn('Loja Teste', str_repr)
            self.assertIn('Armazém', str_repr)
    
    def test_location_unique_codigo(self):
        """Testa que código de location deve ser único no tenant"""
        with schema_context(self.tenant.schema_name):
            Location.objects.create(
                empresa=self.empresa,
                nome='Loja 1',
                codigo='LOC005',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            # Tentar criar outra location com mesmo código deve falhar
            with self.assertRaises(Exception):  # IntegrityError ou ValidationError
                Location.objects.create(
                    empresa=self.empresa,
                    nome='Loja 2',
                    codigo='LOC005',  # Código duplicado
                    tipo='LOJA',
                    logradouro='Rua Teste',
                    numero='123',
                    bairro='Centro',
                    cidade='São Paulo',
                    estado='SP',
                    cep='01234-567',
                    is_active=True
                )
    
    def test_location_default_permissions(self):
        """Testa que location permite entrada, saída e transferência por padrão"""
        with schema_context(self.tenant.schema_name):
            location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Padrão',
                codigo='LOC006',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.assertTrue(location.permite_entrada)
            self.assertTrue(location.permite_saida)
            self.assertTrue(location.permite_transferencia)


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class EstoqueModelTests(TestCase):
    """Testes para o modelo Estoque"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        # Criar tenant de teste
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_estoque',
                name='Tenant de Teste Estoque',
                is_active=True
            )
            Domain.objects.create(
                domain='test-estoque.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        # Criar dados no schema do tenant
        with schema_context(self.tenant.schema_name):
            # Criar empresa
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            # Criar location
            self.location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Central',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            # Criar produto
            self.produto = Produto.objects.create(
                nome='Produto Teste',
                codigo='PROD001',
                tipo='PRODUTO',
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                is_active=True
            )
    
    def test_create_estoque(self):
        """Testa criação de estoque"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('10.000'),
                valor_custo_medio=Decimal('10.50'),
                estoque_minimo=Decimal('20.000'),
                estoque_maximo=Decimal('500.000')
            )
            
            self.assertEqual(estoque.produto, self.produto)
            self.assertEqual(estoque.location, self.location)
            self.assertEqual(estoque.empresa, self.empresa)
            self.assertEqual(estoque.quantidade_atual, Decimal('100.000'))
            self.assertEqual(estoque.quantidade_reservada, Decimal('10.000'))
    
    def test_estoque_quantidade_disponivel_calculation(self):
        """Testa cálculo automático de quantidade disponível"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('10.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            # Quantidade disponível = atual - reservada
            self.assertEqual(estoque.quantidade_disponivel, Decimal('90.000'))
    
    def test_estoque_valor_total_calculation(self):
        """Testa cálculo automático de valor total"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            # Valor total = quantidade_atual * valor_custo_medio
            valor_esperado = Decimal('100.000') * Decimal('10.50')
            self.assertEqual(estoque.valor_total, valor_esperado)
    
    def test_estoque_quantidade_disponivel_com_prevista(self):
        """Testa cálculo de quantidade disponível com previsões"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('10.000'),
                quantidade_prevista_entrada=Decimal('50.000'),
                quantidade_prevista_saida=Decimal('20.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            # Disponível com prevista = atual - reservada + prevista_entrada - prevista_saida
            # = 100 - 10 + 50 - 20 = 120
            disponivel_com_prevista = estoque.quantidade_disponivel_com_prevista
            self.assertEqual(disponivel_com_prevista, Decimal('120.000'))
    
    def test_estoque_abaixo_minimo(self):
        """Testa verificação de estoque abaixo do mínimo"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('15.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50'),
                estoque_minimo=Decimal('20.000')
            )
            
            self.assertTrue(estoque.abaixo_estoque_minimo)
            
            # Aumentar quantidade acima do mínimo
            estoque.quantidade_atual = Decimal('25.000')
            estoque.save()
            self.assertFalse(estoque.abaixo_estoque_minimo)
    
    def test_estoque_unique_together(self):
        """Testa que produto + location deve ser único"""
        with schema_context(self.tenant.schema_name):
            Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            # Tentar criar outro estoque com mesmo produto e location deve falhar
            with self.assertRaises(Exception):  # IntegrityError
                Estoque.objects.create(
                    produto=self.produto,
                    location=self.location,
                    empresa=self.empresa,
                    quantidade_atual=Decimal('50.000'),
                    valor_custo_medio=Decimal('10.50')
                )


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class MovimentacaoEstoqueModelTests(TestCase):
    """Testes para o modelo MovimentacaoEstoque"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        # Criar tenant de teste
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_estoque',
                name='Tenant de Teste Estoque',
                is_active=True
            )
            Domain.objects.create(
                domain='test-estoque.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        # Criar dados no schema do tenant
        with schema_context(self.tenant.schema_name):
            # Criar empresa
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            # Criar locations
            self.location_origem = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Origem',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Origem',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.location_destino = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Destino',
                codigo='LOC002',
                tipo='LOJA',
                logradouro='Rua Destino',
                numero='456',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            # Criar produto
            self.produto = Produto.objects.create(
                nome='Produto Teste',
                codigo='PROD001',
                tipo='PRODUTO',
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                is_active=True
            )
            
            # Criar estoque
            self.estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location_origem,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
    
    def test_create_movimentacao_entrada(self):
        """Testa criação de movimentação de entrada"""
        with schema_context(self.tenant.schema_name):
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='CONFIRMADA',
                quantidade=Decimal('50.000'),
                quantidade_anterior=Decimal('100.000'),
                quantidade_posterior=Decimal('150.000'),
                valor_unitario=Decimal('10.50'),
                location_destino=self.location_origem,
                documento_referencia='OC001'
            )
            
            self.assertEqual(movimentacao.tipo, 'ENTRADA')
            self.assertEqual(movimentacao.origem, 'COMPRA')
            self.assertEqual(movimentacao.status, 'CONFIRMADA')
            self.assertEqual(movimentacao.quantidade, Decimal('50.000'))
            self.assertEqual(movimentacao.valor_total, Decimal('50.000') * Decimal('10.50'))
    
    def test_create_movimentacao_saida(self):
        """Testa criação de movimentação de saída"""
        with schema_context(self.tenant.schema_name):
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='SAIDA',
                origem='VENDA',
                status='CONFIRMADA',
                quantidade=Decimal('30.000'),
                quantidade_anterior=Decimal('100.000'),
                quantidade_posterior=Decimal('70.000'),
                valor_unitario=Decimal('10.50'),
                location_origem=self.location_origem,
                documento_referencia='PV001'
            )
            
            self.assertEqual(movimentacao.tipo, 'SAIDA')
            self.assertEqual(movimentacao.origem, 'VENDA')
            self.assertEqual(movimentacao.quantidade, Decimal('30.000'))
    
    def test_create_movimentacao_transferencia(self):
        """Testa criação de movimentação de transferência"""
        with schema_context(self.tenant.schema_name):
            # Criar estoque de destino
            estoque_destino = Estoque.objects.create(
                produto=self.produto,
                location=self.location_destino,
                empresa=self.empresa,
                quantidade_atual=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='TRANSFERENCIA',
                origem='TRANSFERENCIA',
                status='CONFIRMADA',
                quantidade=Decimal('20.000'),
                quantidade_anterior=Decimal('100.000'),
                quantidade_posterior=Decimal('80.000'),
                valor_unitario=Decimal('10.50'),
                location_origem=self.location_origem,
                location_destino=self.location_destino,
                documento_referencia='TRF001'
            )
            
            self.assertEqual(movimentacao.tipo, 'TRANSFERENCIA')
            self.assertEqual(movimentacao.location_origem, self.location_origem)
            self.assertEqual(movimentacao.location_destino, self.location_destino)
    
    def test_movimentacao_valor_total_calculation(self):
        """Testa cálculo automático de valor total"""
        with schema_context(self.tenant.schema_name):
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='CONFIRMADA',
                quantidade=Decimal('25.000'),
                valor_unitario=Decimal('12.50')
            )
            
            # Valor total = quantidade * valor_unitario
            valor_esperado = Decimal('25.000') * Decimal('12.50')
            self.assertEqual(movimentacao.valor_total, valor_esperado)
    
    def test_movimentacao_calcular_impacto_estoque(self):
        """Testa cálculo de impacto no estoque"""
        with schema_context(self.tenant.schema_name):
            # Movimentação de entrada
            mov_entrada = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='CONFIRMADA',
                quantidade=Decimal('50.000'),
                valor_unitario=Decimal('10.50')
            )
            self.assertEqual(mov_entrada.calcular_impacto_estoque(), Decimal('50.000'))
            
            # Movimentação de saída
            mov_saida = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='SAIDA',
                origem='VENDA',
                status='CONFIRMADA',
                quantidade=Decimal('30.000'),
                valor_unitario=Decimal('10.50')
            )
            self.assertEqual(mov_saida.calcular_impacto_estoque(), Decimal('-30.000'))
    
    def test_movimentacao_reverter(self):
        """Testa reversão de movimentação"""
        with schema_context(self.tenant.schema_name):
            # Criar movimentação de saída
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='SAIDA',
                origem='VENDA',
                status='CONFIRMADA',
                quantidade=Decimal('30.000'),
                quantidade_anterior=Decimal('100.000'),
                quantidade_posterior=Decimal('70.000'),
                valor_unitario=Decimal('10.50'),
                location_origem=self.location_origem,
                documento_referencia='PV001',
                numero_nota_fiscal='123',
                serie_nota_fiscal='1'
            )
            
            # Atualizar estoque para refletir a saída
            self.estoque.quantidade_atual = Decimal('70.000')
            self.estoque.save()
            
            # Reverter movimentação
            movimentacao_reversa = movimentacao.reverter(motivo='Cancelamento de NF')
            
            # Verificar que movimentação original foi marcada como revertida
            movimentacao.refresh_from_db()
            self.assertEqual(movimentacao.status, 'REVERTIDA')
            
            # Verificar que movimentação reversa foi criada
            self.assertIsNotNone(movimentacao_reversa)
            self.assertEqual(movimentacao_reversa.tipo, 'ENTRADA')
            self.assertEqual(movimentacao_reversa.origem, 'CANCELAMENTO_NF')
            self.assertEqual(movimentacao_reversa.quantidade, Decimal('30.000'))
            self.assertEqual(movimentacao_reversa.movimentacao_original, movimentacao)
            
            # Verificar que estoque foi atualizado
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_atual, Decimal('100.000'))
    
    def test_movimentacao_quantidade_sempre_positiva(self):
        """Testa que quantidade é sempre positiva (validação)"""
        with schema_context(self.tenant.schema_name):
            # Tentar criar movimentação com quantidade zero deve falhar
            with self.assertRaises(ValidationError):
                movimentacao = MovimentacaoEstoque(
                    estoque=self.estoque,
                    tipo='ENTRADA',
                    origem='COMPRA',
                    quantidade=Decimal('0.000'),
                    valor_unitario=Decimal('10.50')
                )
                movimentacao.full_clean()


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class EstoqueServicesTests(TestCase):
    """Testes para os serviços de estoque"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        # Criar tenant de teste
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_estoque_services',
                name='Tenant de Teste Services',
                is_active=True
            )
            Domain.objects.create(
                domain='test-services.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        # Criar dados no schema do tenant
        with schema_context(self.tenant.schema_name):
            # Criar empresa
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            # Criar filial
            self.filial = Filial.objects.create(
                empresa=self.empresa,
                nome='Filial Teste',
                codigo_filial='FIL001',
                cidade='Rio de Janeiro',
                estado='RJ',
                is_active=True
            )
            
            # Criar locations
            self.location_entrada = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Entrada',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Entrada',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                permite_entrada=True,
                permite_saida=True,
                is_active=True
            )
            
            self.location_saida = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Saída',
                codigo='LOC002',
                tipo='LOJA',
                logradouro='Rua Saída',
                numero='456',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                permite_entrada=True,
                permite_saida=True,
                is_active=True
            )
            
            self.location_sem_entrada = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Sem Entrada',
                codigo='LOC003',
                tipo='LOJA',
                logradouro='Rua Sem Entrada',
                numero='789',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                permite_entrada=False,
                permite_saida=True,
                is_active=True
            )
            
            # Criar produto
            self.produto = Produto.objects.create(
                nome='Produto Teste',
                codigo='PROD001',
                tipo='PRODUTO',
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                is_active=True
            )
    
    def test_processar_entrada_estoque_criar_novo(self):
        """Testa processar entrada de estoque criando novo estoque"""
        with schema_context(self.tenant.schema_name):
            resultado = processar_entrada_estoque(
                produto=self.produto,
                location=self.location_entrada,
                empresa=self.empresa,
                quantidade=Decimal('100.000'),
                valor_unitario=Decimal('10.50'),
                origem='COMPRA',
                documento_referencia='OC001'
            )
            
            estoque = resultado['estoque']
            movimentacao = resultado['movimentacao']
            
            # Verificar estoque
            self.assertEqual(estoque.quantidade_atual, Decimal('100.000'))
            self.assertEqual(estoque.valor_custo_medio, Decimal('10.50'))
            self.assertEqual(estoque.quantidade_disponivel, Decimal('100.000'))
            
            # Verificar movimentação
            self.assertEqual(movimentacao.tipo, 'ENTRADA')
            self.assertEqual(movimentacao.origem, 'COMPRA')
            self.assertEqual(movimentacao.quantidade, Decimal('100.000'))
            self.assertEqual(movimentacao.quantidade_anterior, Decimal('0.000'))
            self.assertEqual(movimentacao.quantidade_posterior, Decimal('100.000'))
    
    def test_processar_entrada_estoque_atualizar_existente(self):
        """Testa processar entrada de estoque atualizando estoque existente"""
        with schema_context(self.tenant.schema_name):
            # Criar estoque inicial
            estoque_inicial = Estoque.objects.create(
                produto=self.produto,
                location=self.location_entrada,
                empresa=self.empresa,
                quantidade_atual=Decimal('50.000'),
                valor_custo_medio=Decimal('10.00')
            )
            
            # Processar entrada
            resultado = processar_entrada_estoque(
                produto=self.produto,
                location=self.location_entrada,
                empresa=self.empresa,
                quantidade=Decimal('50.000'),
                valor_unitario=Decimal('11.00'),
                origem='COMPRA'
            )
            
            estoque = resultado['estoque']
            
            # Verificar que é o mesmo estoque
            self.assertEqual(estoque.id, estoque_inicial.id)
            
            # Verificar quantidade
            self.assertEqual(estoque.quantidade_atual, Decimal('100.000'))
            
            # Verificar custo médio ponderado
            # (50 * 10.00 + 50 * 11.00) / 100 = 10.50
            self.assertEqual(estoque.valor_custo_medio, Decimal('10.50'))
    
    def test_processar_entrada_estoque_location_sem_entrada(self):
        """Testa erro ao processar entrada em location que não permite entrada"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError) as context:
                processar_entrada_estoque(
                    produto=self.produto,
                    location=self.location_sem_entrada,
                    empresa=self.empresa,
                    quantidade=Decimal('100.000'),
                    valor_unitario=Decimal('10.50')
                )
            
            self.assertIn('não permite entrada', str(context.exception))
    
    def test_processar_entrada_estoque_quantidade_invalida(self):
        """Testa erro ao processar entrada com quantidade inválida"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError):
                processar_entrada_estoque(
                    produto=self.produto,
                    location=self.location_entrada,
                    empresa=self.empresa,
                    quantidade=Decimal('0.000'),
                    valor_unitario=Decimal('10.50')
                )
    
    def test_processar_saida_estoque_sucesso(self):
        """Testa processar saída de estoque com sucesso"""
        with schema_context(self.tenant.schema_name):
            # Criar estoque inicial
            estoque_inicial = Estoque.objects.create(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('10.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            # Processar saída
            resultado = processar_saida_estoque(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade=Decimal('30.000'),
                valor_unitario=Decimal('10.50'),
                origem='VENDA',
                documento_referencia='PV001'
            )
            
            estoque = resultado['estoque']
            movimentacao = resultado['movimentacao']
            
            # Verificar estoque
            self.assertEqual(estoque.quantidade_atual, Decimal('70.000'))
            self.assertEqual(estoque.quantidade_disponivel, Decimal('60.000'))  # 70 - 10 reservada
            
            # Verificar movimentação
            self.assertEqual(movimentacao.tipo, 'SAIDA')
            self.assertEqual(movimentacao.origem, 'VENDA')
            self.assertEqual(movimentacao.quantidade, Decimal('30.000'))
            self.assertEqual(movimentacao.quantidade_anterior, Decimal('100.000'))
            self.assertEqual(movimentacao.quantidade_posterior, Decimal('70.000'))
    
    def test_processar_saida_estoque_insuficiente(self):
        """Testa erro ao processar saída com estoque insuficiente"""
        with schema_context(self.tenant.schema_name):
            # Criar estoque com quantidade menor
            Estoque.objects.create(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade_atual=Decimal('50.000'),
                quantidade_reservada=Decimal('30.000'),  # Deixa apenas 20 disponível
                valor_custo_medio=Decimal('10.50')
            )
            
            with self.assertRaises(EstoqueServiceError) as context:
                processar_saida_estoque(
                    produto=self.produto,
                    location=self.location_saida,
                    empresa=self.empresa,
                    quantidade=Decimal('30.000'),
                    valor_unitario=Decimal('10.50')
                )
            
            self.assertIn('Estoque insuficiente', str(context.exception))
    
    def test_processar_saida_estoque_nao_existe(self):
        """Testa erro ao processar saída de estoque que não existe"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError) as context:
                processar_saida_estoque(
                    produto=self.produto,
                    location=self.location_saida,
                    empresa=self.empresa,
                    quantidade=Decimal('30.000'),
                    valor_unitario=Decimal('10.50')
                )
            
            self.assertIn('Estoque não encontrado', str(context.exception))
    
    def test_processar_saida_estoque_alerta_minimo(self):
        """Testa alerta de estoque mínimo ao processar saída"""
        with schema_context(self.tenant.schema_name):
            # Criar estoque com mínimo configurado
            Estoque.objects.create(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50'),
                estoque_minimo=Decimal('80.000')
            )
            
            # Processar saída que deixa abaixo do mínimo
            resultado = processar_saida_estoque(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade=Decimal('30.000'),
                valor_unitario=Decimal('10.50'),
                verificar_estoque_minimo=True
            )
            
            # Verificar que alerta foi gerado
            self.assertIsNotNone(resultado['alerta_estoque_minimo'])
            alerta = resultado['alerta_estoque_minimo']
            self.assertEqual(alerta['quantidade_atual'], Decimal('70.000'))
            self.assertEqual(alerta['estoque_minimo'], Decimal('80.000'))
    
    def test_calcular_custo_medio_ponderado_estoque_zerado(self):
        """Testa cálculo de custo médio quando estoque está zerado"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location_entrada,
                empresa=self.empresa,
                quantidade_atual=Decimal('0.000'),
                valor_custo_medio=Decimal('0.00')
            )
            
            novo_custo = calcular_custo_medio_ponderado(
                estoque,
                Decimal('100.000'),
                Decimal('10.50')
            )
            
            # Quando estoque está zerado, custo médio é o custo da entrada
            self.assertEqual(novo_custo, Decimal('10.50'))
    
    def test_calcular_custo_medio_ponderado_com_estoque(self):
        """Testa cálculo de custo médio ponderado com estoque existente"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location_entrada,
                empresa=self.empresa,
                quantidade_atual=Decimal('50.000'),
                valor_custo_medio=Decimal('10.00')
            )
            
            novo_custo = calcular_custo_medio_ponderado(
                estoque,
                Decimal('50.000'),
                Decimal('11.00')
            )
            
            # (50 * 10.00 + 50 * 11.00) / 100 = 10.50
            self.assertEqual(novo_custo, Decimal('10.50'))
    
    def test_validar_location_permite_entrada(self):
        """Testa validação de location permite entrada"""
        with schema_context(self.tenant.schema_name):
            # Location que permite entrada
            validar_location_permite_entrada(self.location_entrada)  # Não deve lançar erro
            
            # Location que não permite entrada
            with self.assertRaises(EstoqueServiceError):
                validar_location_permite_entrada(self.location_sem_entrada)
    
    def test_validar_estoque_disponivel(self):
        """Testa validação de estoque disponível"""
        with schema_context(self.tenant.schema_name):
            estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location_saida,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('20.000')
            )
            
            # Quantidade disponível = 100 - 20 = 80
            # Testar com quantidade menor que disponível
            validar_estoque_disponivel(estoque, Decimal('50.000'))  # Não deve lançar erro
            
            # Testar com quantidade maior que disponível
            with self.assertRaises(EstoqueServiceError):
                validar_estoque_disponivel(estoque, Decimal('90.000'))
    
    def test_validar_filial_pertence_empresa(self):
        """Testa validação de filial pertence à empresa"""
        with schema_context(self.tenant.schema_name):
            # Filial que pertence à empresa
            validar_filial_pertence_empresa(self.filial, self.empresa)  # Não deve lançar erro
            
            # Filial None (válido)
            validar_filial_pertence_empresa(None, self.empresa)  # Não deve lançar erro
            
            # Criar outra empresa e tentar validar filial de outra empresa
            outra_empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Outra Empresa',
                razao_social='Outra Empresa LTDA',
                cnpj='98765432000100',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            with self.assertRaises(EstoqueServiceError):
                validar_filial_pertence_empresa(self.filial, outra_empresa)


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class ReservaEstoqueTests(TestCase):
    """Testes para reservas de estoque"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_reservas',
                name='Tenant de Teste Reservas',
                is_active=True
            )
            Domain.objects.create(
                domain='test-reservas.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        with schema_context(self.tenant.schema_name):
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            self.location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Teste',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.produto = Produto.objects.create(
                nome='Produto Teste',
                codigo='PROD001',
                tipo='PRODUTO',
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                is_active=True
            )
            
            self.estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
    
    def test_criar_reserva_soft(self):
        """Testa criação de reserva SOFT"""
        with schema_context(self.tenant.schema_name):
            resultado = criar_reserva(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade=Decimal('20.000'),
                tipo='SOFT',
                origem='VENDA',
                minutos_expiracao=30
            )
            
            reserva = resultado['reserva']
            
            self.assertEqual(reserva.tipo, 'SOFT')
            self.assertEqual(reserva.status, 'ATIVA')
            self.assertEqual(reserva.quantidade, Decimal('20.000'))
            self.assertIsNotNone(reserva.data_expiracao)
            
            # SOFT não deve atualizar quantidade_reservada
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_reservada, Decimal('0.000'))
    
    def test_criar_reserva_hard(self):
        """Testa criação de reserva HARD"""
        with schema_context(self.tenant.schema_name):
            resultado = criar_reserva(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade=Decimal('20.000'),
                tipo='HARD',
                origem='VENDA'
            )
            
            reserva = resultado['reserva']
            estoque = resultado['estoque']
            
            self.assertEqual(reserva.tipo, 'HARD')
            self.assertEqual(reserva.status, 'ATIVA')
            self.assertIsNone(reserva.data_expiracao)
            
            # HARD deve atualizar quantidade_reservada
            estoque.refresh_from_db()
            self.assertEqual(estoque.quantidade_reservada, Decimal('20.000'))
            self.assertEqual(estoque.quantidade_disponivel, Decimal('80.000'))
    
    def test_criar_reserva_hard_estoque_insuficiente(self):
        """Testa erro ao criar reserva HARD com estoque insuficiente"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError) as context:
                criar_reserva(
                    produto=self.produto,
                    location=self.location,
                    empresa=self.empresa,
                    quantidade=Decimal('150.000'),  # Mais que disponível
                    tipo='HARD',
                    origem='VENDA'
                )
            
            self.assertIn('Estoque insuficiente', str(context.exception))
    
    def test_confirmar_reserva_soft(self):
        """Testa confirmação de reserva SOFT (converte para HARD)"""
        with schema_context(self.tenant.schema_name):
            # Criar reserva SOFT
            resultado = criar_reserva(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade=Decimal('20.000'),
                tipo='SOFT',
                origem='VENDA'
            )
            
            reserva = resultado['reserva']
            
            # Confirmar reserva
            resultado_confirmacao = confirmar_reserva(reserva)
            reserva.refresh_from_db()
            
            # Deve converter para HARD
            self.assertEqual(reserva.tipo, 'HARD')
            self.assertEqual(reserva.status, 'CONFIRMADA')
            self.assertIsNone(reserva.data_expiracao)
            
            # Deve atualizar quantidade_reservada
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_reservada, Decimal('20.000'))
    
    def test_cancelar_reserva_hard(self):
        """Testa cancelamento de reserva HARD (libera estoque)"""
        with schema_context(self.tenant.schema_name):
            # Criar reserva HARD
            resultado = criar_reserva(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade=Decimal('20.000'),
                tipo='HARD',
                origem='VENDA'
            )
            
            reserva = resultado['reserva']
            
            # Cancelar reserva
            cancelar_reserva(reserva, motivo='Cliente desistiu')
            reserva.refresh_from_db()
            
            self.assertEqual(reserva.status, 'CANCELADA')
            
            # Deve liberar estoque
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_reservada, Decimal('0.000'))
    
    def test_reserva_expirar(self):
        """Testa expiração de reserva SOFT"""
        with schema_context(self.tenant.schema_name):
            reserva = ReservaEstoque.objects.create(
                estoque=self.estoque,
                tipo='SOFT',
                origem='VENDA',
                status='ATIVA',
                quantidade=Decimal('20.000'),
                data_expiracao=timezone.now() - timedelta(minutes=1)  # Já expirada
            )
            
            reserva.expirar()
            reserva.refresh_from_db()
            
            self.assertEqual(reserva.status, 'EXPIRADA')
    
    def test_reserva_esta_expirada(self):
        """Testa propriedade esta_expirada"""
        with schema_context(self.tenant.schema_name):
            # Reserva expirada
            reserva_expirada = ReservaEstoque.objects.create(
                estoque=self.estoque,
                tipo='SOFT',
                origem='VENDA',
                status='ATIVA',
                quantidade=Decimal('20.000'),
                data_expiracao=timezone.now() - timedelta(minutes=1)
            )
            self.assertTrue(reserva_expirada.esta_expirada)
            
            # Reserva não expirada
            reserva_ativa = ReservaEstoque.objects.create(
                estoque=self.estoque,
                tipo='SOFT',
                origem='VENDA',
                status='ATIVA',
                quantidade=Decimal('20.000'),
                data_expiracao=timezone.now() + timedelta(minutes=30)
            )
            self.assertFalse(reserva_ativa.esta_expirada)


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class PrevisaoMovimentacaoTests(TestCase):
    """Testes para previsões de movimentação"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_previsoes',
                name='Tenant de Teste Previsões',
                is_active=True
            )
            Domain.objects.create(
                domain='test-previsoes.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
            self.plan = Plan.objects.create(
                name='Plano Teste',
                slug='teste',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
        
        with schema_context(self.tenant.schema_name):
            self.empresa = Empresa.objects.create(
                tenant=self.tenant,
                nome='Empresa Teste',
                razao_social='Empresa Teste LTDA',
                cnpj='12345678000190',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            self.location = Location.objects.create(
                empresa=self.empresa,
                nome='Loja Teste',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua Teste',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.produto = Produto.objects.create(
                nome='Produto Teste',
                codigo='PROD001',
                tipo='PRODUTO',
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                is_active=True
            )
            
            self.estoque = Estoque.objects.create(
                produto=self.produto,
                location=self.location,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
    
    def test_criar_previsao_entrada(self):
        """Testa criação de previsão de entrada"""
        with schema_context(self.tenant.schema_name):
            data_prevista = timezone.now() + timedelta(days=7)
            
            previsao = PrevisaoMovimentacao.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='PENDENTE',
                quantidade=Decimal('50.000'),
                data_prevista=data_prevista,
                valor_unitario_previsto=Decimal('11.00')
            )
            
            self.assertEqual(previsao.tipo, 'ENTRADA')
            self.assertEqual(previsao.status, 'PENDENTE')
            
            # Deve atualizar quantidade_prevista_entrada
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_prevista_entrada, Decimal('50.000'))
    
    def test_criar_previsao_saida(self):
        """Testa criação de previsão de saída"""
        with schema_context(self.tenant.schema_name):
            data_prevista = timezone.now() + timedelta(days=3)
            
            previsao = PrevisaoMovimentacao.objects.create(
                estoque=self.estoque,
                tipo='SAIDA',
                origem='VENDA',
                status='PENDENTE',
                quantidade=Decimal('30.000'),
                data_prevista=data_prevista
            )
            
            # Deve atualizar quantidade_prevista_saida
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_prevista_saida, Decimal('30.000'))
    
    def test_previsao_confirmar(self):
        """Testa confirmação de previsão"""
        with schema_context(self.tenant.schema_name):
            previsao = PrevisaoMovimentacao.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='PENDENTE',
                quantidade=Decimal('50.000'),
                data_prevista=timezone.now() + timedelta(days=7)
            )
            
            previsao.confirmar()
            previsao.refresh_from_db()
            
            self.assertEqual(previsao.status, 'CONFIRMADA')
    
    def test_previsao_cancelar(self):
        """Testa cancelamento de previsão"""
        with schema_context(self.tenant.schema_name):
            previsao = PrevisaoMovimentacao.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='PENDENTE',
                quantidade=Decimal('50.000'),
                data_prevista=timezone.now() + timedelta(days=7)
            )
            
            # Verificar que quantidade_prevista foi atualizada
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_prevista_entrada, Decimal('50.000'))
            
            # Cancelar previsão
            previsao.cancelar(motivo='Compra cancelada')
            previsao.refresh_from_db()
            
            self.assertEqual(previsao.status, 'CANCELADA')
            
            # Deve remover da previsão
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_prevista_entrada, Decimal('0.000'))
    
    def test_previsao_realizar(self):
        """Testa realização de previsão"""
        with schema_context(self.tenant.schema_name):
            previsao = PrevisaoMovimentacao.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='CONFIRMADA',
                quantidade=Decimal('50.000'),
                data_prevista=timezone.now() + timedelta(days=7)
            )
            
            # Criar movimentação
            movimentacao = MovimentacaoEstoque.objects.create(
                estoque=self.estoque,
                tipo='ENTRADA',
                origem='COMPRA',
                status='CONFIRMADA',
                quantidade=Decimal('50.000'),
                valor_unitario=Decimal('11.00')
            )
            
            # Realizar previsão
            previsao.realizar(movimentacao=movimentacao)
            previsao.refresh_from_db()
            
            self.assertEqual(previsao.status, 'REALIZADA')
            self.assertEqual(previsao.movimentacao_realizada, movimentacao)
            
            # Deve remover da previsão
            self.estoque.refresh_from_db()
            self.assertEqual(self.estoque.quantidade_prevista_entrada, Decimal('0.000'))
