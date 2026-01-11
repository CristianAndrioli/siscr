"""
Models para o módulo de Vendas
"""
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from core.base_models import SiscrModelBase


class PedidoVenda(SiscrModelBase):
    """
    Pedido de Venda
    """
    STATUS_CHOICES = [
        ('RASCUNHO', 'Rascunho'),
        ('PENDENTE', 'Pendente'),
        ('APROVADO', 'Aprovado'),
        ('FATURADO', 'Faturado'),
        ('CANCELADO', 'Cancelado'),
        ('ENTREGUE', 'Entregue'),
    ]
    
    # Identificação
    numero_pedido = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Número do Pedido',
        help_text='Número único do pedido (ex: PED-2024-001)'
    )
    
    # Relacionamentos
    cliente = models.ForeignKey(
        'cadastros.Pessoa',
        on_delete=models.PROTECT,
        related_name='pedidos_venda',
        verbose_name='Cliente',
        limit_choices_to={'tipo': 'PJ'}  # Apenas clientes (PJ)
    )
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        related_name='pedidos_venda',
        verbose_name='Empresa'
    )
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pedidos_venda',
        verbose_name='Filial'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='RASCUNHO',
        verbose_name='Status'
    )
    
    # Relacionamentos com outros módulos
    nota_fiscal = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name='Nota Fiscal',
        help_text='NF-e gerada a partir deste pedido'
    )
    
    # Valores
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Total',
        help_text='Soma dos valores dos itens'
    )
    valor_desconto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor do Desconto'
    )
    valor_frete = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor do Frete'
    )
    
    # Datas
    data_pedido = models.DateTimeField(verbose_name='Data do Pedido')
    data_aprovacao = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Aprovação'
    )
    data_faturamento = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Faturamento'
    )
    data_entrega = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Data de Entrega'
    )
    
    # Forma de pagamento
    forma_pagamento = models.CharField(
        max_length=50,
        choices=[
            ('PIX', 'PIX'),
            ('BOLETO', 'Boleto'),
            ('CARTAO_CREDITO', 'Cartão de Crédito'),
            ('CARTAO_DEBITO', 'Cartão de Débito'),
            ('DINHEIRO', 'Dinheiro'),
            ('TRANSFERENCIA', 'Transferência'),
        ],
        blank=True,
        null=True,
        verbose_name='Forma de Pagamento'
    )
    
    # Parcelamento
    numero_parcelas = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name='Número de Parcelas'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'vendas'
        verbose_name = 'Pedido de Venda'
        verbose_name_plural = 'Pedidos de Venda'
        ordering = ['-data_pedido', '-numero_pedido']
        indexes = [
            models.Index(fields=['cliente', 'status']),
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['status', 'data_pedido']),
            models.Index(fields=['numero_pedido']),
        ]
    
    def save(self, *args, **kwargs):
        """Calcula valor_total automaticamente"""
        if self.pk:
            # Se já existe, calcular baseado nos itens
            itens = self.itens.all()
            self.valor_total = sum(item.valor_total for item in itens) - self.valor_desconto + self.valor_frete
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.numero_pedido} - {self.cliente} - R$ {self.valor_total}"


class ItemPedido(SiscrModelBase):
    """
    Item do Pedido de Venda
    """
    pedido = models.ForeignKey(
        PedidoVenda,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name='Pedido'
    )
    produto = models.ForeignKey(
        'cadastros.Produto',
        on_delete=models.PROTECT,
        related_name='itens_pedido',
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
    
    # Estoque
    location = models.ForeignKey(
        'estoque.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='itens_pedido',
        verbose_name='Location',
        help_text='Location de onde o produto será retirado'
    )
    movimentacao_estoque = models.ForeignKey(
        'estoque.MovimentacaoEstoque',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='itens_pedido',
        verbose_name='Movimentação de Estoque',
        help_text='Movimentação de estoque gerada quando o pedido foi faturado'
    )
    
    # Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        app_label = 'vendas'
        verbose_name = 'Item do Pedido'
        verbose_name_plural = 'Itens do Pedido'
        ordering = ['pedido', 'id']
        indexes = [
            models.Index(fields=['pedido', 'produto']),
            models.Index(fields=['location']),
        ]
    
    def save(self, *args, **kwargs):
        """Calcula valor_total automaticamente"""
        self.valor_total = (self.quantidade * self.valor_unitario) - self.valor_desconto
        super().save(*args, **kwargs)
        
        # Atualizar valor_total do pedido
        if self.pedido:
            self.pedido.save()
    
    def __str__(self):
        return f"{self.pedido.numero_pedido} - {self.produto} ({self.quantidade})"
