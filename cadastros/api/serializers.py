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
    
    def create(self, validated_data):
        # Permitir que codigo_produto seja fornecido na criação
        # Se não for fornecido, gerar automaticamente
        if 'codigo_produto' not in validated_data or not validated_data['codigo_produto']:
            from django.db.models import Max
            try:
                max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
                validated_data['codigo_produto'] = (max_id or 0) + 1
            except Exception:
                validated_data['codigo_produto'] = 1
        # Garantir que seja inteiro
        if validated_data.get('codigo_produto'):
            try:
                validated_data['codigo_produto'] = int(validated_data['codigo_produto'])
            except (ValueError, TypeError):
                # Se não conseguir converter, gerar novo
                from django.db.models import Max
                try:
                    max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
                    validated_data['codigo_produto'] = (max_id or 0) + 1
                except Exception:
                    validated_data['codigo_produto'] = 1
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Não permitir alterar codigo_produto na atualização
        validated_data.pop('codigo_produto', None)
        return super().update(instance, validated_data)


class ServicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servico
        fields = '__all__'
    
    def create(self, validated_data):
        # Permitir que codigo_servico seja fornecido na criação
        # Se não for fornecido, gerar automaticamente
        if 'codigo_servico' not in validated_data or not validated_data['codigo_servico']:
            from django.db.models import Max
            try:
                max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
                validated_data['codigo_servico'] = (max_id or 0) + 1
            except Exception:
                validated_data['codigo_servico'] = 1
        # Garantir que seja inteiro
        if validated_data.get('codigo_servico'):
            try:
                validated_data['codigo_servico'] = int(validated_data['codigo_servico'])
            except (ValueError, TypeError):
                # Se não conseguir converter, gerar novo
                from django.db.models import Max
                try:
                    max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
                    validated_data['codigo_servico'] = (max_id or 0) + 1
                except Exception:
                    validated_data['codigo_servico'] = 1
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Não permitir alterar codigo_servico na atualização
        validated_data.pop('codigo_servico', None)
        return super().update(instance, validated_data)

