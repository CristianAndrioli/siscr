# cadastros/api/serializers.py
# Serializers movidos de core/api/serializers.py

from rest_framework import serializers
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

