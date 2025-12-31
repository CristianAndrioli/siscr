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
from estoque.models import Location, Estoque, MovimentacaoEstoque
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
                origem='TRANSFERENCIA_ENTRE_LOCATIONS',
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
