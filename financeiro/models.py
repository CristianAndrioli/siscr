"""
Models para o módulo Financeiro
"""
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from core.base_models import SiscrModelBase


class ContaReceber(SiscrModelBase):
    """
    Modelo para Contas a Receber
    Movido de cadastros para financeiro
    """
    
    STATUS_CHOICES = [
        ('Pendente', 'Pendente'),
        ('Parcial', 'Parcialmente Pago'),
        ('Pago', 'Pago'),
        ('Cancelado', 'Cancelado'),
        ('Vencido', 'Vencido'),
    ]
    
    FORMA_PAGAMENTO_CHOICES = [
        ('Dinheiro', 'Dinheiro'),
        ('PIX', 'PIX'),
        ('Boleto', 'Boleto'),
        ('Cartão Crédito', 'Cartão de Crédito'),
        ('Cartão Débito', 'Cartão de Débito'),
        ('Transferência', 'Transferência Bancária'),
        ('Cheque', 'Cheque'),
    ]
    
    # Identificação
    codigo_conta = models.IntegerField(primary_key=True, verbose_name='Código da Conta')
    numero_documento = models.CharField(max_length=50, unique=True, verbose_name='Número do Documento')
    
    # Relacionamentos
    cliente = models.ForeignKey(
        'cadastros.Pessoa',
        on_delete=models.PROTECT,
        related_name='contas_receber',
        verbose_name='Cliente',
        limit_choices_to={'tipo': 'PJ'}  # Apenas clientes (PJ)
    )
    
    # Origem (pode vir de venda, serviço, etc.)
    nota_fiscal = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Nota Fiscal',
        help_text='Nota Fiscal que originou esta conta'
    )
    pedido_venda = models.ForeignKey(
        'vendas.PedidoVenda',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Pedido de Venda',
        help_text='Pedido de venda que originou esta conta'
    )
    
    # Valores
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor Total'
    )
    valor_recebido = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Recebido'
    )
    valor_pendente = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Pendente',
        editable=False
    )
    
    # Datas
    data_emissao = models.DateField(verbose_name='Data de Emissão')
    data_vencimento = models.DateField(verbose_name='Data de Vencimento')
    data_recebimento = models.DateField(blank=True, null=True, verbose_name='Data de Recebimento')
    
    # Status e Forma de Pagamento
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Pendente',
        verbose_name='Status'
    )
    forma_pagamento = models.CharField(
        max_length=20,
        choices=FORMA_PAGAMENTO_CHOICES,
        blank=True,
        null=True,
        verbose_name='Forma de Pagamento'
    )
    
    # Informações Adicionais
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    # Vínculo com Empresa/Filial (para separação de dados)
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_receber',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )
    
    class Meta:
        app_label = 'financeiro'
        verbose_name = 'Conta a Receber'
        verbose_name_plural = 'Contas a Receber'
        ordering = ['-data_vencimento', '-codigo_conta']
        indexes = [
            models.Index(fields=['cliente', 'status']),
            models.Index(fields=['data_vencimento', 'status']),
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
            models.Index(fields=['nota_fiscal']),
            models.Index(fields=['pedido_venda']),
        ]
    
    def save(self, *args, **kwargs):
        # Importar timezone aqui para evitar problemas de importação circular
        from django.utils import timezone
        
        # Calcular valor pendente automaticamente
        self.valor_pendente = self.valor_total - self.valor_recebido
        
        # Atualizar status baseado nos valores
        if self.valor_pendente <= 0:
            self.status = 'Pago'
            if not self.data_recebimento:
                self.data_recebimento = timezone.now().date()
        elif self.valor_recebido > 0:
            self.status = 'Parcial'
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.status = 'Vencido'
        else:
            self.status = 'Pendente'
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.numero_documento} - {self.cliente} - R$ {self.valor_total}"


