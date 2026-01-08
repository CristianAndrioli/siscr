"""
Testes adicionais para transferências e grupos de filiais
"""
from django.test import TestCase, override_settings
from django_tenants.utils import schema_context
from decimal import Decimal
from tenants.models import Tenant, Domain, Empresa, Filial
from cadastros.models import Produto
from estoque.models import Location, Estoque, GrupoFilial
from estoque.services import processar_transferencia, EstoqueServiceError
from subscriptions.models import Plan


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class TransferenciaEstoqueTests(TestCase):
    """Testes para transferências de estoque"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_transferencias',
                name='Tenant de Teste Transferências',
                is_active=True
            )
            Domain.objects.create(
                domain='test-transferencias.localhost',
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
                permite_entrada=True,
                permite_saida=True,
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
                permite_entrada=True,
                permite_saida=True,
                is_active=True
            )
            
            self.produto = Produto.objects.create(
                codigo_produto=4,
                nome='Produto Teste',
                descricao='Produto de teste para transferências',
                ativo=True,
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                codigo_ncm='12345678',
                origem_mercadoria='0',
                aliquota_icms=Decimal('18.00'),
                aliquota_ipi=Decimal('0.00')
            )
            
            self.estoque_origem = Estoque.objects.create(
                produto=self.produto,
                location=self.location_origem,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('0.000'),
                valor_custo_medio=Decimal('10.50')
            )
    
    def test_processar_transferencia_sucesso(self):
        """Testa transferência de estoque com sucesso"""
        with schema_context(self.tenant.schema_name):
            resultado = processar_transferencia(
                produto=self.produto,
                location_origem=self.location_origem,
                location_destino=self.location_destino,
                empresa=self.empresa,
                quantidade=Decimal('30.000'),
                documento_referencia='TRF001'
            )
            
            mov_saida = resultado['movimentacao_saida']
            mov_entrada = resultado['movimentacao_entrada']
            estoque_origem = resultado['estoque_origem']
            estoque_destino = resultado['estoque_destino']
            
            # Verificar movimentações
            self.assertEqual(mov_saida.tipo, 'SAIDA')
            self.assertEqual(mov_entrada.tipo, 'ENTRADA')
            self.assertEqual(mov_saida.origem, 'TRANSFERENCIA')
            self.assertEqual(mov_entrada.origem, 'TRANSFERENCIA')
            
            # Verificar estoques
            self.assertEqual(estoque_origem.quantidade_atual, Decimal('70.000'))
            self.assertEqual(estoque_destino.quantidade_atual, Decimal('30.000'))
            self.assertEqual(estoque_destino.valor_custo_medio, Decimal('10.50'))
    
    def test_processar_transferencia_estoque_insuficiente(self):
        """Testa erro ao transferir com estoque insuficiente"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError) as context:
                processar_transferencia(
                    produto=self.produto,
                    location_origem=self.location_origem,
                    location_destino=self.location_destino,
                    empresa=self.empresa,
                    quantidade=Decimal('150.000')  # Mais que disponível
                )
            
            self.assertIn('Estoque insuficiente', str(context.exception))
    
    def test_processar_transferencia_mesma_location(self):
        """Testa erro ao transferir para a mesma location"""
        with schema_context(self.tenant.schema_name):
            with self.assertRaises(EstoqueServiceError) as context:
                processar_transferencia(
                    produto=self.produto,
                    location_origem=self.location_origem,
                    location_destino=self.location_origem,  # Mesma location
                    empresa=self.empresa,
                    quantidade=Decimal('30.000')
                )
            
            self.assertIn('não podem ser a mesma', str(context.exception))


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class GrupoFilialTests(TestCase):
    """Testes para grupos de filiais"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_grupos',
                name='Tenant de Teste Grupos',
                is_active=True
            )
            Domain.objects.create(
                domain='test-grupos.localhost',
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
            
            self.filial1 = Filial.objects.create(
                empresa=self.empresa,
                nome='Filial 1',
                codigo_filial='FIL001',
                cidade='São Paulo',
                estado='SP',
                is_active=True
            )
            
            self.filial2 = Filial.objects.create(
                empresa=self.empresa,
                nome='Filial 2',
                codigo_filial='FIL002',
                cidade='Rio de Janeiro',
                estado='RJ',
                is_active=True
            )
            
            self.location1 = Location.objects.create(
                empresa=self.empresa,
                filial=self.filial1,
                nome='Loja Filial 1',
                codigo='LOC001',
                tipo='LOJA',
                logradouro='Rua 1',
                numero='123',
                bairro='Centro',
                cidade='São Paulo',
                estado='SP',
                cep='01234-567',
                is_active=True
            )
            
            self.location2 = Location.objects.create(
                empresa=self.empresa,
                filial=self.filial2,
                nome='Loja Filial 2',
                codigo='LOC002',
                tipo='LOJA',
                logradouro='Rua 2',
                numero='456',
                bairro='Centro',
                cidade='Rio de Janeiro',
                estado='RJ',
                cep='20000-000',
                is_active=True
            )
            
            self.produto = Produto.objects.create(
                codigo_produto=4,
                nome='Produto Teste',
                descricao='Produto de teste para transferências',
                ativo=True,
                unidade_medida='UN',
                valor_custo=Decimal('10.00'),
                valor_venda=Decimal('15.00'),
                codigo_ncm='12345678',
                origem_mercadoria='0',
                aliquota_icms=Decimal('18.00'),
                aliquota_ipi=Decimal('0.00')
            )
            
            self.estoque1 = Estoque.objects.create(
                produto=self.produto,
                location=self.location1,
                empresa=self.empresa,
                quantidade_atual=Decimal('100.000'),
                quantidade_reservada=Decimal('10.000'),
                valor_custo_medio=Decimal('10.50')
            )
            
            self.estoque2 = Estoque.objects.create(
                produto=self.produto,
                location=self.location2,
                empresa=self.empresa,
                quantidade_atual=Decimal('50.000'),
                quantidade_reservada=Decimal('5.000'),
                valor_custo_medio=Decimal('11.00')
            )
    
    def test_criar_grupo_filial(self):
        """Testa criação de grupo de filiais"""
        with schema_context(self.tenant.schema_name):
            grupo = GrupoFilial.objects.create(
                empresa=self.empresa,
                nome='Região Sudeste',
                codigo='GRP001',
                regra_alocacao='ESTOQUE_DISPONIVEL',
                permite_fulfillment_cruzado=True
            )
            
            grupo.filiais.add(self.filial1, self.filial2)
            
            self.assertEqual(grupo.nome, 'Região Sudeste')
            self.assertEqual(grupo.filiais.count(), 2)
            self.assertTrue(grupo.permite_fulfillment_cruzado)
    
    def test_get_estoque_consolidado(self):
        """Testa obtenção de estoque consolidado"""
        with schema_context(self.tenant.schema_name):
            grupo = GrupoFilial.objects.create(
                empresa=self.empresa,
                nome='Região Sudeste',
                codigo='GRP001'
            )
            grupo.filiais.add(self.filial1, self.filial2)
            
            consolidado = grupo.get_estoque_consolidado(self.produto)
            
            # Verificar totais consolidados
            self.assertEqual(consolidado['quantidade_atual'], Decimal('150.000'))  # 100 + 50
            self.assertEqual(consolidado['quantidade_reservada'], Decimal('15.000'))  # 10 + 5
            self.assertEqual(consolidado['quantidade_disponivel'], Decimal('135.000'))  # 90 + 45
            self.assertEqual(consolidado['locations'], 2)
    
    def test_determinar_melhor_filial_estoque_disponivel(self):
        """Testa determinação de melhor filial por estoque disponível"""
        with schema_context(self.tenant.schema_name):
            grupo = GrupoFilial.objects.create(
                empresa=self.empresa,
                nome='Região Sudeste',
                codigo='GRP001',
                regra_alocacao='ESTOQUE_DISPONIVEL'
            )
            grupo.filiais.add(self.filial1, self.filial2)
            
            melhor_filial = grupo.determinar_melhor_filial(
                produto=self.produto,
                quantidade=Decimal('20.000')
            )
            
            # Filial 1 tem mais estoque disponível (90 vs 45)
            self.assertEqual(melhor_filial, self.filial1)
    
    def test_determinar_melhor_filial_custo_menor(self):
        """Testa determinação de melhor filial por menor custo"""
        with schema_context(self.tenant.schema_name):
            grupo = GrupoFilial.objects.create(
                empresa=self.empresa,
                nome='Região Sudeste',
                codigo='GRP001',
                regra_alocacao='CUSTO_MENOR'
            )
            grupo.filiais.add(self.filial1, self.filial2)
            
            melhor_filial = grupo.determinar_melhor_filial(
                produto=self.produto,
                quantidade=Decimal('20.000')
            )
            
            # Filial 1 tem menor custo (10.50 vs 11.00)
            self.assertEqual(melhor_filial, self.filial1)
    
    def test_determinar_melhor_filial_sem_fulfillment_cruzado(self):
        """Testa que sem fulfillment cruzado retorna filial de origem"""
        with schema_context(self.tenant.schema_name):
            grupo = GrupoFilial.objects.create(
                empresa=self.empresa,
                nome='Região Sudeste',
                codigo='GRP001',
                permite_fulfillment_cruzado=False
            )
            grupo.filiais.add(self.filial1, self.filial2)
            
            melhor_filial = grupo.determinar_melhor_filial(
                produto=self.produto,
                quantidade=Decimal('20.000'),
                filial_origem=self.filial1
            )
            
            # Deve retornar filial de origem
            self.assertEqual(melhor_filial, self.filial1)

