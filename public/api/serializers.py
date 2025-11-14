"""
Serializers para API pública
"""
from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    """Serializer para validação de dados de cadastro"""
    # Dados do tenant
    tenant_name = serializers.CharField(max_length=100, required=True)
    domain = serializers.CharField(max_length=253, required=True)
    plan_id = serializers.IntegerField(required=True)
    
    # Dados do usuário admin
    admin_username = serializers.CharField(max_length=150, required=True)
    admin_email = serializers.EmailField(required=True)
    admin_password = serializers.CharField(min_length=8, required=True, write_only=True)
    admin_first_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    admin_last_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    
    # Dados da empresa
    empresa_nome = serializers.CharField(max_length=255, required=True)
    empresa_cnpj = serializers.CharField(max_length=18, required=False, allow_blank=True)
    empresa_razao_social = serializers.CharField(max_length=255, required=False, allow_blank=True)
    
    def validate_domain(self, value):
        """Validar formato do domínio"""
        domain = value.strip().lower()
        if not domain.replace('.', '').replace('-', '').isalnum():
            raise serializers.ValidationError(
                'Domínio inválido. Use apenas letras, números, pontos e hífens'
            )
        return domain
    
    def validate_admin_password(self, value):
        """Validar força da senha"""
        if len(value) < 8:
            raise serializers.ValidationError('Senha deve ter no mínimo 8 caracteres')
        return value