class ContaPagar(SiscrModelBase):
    """
    Modelo para Contas a Pagar
    Movido de cadastros para financeiro
    """
    
    STATUS_CHOICES = [
        ('Pendente', 'Pendente'),
        ('Parcial', 'Parcialmente Pago'),
        ('Pago', 'Pago'),
        ('Cancelado', 'Cancelado'),
        ('Vencido', 'Vencido'),
    ]
    
    FORMA_PAGAMENTO_CHOICES = [
        ('Dinheiro', 'Dinheiro'),
        ('PIX', 'PIX'),
        ('Boleto', 'Boleto'),
        ('Cartão Crédito', 'Cartão de Crédito'),
        ('Cartão Débito', 'Cartão de Débito'),
        ('Transferência', 'Transferência Bancária'),
        ('Cheque', 'Cheque'),
    ]
    
    # Identificação
    codigo_conta = models.IntegerField(primary_key=True, verbose_name='Código da Conta')
    numero_documento = models.CharField(max_length=50, unique=True, verbose_name='Número do Documento')
    
    # Relacionamentos
    fornecedor = models.ForeignKey(
        'cadastros.Pessoa',
        on_delete=models.PROTECT,
        related_name='contas_pagar',
        verbose_name='Fornecedor',
        limit_choices_to={'tipo': 'PJ'}  # Apenas fornecedores (PJ)
    )
    
    # Origem (pode vir de compra, serviço, etc.)
    nota_fiscal_entrada = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contas_pagar',
        verbose_name='Nota Fiscal de Entrada',
        help_text='Nota Fiscal de entrada que originou esta conta'
    )
    
    # Valores
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor Total'
    )
    valor_pago = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Pago'
    )
    valor_pendente = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Pendente',
        editable=False
    )
    
    # Datas
    data_emissao = models.DateField(verbose_name='Data de Emissão')
    data_vencimento = models.DateField(verbose_name='Data de Vencimento')
    data_pagamento = models.DateField(blank=True, null=True, verbose_name='Data de Pagamento')
    
    # Status e Forma de Pagamento
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Pendente',
        verbose_name='Status'
    )
    forma_pagamento = models.CharField(
        max_length=20,
        choices=FORMA_PAGAMENTO_CHOICES,
        blank=True,
        null=True,
        verbose_name='Forma de Pagamento'
    )
    
    # Informações Adicionais
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    # Vínculo com Empresa/Filial (para separação de dados)
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_pagar',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='contas_pagar',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )
    
    class Meta:
        app_label = 'financeiro'
        verbose_name = 'Conta a Pagar'
        verbose_name_plural = 'Contas a Pagar'
        ordering = ['-data_vencimento', '-codigo_conta']
        indexes = [
            models.Index(fields=['fornecedor', 'status']),
            models.Index(fields=['data_vencimento', 'status']),
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
            models.Index(fields=['nota_fiscal_entrada']),
        ]
    
    def save(self, *args, **kwargs):
        # Importar timezone aqui para evitar problemas de importação circular
        from django.utils import timezone
        
        # Calcular valor pendente automaticamente
        self.valor_pendente = self.valor_total - self.valor_pago
        
        # Atualizar status baseado nos valores
        if self.valor_pendente <= 0:
            self.status = 'Pago'
            if not self.data_pagamento:
                self.data_pagamento = timezone.now().date()
        elif self.valor_pago > 0:
            self.status = 'Parcial'
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.status = 'Vencido'
        else:
            self.status = 'Pendente'
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.numero_documento} - {self.fornecedor} - R$ {self.valor_total}"


