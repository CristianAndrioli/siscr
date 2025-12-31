"""
Serializers para a API do módulo de Estoque
"""
from rest_framework import serializers
from estoque.models import (
    Location, Estoque, MovimentacaoEstoque, 
    ReservaEstoque, PrevisaoMovimentacao, GrupoFilial
)
from cadastros.models import Produto
from tenants.models import Empresa, Filial


class LocationSerializer(serializers.ModelSerializer):
    """Serializer para Location"""
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    filial_nome = serializers.CharField(source='filial.nome', read_only=True, allow_null=True)
    endereco_completo = serializers.CharField(read_only=True)
    
    class Meta:
        model = Location
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by', 'owner']


class EstoqueSerializer(serializers.ModelSerializer):
    """Serializer para Estoque"""
    produto_nome = serializers.CharField(source='produto.nome', read_only=True)
    produto_codigo = serializers.CharField(source='produto.codigo', read_only=True)
    location_nome = serializers.CharField(source='location.nome', read_only=True)
    location_codigo = serializers.CharField(source='location.codigo', read_only=True)
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    quantidade_disponivel_com_prevista = serializers.DecimalField(
        max_digits=10, 
        decimal_places=3, 
        read_only=True
    )
    abaixo_estoque_minimo = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Estoque
        fields = '__all__'
        read_only_fields = [
            'quantidade_disponivel', 
            'valor_total',
            'created_at', 
            'updated_at', 
            'created_by', 
            'updated_by', 
            'owner'
        ]


class MovimentacaoEstoqueSerializer(serializers.ModelSerializer):
    """Serializer para MovimentacaoEstoque"""
    produto_nome = serializers.CharField(source='estoque.produto.nome', read_only=True)
    location_nome = serializers.CharField(source='estoque.location.nome', read_only=True)
    location_origem_nome = serializers.CharField(source='location_origem.nome', read_only=True, allow_null=True)
    location_destino_nome = serializers.CharField(source='location_destino.nome', read_only=True, allow_null=True)
    
    class Meta:
        model = MovimentacaoEstoque
        fields = '__all__'
        read_only_fields = [
            'quantidade_posterior',
            'valor_total',
            'data_movimentacao',
            'created_at', 
            'updated_at', 
            'created_by', 
            'updated_by', 
            'owner'
        ]


class ReservaEstoqueSerializer(serializers.ModelSerializer):
    """Serializer para ReservaEstoque"""
    produto_nome = serializers.CharField(source='estoque.produto.nome', read_only=True)
    location_nome = serializers.CharField(source='estoque.location.nome', read_only=True)
    esta_expirada = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ReservaEstoque
        fields = '__all__'
        read_only_fields = [
            'created_at', 
            'updated_at', 
            'created_by', 
            'updated_by', 
            'owner'
        ]


class PrevisaoMovimentacaoSerializer(serializers.ModelSerializer):
    """Serializer para PrevisaoMovimentacao"""
    produto_nome = serializers.CharField(source='estoque.produto.nome', read_only=True)
    location_nome = serializers.CharField(source='estoque.location.nome', read_only=True)
    location_origem_nome = serializers.CharField(source='location_origem.nome', read_only=True, allow_null=True)
    location_destino_nome = serializers.CharField(source='location_destino.nome', read_only=True, allow_null=True)
    
    class Meta:
        model = PrevisaoMovimentacao
        fields = '__all__'
        read_only_fields = [
            'movimentacao_realizada',
            'created_at', 
            'updated_at', 
            'created_by', 
            'updated_by', 
            'owner'
        ]


class GrupoFilialSerializer(serializers.ModelSerializer):
    """Serializer para GrupoFilial"""
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    filiais_nomes = serializers.SerializerMethodField()
    
    class Meta:
        model = GrupoFilial
        fields = '__all__'
        read_only_fields = [
            'created_at', 
            'updated_at', 
            'created_by', 
            'updated_by', 
            'owner'
        ]
    
    def get_filiais_nomes(self, obj):
        """Retorna lista de nomes das filiais"""
        return [filial.nome for filial in obj.filiais.all()]


# Serializers para endpoints especiais
class ProcessarEntradaSerializer(serializers.Serializer):
    """Serializer para processar entrada de estoque"""
    produto_id = serializers.IntegerField()
    location_id = serializers.IntegerField()
    quantidade = serializers.DecimalField(max_digits=10, decimal_places=3)
    valor_unitario = serializers.DecimalField(max_digits=10, decimal_places=2)
    origem = serializers.ChoiceField(
        choices=['COMPRA', 'DEVOLUCAO', 'RETORNO_NF', 'OUTRO'],
        default='COMPRA'
    )
    documento_referencia = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    numero_nota_fiscal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    serie_nota_fiscal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    observacoes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ProcessarSaidaSerializer(serializers.Serializer):
    """Serializer para processar saída de estoque"""
    produto_id = serializers.IntegerField()
    location_id = serializers.IntegerField()
    quantidade = serializers.DecimalField(max_digits=10, decimal_places=3)
    valor_unitario = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    origem = serializers.ChoiceField(
        choices=['VENDA', 'CONSUMO_INTERNO', 'PERDA', 'CANCELAMENTO_NF', 'OUTRO'],
        default='VENDA'
    )
    documento_referencia = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    numero_nota_fiscal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    serie_nota_fiscal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    observacoes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    verificar_estoque_minimo = serializers.BooleanField(default=True)


class ProcessarTransferenciaSerializer(serializers.Serializer):
    """Serializer para processar transferência de estoque"""
    produto_id = serializers.IntegerField()
    location_origem_id = serializers.IntegerField()
    location_destino_id = serializers.IntegerField()
    quantidade = serializers.DecimalField(max_digits=10, decimal_places=3)
    valor_unitario = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    documento_referencia = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    observacoes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CriarReservaSerializer(serializers.Serializer):
    """Serializer para criar reserva de estoque"""
    produto_id = serializers.IntegerField()
    location_id = serializers.IntegerField()
    quantidade = serializers.DecimalField(max_digits=10, decimal_places=3)
    tipo = serializers.ChoiceField(choices=['SOFT', 'HARD'], default='SOFT')
    origem = serializers.ChoiceField(
        choices=['VENDA', 'ECOMMERCE', 'PEDIDO', 'COTACAO', 'OUTRO'],
        default='VENDA'
    )
    documento_referencia = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    minutos_expiracao = serializers.IntegerField(required=False, default=30)
    observacoes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class EstoqueConsolidadoSerializer(serializers.Serializer):
    """Serializer para estoque consolidado"""
    produto_id = serializers.IntegerField(required=False)
    empresa_id = serializers.IntegerField(required=False)
    grupo_filial_id = serializers.IntegerField(required=False)

