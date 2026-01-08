"""
Modelos para o sistema de relatórios
"""
from django.db import models
from django.core.validators import MinLengthValidator
from core.base_models import SiscrModelBase


class ReportTemplate(SiscrModelBase):
    """
    Template de relatório configurável
    """
    nome = models.CharField(max_length=200, verbose_name='Nome')
    codigo = models.SlugField(
        unique=True,
        verbose_name='Código',
        help_text='Código único do template (ex: estoque-por-location)',
        validators=[MinLengthValidator(3)]
    )
    descricao = models.TextField(blank=True, verbose_name='Descrição')
    
    # Categoria/Agrupamento
    modulo = models.CharField(
        max_length=50,
        verbose_name='Módulo',
        help_text='Módulo do sistema (ex: estoque, faturamento)'
    )
    tipo_relatorio = models.CharField(
        max_length=100,
        verbose_name='Tipo de Relatório',
        help_text='Tipo específico do relatório (ex: estoque-por-location)'
    )
    
    # Template HTML
    template_customizado = models.BooleanField(
        default=False,
        verbose_name='Template Customizado',
        help_text='Se True, usa template_html do banco. Se False, busca arquivo padrão.'
    )
    template_arquivo = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Arquivo do Template',
        help_text='Caminho do arquivo template padrão (ex: reports/modules/estoque/estoque_por_location.html)'
    )
    template_html = models.TextField(
        blank=True,
        verbose_name='HTML do Template',
        help_text='HTML customizado do template (usado se template_customizado=True)'
    )
    template_css = models.TextField(
        blank=True,
        verbose_name='CSS Customizado',
        help_text='CSS adicional para o template'
    )
    
    # Configurações
    incluir_logo = models.BooleanField(
        default=True,
        verbose_name='Incluir Logo'
    )
    incluir_dados_empresa = models.BooleanField(
        default=True,
        verbose_name='Incluir Dados da Empresa'
    )
    orientacao = models.CharField(
        max_length=10,
        choices=[('portrait', 'Retrato'), ('landscape', 'Paisagem')],
        default='portrait',
        verbose_name='Orientação'
    )
    
    # Variáveis disponíveis (JSON)
    variaveis_disponiveis = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Variáveis Disponíveis',
        help_text='Variáveis que podem ser usadas no template (JSON)'
    )
    
    # Escopo (opcional - para customização por tenant/empresa)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        verbose_name='Tenant',
        help_text='Se especificado, template é específico deste tenant'
    )
    empresa = models.ForeignKey(
        'tenants.Empresa',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        verbose_name='Empresa',
        help_text='Se especificado, template é específico desta empresa'
    )
    
    # Ativo/Inativo
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_default = models.BooleanField(
        default=False,
        verbose_name='Template Padrão',
        help_text='Template padrão para este tipo de relatório'
    )
    
    class Meta:
        verbose_name = 'Template de Relatório'
        verbose_name_plural = 'Templates de Relatórios'
        ordering = ['modulo', 'tipo_relatorio', 'nome']
        indexes = [
            models.Index(fields=['modulo', 'tipo_relatorio']),
            models.Index(fields=['codigo']),
            models.Index(fields=['tenant', 'empresa']),
        ]
    
    def __str__(self):
        return f"{self.nome} ({self.modulo}/{self.tipo_relatorio})"


class ReportConfig(SiscrModelBase):
    """
    Configurações de relatório por tenant/empresa
    """
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        verbose_name='Tenant'
    )
    empresa = models.ForeignKey(
        'tenants.Empresa',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        verbose_name='Empresa',
        help_text='Se None, configuração é para todo o tenant'
    )
    
    # Logo e branding
    logo_url = models.URLField(
        blank=True,
        verbose_name='URL do Logo',
        help_text='URL externa do logo'
    )
    logo_upload = models.ImageField(
        upload_to='reports/logos/',
        blank=True,
        null=True,
        verbose_name='Logo Upload',
        help_text='Upload de logo (sobrescreve logo_url se especificado)'
    )
    
    # Dados da empresa (para header)
    nome_empresa = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Nome da Empresa',
        help_text='Se vazio, usa nome da empresa do modelo'
    )
    endereco = models.TextField(blank=True, verbose_name='Endereço')
    telefone = models.CharField(max_length=50, blank=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, verbose_name='Email')
    cnpj = models.CharField(max_length=20, blank=True, verbose_name='CNPJ')
    
    # Configurações padrão
    formato_padrao = models.CharField(
        max_length=10,
        choices=[('pdf', 'PDF'), ('html', 'HTML'), ('xlsx', 'Excel')],
        default='pdf',
        verbose_name='Formato Padrão'
    )
    
    # Email
    email_destinatario_padrao = models.EmailField(
        blank=True,
        verbose_name='Email Destinatário Padrão'
    )
    assunto_padrao = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Assunto Padrão'
    )
    
    class Meta:
        verbose_name = 'Configuração de Relatório'
        verbose_name_plural = 'Configurações de Relatórios'
        unique_together = [['tenant', 'empresa']]
        indexes = [
            models.Index(fields=['tenant', 'empresa']),
        ]
    
    def __str__(self):
        empresa_nome = self.empresa.nome if self.empresa else 'Todo Tenant'
        return f"Config: {self.tenant.schema_name} - {empresa_nome}"
