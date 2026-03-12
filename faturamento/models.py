"""
Models para o módulo de Faturamento
"""
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from core.base_models import SiscrModelBase


class NotaFiscalEletronica(SiscrModelBase):
    """
    Nota Fiscal Eletrônica (NF-e)
    """
    STATUS_SEFAZ_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('AUTORIZADA', 'Autorizada'),
        ('CANCELADA', 'Cancelada'),
        ('INUTILIZADA', 'Inutilizada'),
        ('REJEITADA', 'Rejeitada'),
        ('DENEGADA', 'Denegada'),
    ]
    
    # Identificação
    numero = models.IntegerField(verbose_name='Número')
    serie = models.CharField(max_length=3, default='1', verbose_name='Série')
    chave_acesso = models.CharField(
        max_length=44,
        unique=True,
        blank=True,
        null=True,
        verbose_name='Chave de Acesso',
        help_text='Chave de acesso da NF-e (44 caracteres)'
    )
    
    # Relacionamentos
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        related_name='notas_fiscais',
        verbose_name='Empresa'
    )
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='notas_fiscais',
        verbose_name='Filial'
    )
    cliente = models.ForeignKey(
        'cadastros.Pessoa',
        on_delete=models.PROTECT,
        related_name='notas_fiscais_recebidas',
        verbose_name='Cliente/Destinatário'
    )
    
    # Origem (pode vir de venda, compra, etc.)
    pedido_venda = models.ForeignKey(
        'vendas.PedidoVenda',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notas_fiscais',
        verbose_name='Pedido de Venda',
        help_text='Pedido de venda que originou esta NF-e'
    )
    
    # Status SEFAZ
    status_sefaz = models.CharField(
        max_length=20,
        choices=STATUS_SEFAZ_CHOICES,
        default='PENDENTE',
        verbose_name='Status SEFAZ'
    )
    protocolo_autorizacao = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Protocolo de Autorização',
        help_text='Protocolo retornado pela SEFAZ'
    )
    
    # XML e PDF
    xml_assinado = models.TextField(
        blank=True,
        null=True,
        verbose_name='XML Assinado',
        help_text='XML completo da NF-e assinado'
    )
    xml_retorno = models.TextField(
        blank=True,
        null=True,
        verbose_name='XML de Retorno',
        help_text='XML de retorno da SEFAZ'
    )
    pdf_path = models.FileField(
        upload_to='nfe_pdfs/',
        blank=True,
        null=True,
        verbose_name='PDF da NF-e'
    )
    
    # Datas
    data_emissao = models.DateTimeField(verbose_name='Data de Emissão')
    data_autorizacao = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Autorização',
        help_text='Data em que a NF-e foi autorizada pela SEFAZ'
    )
    data_cancelamento = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Cancelamento'
    )
    
    # Valores
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor Total'
    )
    valor_produtos = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor dos Produtos'
    )
    valor_impostos = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor dos Impostos'
    )
    valor_frete = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor do Frete'
    )
    valor_desconto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor do Desconto'
    )
    
    # Justificativa de cancelamento
    justificativa_cancelamento = models.TextField(
        blank=True,
        null=True,
        verbose_name='Justificativa de Cancelamento',
        help_text='Justificativa para cancelamento da NF-e'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'faturamento'
        verbose_name = 'Nota Fiscal Eletrônica'
        verbose_name_plural = 'Notas Fiscais Eletrônicas'
        ordering = ['-data_emissao', '-numero']
        unique_together = ['numero', 'serie', 'empresa']
        indexes = [
            models.Index(fields=['empresa', 'status_sefaz']),
            models.Index(fields=['cliente', 'data_emissao']),
            models.Index(fields=['chave_acesso']),
            models.Index(fields=['numero', 'serie']),
            models.Index(fields=['pedido_venda']),
        ]
    
    def __str__(self):
        return f"NF-e {self.numero}/{self.serie} - {self.cliente} - R$ {self.valor_total}"


class ItemNotaFiscal(SiscrModelBase):
    """
    Item da Nota Fiscal Eletrônica
    """
    nota_fiscal = models.ForeignKey(
        NotaFiscalEletronica,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name='Nota Fiscal'
    )
    produto = models.ForeignKey(
        'cadastros.Produto',
        on_delete=models.PROTECT,
        related_name='itens_nota_fiscal',
        verbose_name='Produto'
    )
    
    # Quantidade e valores
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        verbose_name='Quantidade'
    )
    valor_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor Unitário'
    )
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Valor Total',
        help_text='Quantidade × Valor Unitário'
    )
    valor_desconto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor do Desconto'
    )
    
    # Informações fiscais
    cfop = models.CharField(
        max_length=4,
        blank=True,
        null=True,
        verbose_name='CFOP',
        help_text='Código Fiscal de Operações e Prestações'
    )
    ncm = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        verbose_name='NCM',
        help_text='Nomenclatura Comum do Mercosul'
    )
    unidade_medida = models.CharField(
        max_length=10,
        default='UN',
        verbose_name='Unidade de Medida'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'faturamento'
        verbose_name = 'Item de Nota Fiscal'
        verbose_name_plural = 'Itens de Nota Fiscal'
        ordering = ['nota_fiscal', 'id']
        indexes = [
            models.Index(fields=['nota_fiscal', 'produto']),
        ]
    
    def save(self, *args, **kwargs):
        """Calcula valor_total automaticamente"""
        self.valor_total = (self.quantidade * self.valor_unitario) - self.valor_desconto
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.nota_fiscal.numero}/{self.nota_fiscal.serie} - {self.produto} ({self.quantidade})"


class NotaFiscalServico(SiscrModelBase):
    """
    Nota Fiscal de Serviços Eletrônica (NFSe)
    """
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('AUTORIZADA', 'Autorizada'),
        ('CANCELADA', 'Cancelada'),
        ('REJEITADA', 'Rejeitada'),
    ]
    
    # Identificação
    numero = models.IntegerField(verbose_name='Número')
    codigo_verificacao = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Código de Verificação'
    )
    
    # Relacionamentos
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        related_name='notas_fiscais_servico',
        verbose_name='Empresa'
    )
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='notas_fiscais_servico',
        verbose_name='Filial'
    )
    cliente = models.ForeignKey(
        'cadastros.Pessoa',
        on_delete=models.PROTECT,
        related_name='notas_fiscais_servico_recebidas',
        verbose_name='Cliente'
    )
    servico = models.ForeignKey(
        'cadastros.Servico',
        on_delete=models.PROTECT,
        related_name='notas_fiscais_servico',
        verbose_name='Serviço'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    
    # Datas
    data_emissao = models.DateTimeField(verbose_name='Data de Emissão')
    data_autorizacao = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Autorização'
    )
    
    # Valores
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor Total'
    )
    
    # PDF
    pdf_path = models.FileField(
        upload_to='nfse_pdfs/',
        blank=True,
        null=True,
        verbose_name='PDF da NFSe'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'faturamento'
        verbose_name = 'Nota Fiscal de Serviços'
        verbose_name_plural = 'Notas Fiscais de Serviços'
        ordering = ['-data_emissao', '-numero']
        indexes = [
            models.Index(fields=['empresa', 'status']),
            models.Index(fields=['cliente', 'data_emissao']),
        ]
    
    def __str__(self):
        return f"NFSe {self.numero} - {self.cliente} - R$ {self.valor_total}"
