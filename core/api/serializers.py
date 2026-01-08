"""
Serializers para API do core
"""
from rest_framework import serializers
from public.models import EmailSettings


class EmailSettingsSerializer(serializers.ModelSerializer):
    """Serializer para configurações de email"""
    
    class Meta:
        model = EmailSettings
        fields = [
            'id', 'backend', 'host', 'port', 'use_tls', 'use_ssl',
            'username', 'password', 'from_email', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'password': {'write_only': True},  # Não retornar senha na leitura
        }
    
    def validate(self, attrs):
        """Valida se configurações SMTP estão completas quando backend é SMTP"""
        if attrs.get('backend') == 'smtp':
            if not attrs.get('host'):
                raise serializers.ValidationError({
                    'host': 'Servidor SMTP é obrigatório quando backend é SMTP'
                })
            if not attrs.get('username'):
                raise serializers.ValidationError({
                    'username': 'Usuário é obrigatório quando backend é SMTP'
                })
        return attrs
