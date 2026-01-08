"""
Serializers para o módulo de relatórios
"""
from rest_framework import serializers
from reports.models import ReportTemplate, ReportConfig


class ReportTemplateSerializer(serializers.ModelSerializer):
    """Serializer para ReportTemplate"""
    
    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'nome', 'codigo', 'descricao',
            'modulo', 'tipo_relatorio',
            'template_customizado', 'template_arquivo', 'template_html', 'template_css',
            'incluir_logo', 'incluir_dados_empresa', 'orientacao',
            'variaveis_disponiveis',
            'tenant', 'empresa',
            'is_active', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ReportConfigSerializer(serializers.ModelSerializer):
    """Serializer para ReportConfig"""
    
    class Meta:
        model = ReportConfig
        fields = [
            'id', 'tenant', 'empresa',
            'logo_url', 'logo_upload',
            'nome_empresa', 'endereco', 'telefone', 'email', 'cnpj',
            'formato_padrao',
            'email_destinatario_padrao', 'assunto_padrao',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class GerarRelatorioSerializer(serializers.Serializer):
    """Serializer para requisição de geração de relatório"""
    tipo = serializers.CharField(required=True, help_text='Tipo do relatório (ex: estoque-por-location)')
    modulo = serializers.CharField(required=False, help_text='Módulo do sistema (ex: estoque)')
    formato = serializers.ChoiceField(
        choices=['pdf', 'html', 'xlsx'],
        default='pdf',
        required=False
    )
    template_id = serializers.IntegerField(required=False, allow_null=True, help_text='ID de template customizado')
    filtros = serializers.DictField(required=False, default=dict, help_text='Filtros do relatório')
    enviar_email = serializers.BooleanField(default=False, required=False)
    email_destinatario = serializers.EmailField(required=False, allow_null=True)

