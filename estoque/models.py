"""
Models para o módulo de Estoque
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from decimal import Decimal
from core.base_models import SiscrModelBase

# Estados brasileiros (reutilizando do cadastros)
ESTADOS_CHOICES = [
    ('AC', 'Acre'),
    ('AL', 'Alagoas'),
    ('AP', 'Amapá'),
    ('AM', 'Amazonas'),
    ('BA', 'Bahia'),
    ('CE', 'Ceará'),
    ('DF', 'Distrito Federal'),
    ('ES', 'Espírito Santo'),
    ('GO', 'Goiás'),
    ('MA', 'Maranhão'),
    ('MT', 'Mato Grosso'),
    ('MS', 'Mato Grosso do Sul'),
    ('MG', 'Minas Gerais'),
    ('PA', 'Pará'),
    ('PB', 'Paraíba'),
    ('PR', 'Paraná'),
    ('PE', 'Pernambuco'),
    ('PI', 'Piauí'),
    ('RJ', 'Rio de Janeiro'),
    ('RN', 'Rio Grande do Norte'),
    ('RS', 'Rio Grande do Sul'),
    ('RO', 'Rondônia'),
    ('RR', 'Roraima'),
    ('SC', 'Santa Catarina'),
    ('SP', 'São Paulo'),
    ('SE', 'Sergipe'),
    ('TO', 'Tocantins'),
]


class Location(SiscrModelBase):
    """
    Location (Localização Física) - Representa um local físico onde estoque é armazenado
    Pode ser: loja, almoxarifado, armazém, centro de distribuição, etc.
    
    Estrutura Flexível:
    - Location sempre vinculada a uma Empresa (obrigatório)
    - Location pode ser vinculada a uma Filial (opcional)
    - Se filial=None: Location é da empresa (compartilhada ou empresa sem filiais)
    - Se filial!=None: Location é específica da filial
    """
    TIPO_CHOICES = [
        ('LOJA', 'Loja'),
        ('ALMOXARIFADO', 'Almoxarifado'),
        ('ARMAZEM', 'Armazém'),
        ('CENTRO_DISTRIBUICAO', 'Centro de Distribuição'),
        ('ESTOQUE_TERCEIRO', 'Estoque em Terceiros'),
        ('OUTRO', 'Outro'),
    ]
    
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.CASCADE,
        related_name='locations',
        verbose_name='Empresa',
        help_text='Empresa proprietária da location (obrigatório)'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.CASCADE,
        related_name='locations',
        null=True,
        blank=True,
        verbose_name='Filial',
        help_text='Filial específica (opcional). Se vazio, location é da empresa.'
    )
    
    nome = models.CharField(max_length=255, verbose_name='Nome da Location')
    codigo = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código',
        help_text='Código único para identificar a location'
    )
    
    tipo = models.CharField(
        max_length=30,
        choices=TIPO_CHOICES,
        verbose_name='Tipo de Location'
    )
    
    # Endereço Completo
    logradouro = models.CharField(max_length=255, verbose_name='Logradouro')
    numero = models.CharField(max_length=10, verbose_name='Número')
    letra = models.CharField(max_length=2, blank=True, null=True, verbose_name='Letra')
    complemento = models.CharField(max_length=100, blank=True, null=True, verbose_name='Complemento')
    bairro = models.CharField(max_length=100, verbose_name='Bairro')
    cidade = models.CharField(max_length=100, verbose_name='Cidade')
    estado = models.CharField(max_length=2, choices=ESTADOS_CHOICES, verbose_name='Estado')
    cep = models.CharField(max_length=9, verbose_name='CEP')
    
    # Coordenadas (opcional, para cálculo de distância)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name='Latitude',
        help_text='Coordenada para cálculo de distância/proximidade'
    )
    longitude = models.DecimalField(
        max_digits=11,
        decimal_places=8,
        blank=True,
        null=True,
        verbose_name='Longitude',
        help_text='Coordenada para cálculo de distância/proximidade'
    )
    
    # Contato
    responsavel = models.CharField(max_length=255, blank=True, null=True, verbose_name='Responsável')
    telefone = models.CharField(max_length=15, blank=True, null=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    
    # Configurações
    permite_entrada = models.BooleanField(
        default=True,
        verbose_name='Permite Entrada',
        help_text='Se esta location pode receber entradas de estoque'
    )
    permite_saida = models.BooleanField(
        default=True,
        verbose_name='Permite Saída',
        help_text='Se esta location pode fazer saídas de estoque'
    )
    permite_transferencia = models.BooleanField(
        default=True,
        verbose_name='Permite Transferência',
        help_text='Se esta location pode receber/enviar transferências'
    )
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    
    class Meta:
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'
        ordering = ['empresa', 'nome']
        indexes = [
            models.Index(fields=['empresa', 'is_active']),
            models.Index(fields=['tipo', 'is_active']),
            models.Index(fields=['codigo']),
            models.Index(fields=['filial', 'is_active']),
        ]
    
    def clean(self):
        """Validações do modelo Location"""
        # Filial deve pertencer à empresa
        if self.filial and self.filial.empresa != self.empresa:
            raise ValidationError({
                'filial': 'A filial deve pertencer à empresa selecionada.'
            })
    
    def save(self, *args, **kwargs):
        """Override save para executar clean"""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.nome} ({self.get_tipo_display()})"
    
    @property
    def endereco_completo(self):
        """Retorna endereço formatado"""
        partes = [
            f"{self.logradouro}, {self.numero}",
            self.letra,
            self.complemento,
            self.bairro,
            f"{self.cidade}/{self.estado}",
            self.cep
        ]
        return ", ".join([p for p in partes if p])


class Estoque(SiscrModelBase):
    """
    Estoque físico vinculado a uma Location
    """
    produto = models.ForeignKey(
        'cadastros.Produto',
        on_delete=models.PROTECT,
        related_name='estoques',
        verbose_name='Produto'
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='estoques',
        verbose_name='Location'
    )
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        related_name='estoques',
        verbose_name='Empresa'
    )
    
    # Quantidades
    quantidade_atual = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Atual'
    )
    quantidade_reservada = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Reservada'
    )
    quantidade_disponivel = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        editable=False,
        verbose_name='Quantidade Disponível'
    )
    
    # Quantidades Previstas (para planejamento)
    quantidade_prevista_entrada = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Prevista Entrada',
        help_text='Quantidade esperada em entradas futuras (compras, transferências)'
    )
    quantidade_prevista_saida = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Prevista Saída',
        help_text='Quantidade esperada em saídas futuras (vendas, transferências)'
    )
    
    # Localização física dentro da location
    localizacao_interna = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Localização Interna',
        help_text='Ex: Prateleira A-3, Setor B, Corredor 5'
    )
    
    # Valores médios
    valor_custo_medio = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Custo Médio'
    )
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        editable=False,
        verbose_name='Valor Total'
    )
    
    # Controle
    estoque_minimo = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Estoque Mínimo',
        help_text='Alerta quando estoque ficar abaixo deste valor'
    )
    estoque_maximo = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Estoque Máximo',
        help_text='Sugestão de compra quando estoque ficar abaixo deste valor'
    )
    
    class Meta:
        verbose_name = 'Estoque'
        verbose_name_plural = 'Estoques'
        unique_together = ['produto', 'location']
        indexes = [
            models.Index(fields=['empresa', 'location']),
            models.Index(fields=['produto', 'location']),
            models.Index(fields=['location', 'is_deleted']),
            models.Index(fields=['empresa', 'produto']),
        ]
    
    def save(self, *args, **kwargs):
        """Override save para calcular campos derivados"""
        # Calcular quantidade disponível
        self.quantidade_disponivel = self.quantidade_atual - self.quantidade_reservada
        
        # Calcular valor total
        self.valor_total = self.quantidade_atual * self.valor_custo_medio
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.produto} - {self.location.nome} ({self.quantidade_atual})"
    
    @property
    def quantidade_disponivel_com_prevista(self):
        """
        Retorna quantidade disponível considerando previsões
        Disponível = Atual - Reservada + Prevista Entrada - Prevista Saída
        """
        return (
            self.quantidade_atual
            - self.quantidade_reservada
            + self.quantidade_prevista_entrada
            - self.quantidade_prevista_saida
        )
    
    @property
    def abaixo_estoque_minimo(self):
        """Verifica se estoque está abaixo do mínimo"""
        return self.quantidade_atual < self.estoque_minimo
    
    @classmethod
    def get_consolidado_empresa(cls, produto, empresa):
        """Retorna estoque consolidado de uma empresa"""
        estoques = cls.objects.filter(
            produto=produto,
            empresa=empresa
        )
        return {
            'total': sum(e.quantidade_atual for e in estoques),
            'reservado': sum(e.quantidade_reservada for e in estoques),
            'disponivel': sum(e.quantidade_disponivel for e in estoques),
        }


class MovimentacaoEstoque(SiscrModelBase):
    """
    Histórico de movimentações de estoque
    Suporta entradas, saídas e transferências dentro do mesmo tenant
    Quantidade sempre positiva - usar campo tipo para indicar entrada/saída
    """
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SAIDA', 'Saída'),
        ('TRANSFERENCIA', 'Transferência'),
        ('AJUSTE', 'Ajuste'),
        ('RESERVA', 'Reserva'),
        ('CANCELAMENTO_RESERVA', 'Cancelamento de Reserva'),
    ]
    
    ORIGEM_CHOICES = [
        ('COMPRA', 'Compra'),
        ('VENDA', 'Venda'),
        ('DEVOLUCAO', 'Devolução'),
        ('TRANSFERENCIA', 'Transferência entre Locations'),
        ('AJUSTE_MANUAL', 'Ajuste Manual'),
        ('PERDA', 'Perda/Danificação'),
        ('RESERVA', 'Reserva de Venda'),
        ('CANCELAMENTO_NF', 'Cancelamento de Nota Fiscal'),
        ('RETORNO_NF', 'Retorno de Nota Fiscal'),
    ]
    
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('REVERTIDA', 'Revertida'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.PROTECT,
        related_name='movimentacoes',
        verbose_name='Estoque'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, verbose_name='Tipo')
    origem = models.CharField(max_length=20, choices=ORIGEM_CHOICES, verbose_name='Origem')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='CONFIRMADA',
        verbose_name='Status'
    )
    
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        verbose_name='Quantidade',
        help_text='Quantidade sempre positiva. Use o campo tipo para indicar entrada/saída.'
    )
    quantidade_anterior = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Anterior'
    )
    quantidade_posterior = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name='Quantidade Posterior'
    )
    
    valor_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Valor Unitário'
    )
    valor_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Valor Total'
    )
    
    # Para transferências entre locations (dentro do mesmo tenant)
    location_origem = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='movimentacoes_origem',
        null=True,
        blank=True,
        verbose_name='Location Origem',
        help_text='Location de origem (para transferências)'
    )
    location_destino = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='movimentacoes_destino',
        null=True,
        blank=True,
        verbose_name='Location Destino',
        help_text='Location de destino (para transferências)'
    )
    
    # Referências
    documento_referencia = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Documento de Referência',
        help_text='Ex: NF-001234, Pedido-567'
    )
    numero_nota_fiscal = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Número da Nota Fiscal',
        help_text='Número da NF relacionada (para cancelamento/retorno)'
    )
    serie_nota_fiscal = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        verbose_name='Série da Nota Fiscal'
    )
    
    # Para rastreamento de cancelamento/retorno
    movimentacao_original = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='movimentacoes_reversas',
        verbose_name='Movimentação Original',
        help_text='Movimentação que foi cancelada/revertida'
    )
    motivo_cancelamento = models.TextField(
        blank=True,
        null=True,
        verbose_name='Motivo do Cancelamento',
        help_text='Motivo do cancelamento ou retorno'
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    data_movimentacao = models.DateTimeField(auto_now_add=True, verbose_name='Data da Movimentação')
    data_prevista = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Data Prevista',
        help_text='Data prevista para movimentação (para previsões)'
    )
    
    class Meta:
        verbose_name = 'Movimentação de Estoque'
        verbose_name_plural = 'Movimentações de Estoque'
        ordering = ['-data_movimentacao']
        indexes = [
            models.Index(fields=['estoque', 'data_movimentacao']),
            models.Index(fields=['tipo', 'data_movimentacao']),
            models.Index(fields=['origem', 'status']),
            models.Index(fields=['numero_nota_fiscal', 'serie_nota_fiscal']),
            models.Index(fields=['location_origem', 'location_destino']),
        ]
    
    def clean(self):
        """Validação: quantidade sempre positiva"""
        if self.quantidade <= 0:
            raise ValidationError({
                'quantidade': 'Quantidade deve ser sempre positiva. Use o campo tipo para indicar entrada/saída.'
            })
    
    def save(self, *args, **kwargs):
        """Override save para executar clean e calcular valor_total"""
        self.full_clean()
        # Calcular valor total se não foi fornecido
        if not self.valor_total and self.valor_unitario and self.quantidade:
            self.valor_total = self.valor_unitario * self.quantidade
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.tipo} - {self.estoque.produto} ({self.quantidade})"
    
    def calcular_impacto_estoque(self):
        """
        Retorna o impacto no estoque (positivo para entrada, negativo para saída)
        """
        if self.tipo == 'ENTRADA':
            return self.quantidade
        elif self.tipo == 'SAIDA':
            return -self.quantidade
        elif self.tipo == 'TRANSFERENCIA':
            # Transferência não impacta estoque total, apenas move entre locations
            return 0
        else:
            return 0
    
    def reverter(self, motivo=None):
        """
        Reverte uma movimentação (para cancelamento de NF, retorno, etc.)
        Cria movimentação reversa
        """
        if self.status == 'REVERTIDA':
            raise ValueError("Movimentação já foi revertida")
        
        # Criar movimentação reversa
        movimentacao_reversa = MovimentacaoEstoque.objects.create(
            estoque=self.estoque,
            tipo='ENTRADA' if self.tipo == 'SAIDA' else 'SAIDA',
            origem='RETORNO_NF' if self.origem == 'COMPRA' else 'CANCELAMENTO_NF',
            status='CONFIRMADA',
            quantidade=self.quantidade,
            quantidade_anterior=self.estoque.quantidade_atual,
            quantidade_posterior=self.estoque.quantidade_atual + (
                self.quantidade if self.tipo == 'SAIDA' else -self.quantidade
            ),
            valor_unitario=self.valor_unitario,
            valor_total=self.valor_total,
            location_origem=self.location_destino,
            location_destino=self.location_origem,
            documento_referencia=self.documento_referencia,
            numero_nota_fiscal=self.numero_nota_fiscal,
            serie_nota_fiscal=self.serie_nota_fiscal,
            movimentacao_original=self,
            motivo_cancelamento=motivo or f"Reversão de {self.get_tipo_display()}",
            observacoes=f"Reversão da movimentação #{self.id}"
        )
        
        # Atualizar estoque
        if self.tipo == 'SAIDA':
            self.estoque.quantidade_atual += self.quantidade
        else:
            self.estoque.quantidade_atual -= self.quantidade
        
        self.estoque.save()
        
        # Marcar original como revertida
        self.status = 'REVERTIDA'
        self.save()
        
        return movimentacao_reversa