class Boleto(SiscrModelBase):
    """
    Boleto Bancário gerado a partir de Conta a Receber
    """
    STATUS_CHOICES = [
        ('GERADO', 'Gerado'),
        ('REGISTRADO', 'Registrado'),
        ('PAGO', 'Pago'),
        ('CANCELADO', 'Cancelado'),
        ('VENCIDO', 'Vencido'),
    ]
    
    conta_receber = models.ForeignKey(
        ContaReceber,
        on_delete=models.CASCADE,
        related_name='boletos',
        verbose_name='Conta a Receber'
    )
    
    # Dados do boleto
    nosso_numero = models.CharField(
        max_length=20,
        verbose_name='Nosso Número',
        help_text='Número de controle do boleto'
    )
    codigo_barras = models.CharField(
        max_length=44,
        verbose_name='Código de Barras'
    )
    linha_digitavel = models.CharField(
        max_length=48,
        verbose_name='Linha Digitável'
    )
    
    # Integração com gateway
    gateway = models.CharField(
        max_length=50,
        choices=[
            ('gerencianet', 'Gerencianet'),
            ('pagseguro', 'PagSeguro'),
            ('banco_brasil', 'Banco do Brasil'),
            ('bradesco', 'Bradesco'),
            ('itaú', 'Itaú'),
        ],
        verbose_name='Gateway',
        help_text='Gateway usado para gerar o boleto'
    )
    gateway_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='ID no Gateway',
        help_text='ID do boleto no gateway'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='GERADO',
        verbose_name='Status'
    )
    
    # Datas
    data_vencimento = models.DateField(verbose_name='Data de Vencimento')
    data_pagamento = models.DateField(
        blank=True,
        null=True,
        verbose_name='Data de Pagamento'
    )
    
    # Arquivos
    pdf_path = models.FileField(
        upload_to='boletos/',
        blank=True,
        null=True,
        verbose_name='PDF do Boleto'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'financeiro'
        verbose_name = 'Boleto'
        verbose_name_plural = 'Boletos'
        ordering = ['-data_vencimento', '-created_at']
        indexes = [
            models.Index(fields=['conta_receber', 'status']),
            models.Index(fields=['gateway', 'gateway_id']),
            models.Index(fields=['data_vencimento', 'status']),
        ]
    
    def __str__(self):
        return f"Boleto {self.nosso_numero} - {self.conta_receber}"


class TransacaoPagamento(SiscrModelBase):
    """
    Transação de Pagamento (PIX, Cartão, etc.)
    """
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('PROCESSANDO', 'Processando'),
        ('APROVADO', 'Aprovado'),
        ('RECUSADO', 'Recusado'),
        ('ESTORNADO', 'Estornado'),
        ('CANCELADO', 'Cancelado'),
    ]
    
    METODO_CHOICES = [
        ('PIX', 'PIX'),
        ('CARTAO_CREDITO', 'Cartão de Crédito'),
        ('CARTAO_DEBITO', 'Cartão de Débito'),
        ('BOLETO', 'Boleto'),
        ('DINHEIRO', 'Dinheiro'),
        ('TRANSFERENCIA', 'Transferência Bancária'),
    ]
    
    GATEWAY_CHOICES = [
        ('mercadopago', 'Mercado Pago'),
        ('pagseguro', 'PagSeguro'),
        ('stripe', 'Stripe'),
        ('gerencianet', 'Gerencianet'),
        ('asaas', 'Asaas'),
    ]
    
    conta_receber = models.ForeignKey(
        ContaReceber,
        on_delete=models.CASCADE,
        related_name='transacoes',
        verbose_name='Conta a Receber'
    )
    
    # Gateway
    gateway = models.CharField(
        max_length=50,
        choices=GATEWAY_CHOICES,
        verbose_name='Gateway de Pagamento'
    )
    gateway_transaction_id = models.CharField(
        max_length=255,
        verbose_name='ID da Transação no Gateway',
        help_text='ID retornado pelo gateway'
    )
    
    # Método de pagamento
    metodo_pagamento = models.CharField(
        max_length=20,
        choices=METODO_CHOICES,
        verbose_name='Método de Pagamento'
    )
    
    # Valores
    valor = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Valor'
    )
    valor_liquido = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Valor Líquido',
        help_text='Valor após descontar taxas do gateway'
    )
    taxa_gateway = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Taxa do Gateway'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    
    # Datas
    data_pagamento = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Pagamento'
    )
    
    # Dados adicionais do gateway (JSON)
    dados_gateway = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Dados do Gateway',
        help_text='Dados completos retornados pelo gateway (JSON)'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'financeiro'
        verbose_name = 'Transação de Pagamento'
        verbose_name_plural = 'Transações de Pagamento'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['conta_receber', 'status']),
            models.Index(fields=['gateway', 'gateway_transaction_id']),
            models.Index(fields=['status', 'data_pagamento']),
        ]
    
    def __str__(self):
        return f"{self.get_gateway_display()} - {self.get_metodo_pagamento_display()} - R$ {self.valor} ({self.get_status_display()})"
