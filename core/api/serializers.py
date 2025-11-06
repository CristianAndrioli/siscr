from rest_framework import serializers
# Models movidos para cadastros app
from cadastros.models import Pessoa, Produto, Servico


class PessoaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pessoa
        fields = '__all__'
        read_only_fields = ('codigo_cadastro',)


class ProdutoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Produto
        fields = '__all__'
        read_only_fields = ('codigo_produto',)


class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'
        read_only_fields = ('codigo_servico',)

