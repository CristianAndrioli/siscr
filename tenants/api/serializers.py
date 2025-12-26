"""
Serializers para Empresa e Filial
"""
from rest_framework import serializers
from tenants.models import Empresa, Filial
from django.db import connection


class EmpresaSerializer(serializers.ModelSerializer):
    """Serializer para Empresa"""
    filiais_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Empresa
        fields = [
            'id', 'nome', 'razao_social', 'cnpj',
            'endereco', 'cidade', 'estado', 'cep',
            'telefone', 'email', 'is_active',
            'created_at', 'updated_at', 'filiais_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'filiais_count']
    
    def get_filiais_count(self, obj):
        """Retorna o número de filiais da empresa"""
        return obj.filiais.count()
    
    def validate_cnpj(self, value):
        """Valida CNPJ único no tenant"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            return value
        
        # Verificar se já existe empresa com mesmo CNPJ no tenant
        queryset = Empresa.objects.filter(tenant=tenant, cnpj=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError('Já existe uma empresa com este CNPJ no tenant.')
        return value
    
    def create(self, validated_data):
        """Cria empresa e valida quota"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError('Tenant não identificado')
        
        # Validar quota antes de criar
        from subscriptions.models import QuotaUsage
        quota_usage, _ = QuotaUsage.objects.get_or_create(tenant=tenant)
        success, message = quota_usage.check_quota('empresas', 1)
        
        if not success:
            raise serializers.ValidationError({
                'quota': message,
                'quota_type': 'empresas',
                'quota_exceeded': True
            })
        
        # Definir tenant automaticamente
        validated_data['tenant'] = tenant
        
        # Criar empresa (o signal vai incrementar a quota automaticamente)
        empresa = super().create(validated_data)
        
        return empresa


class FilialSerializer(serializers.ModelSerializer):
    """Serializer para Filial"""
    empresa_nome = serializers.CharField(source='empresa.nome', read_only=True)
    
    class Meta:
        model = Filial
        fields = [
            'id', 'empresa', 'empresa_nome', 'nome', 'codigo_filial', 'cnpj',
            'endereco', 'cidade', 'estado', 'cep',
            'telefone', 'email', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'empresa_nome']
    
    def validate_empresa(self, value):
        """Valida se a empresa pertence ao tenant atual"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            return value
        
        if value.tenant != tenant:
            raise serializers.ValidationError('A empresa deve pertencer ao tenant atual.')
        return value
    
    def validate_codigo_filial(self, value):
        """Valida código único por empresa"""
        if not value:
            return value
        
        empresa = self.initial_data.get('empresa') if not self.instance else self.instance.empresa
        
        if empresa:
            queryset = Filial.objects.filter(empresa=empresa, codigo_filial=value)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            
            if queryset.exists():
                raise serializers.ValidationError('Já existe uma filial com este código nesta empresa.')
        return value
    
    def create(self, validated_data):
        """Cria filial e valida quota"""
        tenant = getattr(connection, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError('Tenant não identificado')
        
        # Validar quota antes de criar
        from subscriptions.models import QuotaUsage
        quota_usage, _ = QuotaUsage.objects.get_or_create(tenant=tenant)
        success, message = quota_usage.check_quota('filiais', 1)
        
        if not success:
            raise serializers.ValidationError({
                'quota': message,
                'quota_type': 'filiais',
                'quota_exceeded': True
            })
        
        # Criar filial (o signal vai incrementar a quota automaticamente)
        filial = super().create(validated_data)
        
        return filial

