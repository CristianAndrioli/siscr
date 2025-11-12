# cadastros/api/serializers.py
# Serializers movidos de core/api/serializers.py

from rest_framework import serializers
from cadastros.models import Pessoa, Produto, Servico


class PessoaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pessoa
        fields = '__all__'
    
    def create(self, validated_data):
        # Permitir que codigo_cadastro seja fornecido na criação
        # Se não for fornecido, gerar automaticamente
        if 'codigo_cadastro' not in validated_data or not validated_data['codigo_cadastro']:
            from django.db.models import Max
            try:
                max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
                validated_data['codigo_cadastro'] = (max_id or 0) + 1
            except Exception:
                validated_data['codigo_cadastro'] = 1
        # Garantir que seja inteiro
        if validated_data.get('codigo_cadastro'):
            try:
                validated_data['codigo_cadastro'] = int(validated_data['codigo_cadastro'])
            except (ValueError, TypeError):
                # Se não conseguir converter, gerar novo
                from django.db.models import Max
                try:
                    max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
                    validated_data['codigo_cadastro'] = (max_id or 0) + 1
                except Exception:
                    validated_data['codigo_cadastro'] = 1
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Não permitir alterar codigo_cadastro na atualização
        validated_data.pop('codigo_cadastro', None)
        return super().update(instance, validated_data)


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

