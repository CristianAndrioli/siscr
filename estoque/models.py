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


class ReservaEstoque(SiscrModelBase):
    """
    Reserva de estoque (Soft ou Hard Reservation)
    
    SOFT: Reserva temporária que não bloqueia estoque físico
    HARD: Reserva confirmada que bloqueia estoque físico (atualiza quantidade_reservada)
    
    Inspirado no conceito de Salesforce Omnichannel Inventory
    """
    TIPO_CHOICES = [
        ('SOFT', 'Soft Reservation'),
        ('HARD', 'Hard Reservation'),
    ]
    
    ORIGEM_CHOICES = [
        ('VENDA', 'Venda'),
        ('ECOMMERCE', 'E-commerce'),
        ('PEDIDO', 'Pedido'),
        ('COTACAO', 'Cotação'),
        ('OUTRO', 'Outro'),
    ]
    
    STATUS_CHOICES = [
        ('ATIVA', 'Ativa'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('EXPIRADA', 'Expirada'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.PROTECT,
        related_name='reservas',
        verbose_name='Estoque',
        help_text='Estoque específico onde a reserva foi feita'
    )
    
    tipo = models.CharField(
        max_length=10,
        choices=TIPO_CHOICES,
        default='SOFT',
        verbose_name='Tipo de Reserva',
        help_text='SOFT: não bloqueia estoque. HARD: bloqueia estoque físico.'
    )
    
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        verbose_name='Origem',
        help_text='Origem da reserva (venda, e-commerce, etc.)'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ATIVA',
        verbose_name='Status'
    )
    
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        verbose_name='Quantidade Reservada'
    )
    
    data_expiracao = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Data de Expiração',
        help_text='Data/hora em que a reserva expira (para SOFT reservations)'
    )
    
    documento_referencia = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Documento de Referência',
        help_text='Ex: ID do Pedido de Venda, ID do Carrinho'
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    class Meta:
        verbose_name = 'Reserva de Estoque'
        verbose_name_plural = 'Reservas de Estoque'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['estoque', 'status']),
            models.Index(fields=['tipo', 'status']),
            models.Index(fields=['data_expiracao', 'status']),
            models.Index(fields=['origem', 'status']),
        ]
    
    def __str__(self):
        return f"Reserva {self.get_tipo_display()} - {self.estoque.produto} ({self.quantidade})"
    
    def clean(self):
        """Validações do modelo"""
        # SOFT reservations devem ter data de expiração
        if self.tipo == 'SOFT' and not self.data_expiracao:
            raise ValidationError({
                'data_expiracao': 'Reservas SOFT devem ter data de expiração definida.'
            })
        
        # Validar quantidade não excede estoque disponível (se HARD)
        if self.tipo == 'HARD' and self.status == 'ATIVA':
            estoque_disponivel = self.estoque.quantidade_disponivel
            outras_reservas_hard = ReservaEstoque.objects.filter(
                estoque=self.estoque,
                tipo='HARD',
                status='ATIVA'
            ).exclude(id=self.id).aggregate(
                total=models.Sum('quantidade')
            )['total'] or Decimal('0.000')
            
            disponivel_para_reserva = estoque_disponivel - outras_reservas_hard
            if self.quantidade > disponivel_para_reserva:
                raise ValidationError({
                    'quantidade': f'Quantidade excede estoque disponível para reserva. '
                                f'Disponível: {disponivel_para_reserva}'
                })
    
    def save(self, *args, **kwargs):
        """Override save para executar clean e atualizar estoque"""
        self.full_clean()
        
        # Se é HARD e está sendo criada/ativada, atualizar quantidade_reservada
        if self.tipo == 'HARD' and self.status == 'ATIVA':
            # Se é uma nova reserva ou está sendo reativada
            if not self.pk or (self.pk and self.status == 'ATIVA'):
                # Verificar se já existe estoque reservado (para evitar duplicação)
                # Isso será gerenciado pelo método confirmar()
                pass
        
        super().save(*args, **kwargs)
    
    def confirmar(self):
        """
        Confirma uma reserva SOFT, convertendo para HARD e baixando estoque
        """
        if self.status != 'ATIVA':
            raise ValueError(f"Reserva não está ativa. Status atual: {self.status}")
        
        if self.tipo == 'SOFT':
            # Converter SOFT para HARD
            self.tipo = 'HARD'
            self.data_expiracao = None  # HARD não expira
        
        # Atualizar estoque
        self.estoque.quantidade_reservada += self.quantidade
        self.estoque.save()
        
        # Atualizar status
        self.status = 'CONFIRMADA'
        self.save()
        
        return self
    
    def cancelar(self, motivo=None):
        """
        Cancela uma reserva e libera estoque se necessário
        """
        if self.status in ['CANCELADA', 'EXPIRADA']:
            raise ValueError(f"Reserva já está {self.status.lower()}")
        
        # Se é HARD e está confirmada, liberar estoque
        if self.tipo == 'HARD' and self.status == 'CONFIRMADA':
            self.estoque.quantidade_reservada = max(
                Decimal('0.000'),
                self.estoque.quantidade_reservada - self.quantidade
            )
            self.estoque.save()
        
        self.status = 'CANCELADA'
        if motivo:
            self.observacoes = f"{self.observacoes or ''}\nCancelado: {motivo}".strip()
        self.save()
        
        return self
    
    def expirar(self):
        """
        Expira uma reserva SOFT (chamado por tarefa Celery)
        """
        if self.tipo != 'SOFT':
            raise ValueError("Apenas reservas SOFT podem expirar")
        
        if self.status != 'ATIVA':
            raise ValueError(f"Reserva não está ativa. Status atual: {self.status}")
        
        self.status = 'EXPIRADA'
        self.save()
        
        return self
    
    @property
    def esta_expirada(self):
        """Verifica se a reserva está expirada"""
        if self.tipo == 'SOFT' and self.data_expiracao:
            from django.utils import timezone
            return timezone.now() > self.data_expiracao
        return False


class PrevisaoMovimentacao(SiscrModelBase):
    """
    Previsão de movimentação de estoque (para planejamento)
    
    Permite rastrear movimentações futuras esperadas e atualizar
    automaticamente as quantidades previstas no estoque.
    """
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SAIDA', 'Saída'),
        ('TRANSFERENCIA', 'Transferência'),
    ]
    
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('REALIZADA', 'Realizada'),
    ]
    
    ORIGEM_CHOICES = [
        ('COMPRA', 'Compra'),
        ('VENDA', 'Venda'),
        ('TRANSFERENCIA', 'Transferência entre Locations'),
        ('PRODUCAO', 'Produção'),
        ('OUTRO', 'Outro'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.CASCADE,
        related_name='previsoes',
        verbose_name='Estoque',
        help_text='Estoque que será afetado pela movimentação'
    )
    
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        verbose_name='Tipo de Movimentação'
    )
    
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        verbose_name='Origem'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        verbose_name='Quantidade'
    )
    
    data_prevista = models.DateTimeField(
        verbose_name='Data Prevista',
        help_text='Data/hora prevista para a movimentação'
    )
    
    valor_unitario_previsto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Valor Unitário Previsto'
    )
    
    documento_referencia = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Documento de Referência',
        help_text='Ex: ID do Pedido de Compra, ID do Pedido de Venda'
    )
    
    # Para transferências
    location_origem = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='previsoes_origem',
        null=True,
        blank=True,
        verbose_name='Location de Origem'
    )
    
    location_destino = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='previsoes_destino',
        null=True,
        blank=True,
        verbose_name='Location de Destino'
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    # Rastreamento de realização
    movimentacao_realizada = models.ForeignKey(
        MovimentacaoEstoque,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='previsao_origem',
        verbose_name='Movimentação Realizada',
        help_text='Movimentação que realizou esta previsão'
    )
    
    class Meta:
        verbose_name = 'Previsão de Movimentação'
        verbose_name_plural = 'Previsões de Movimentação'
        ordering = ['data_prevista']
        indexes = [
            models.Index(fields=['estoque', 'status']),
            models.Index(fields=['tipo', 'status']),
            models.Index(fields=['data_prevista', 'status']),
            models.Index(fields=['origem', 'status']),
        ]
    
    def __str__(self):
        return f"Previsão {self.get_tipo_display()} - {self.estoque.produto} ({self.quantidade}) - {self.data_prevista.strftime('%d/%m/%Y')}"
    
    def save(self, *args, **kwargs):
        """Override save para atualizar estoque.quantidade_prevista_*"""
        is_new = self.pk is None
        old_status = None
        
        if not is_new:
            try:
                old_instance = PrevisaoMovimentacao.objects.get(pk=self.pk)
                old_status = old_instance.status
            except PrevisaoMovimentacao.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
        
        # Atualizar quantidades previstas no estoque
        self._atualizar_quantidades_previstas(old_status)
    
    def _atualizar_quantidades_previstas(self, old_status=None):
        """
        Atualiza quantidade_prevista_entrada ou quantidade_prevista_saida no estoque
        """
        # Se status mudou de PENDENTE/CONFIRMADA para CANCELADA/REALIZADA, remover da previsão
        # Se status mudou para PENDENTE/CONFIRMADA, adicionar à previsão
        
        estoque = self.estoque
        
        # Calcular impacto baseado no status anterior e atual
        impacto_anterior = Decimal('0.000')
        if old_status in ['PENDENTE', 'CONFIRMADA']:
            if self.tipo == 'ENTRADA':
                impacto_anterior = -self.quantidade  # Remover da previsão anterior
            elif self.tipo == 'SAIDA':
                impacto_anterior = self.quantidade  # Remover da previsão anterior
        
        impacto_atual = Decimal('0.000')
        if self.status in ['PENDENTE', 'CONFIRMADA']:
            if self.tipo == 'ENTRADA':
                impacto_atual = self.quantidade  # Adicionar à previsão
            elif self.tipo == 'SAIDA':
                impacto_atual = -self.quantidade  # Adicionar à previsão
        
        impacto_total = impacto_anterior + impacto_atual
        
        # Atualizar estoque
        if self.tipo == 'ENTRADA':
            estoque.quantidade_prevista_entrada = max(
                Decimal('0.000'),
                estoque.quantidade_prevista_entrada + impacto_total
            )
        elif self.tipo == 'SAIDA':
            estoque.quantidade_prevista_saida = max(
                Decimal('0.000'),
                estoque.quantidade_prevista_saida + impacto_total
            )
        
        estoque.save()
    
    def confirmar(self):
        """
        Confirma uma previsão (muda status para CONFIRMADA)
        """
        if self.status != 'PENDENTE':
            raise ValueError(f"Previsão não está pendente. Status atual: {self.status}")
        
        self.status = 'CONFIRMADA'
        self.save()
        
        return self
    
    def realizar(self, movimentacao=None):
        """
        Marca previsão como realizada e cria/vincula movimentação
        """
        if self.status not in ['PENDENTE', 'CONFIRMADA']:
            raise ValueError(f"Previsão não pode ser realizada. Status atual: {self.status}")
        
        self.status = 'REALIZADA'
        if movimentacao:
            self.movimentacao_realizada = movimentacao
        self.save()
        
        return self
    
    def cancelar(self, motivo=None):
        """
        Cancela uma previsão
        """
        if self.status in ['CANCELADA', 'REALIZADA']:
            raise ValueError(f"Previsão não pode ser cancelada. Status atual: {self.status}")
        
        self.status = 'CANCELADA'
        if motivo:
            self.observacoes = f"{self.observacoes or ''}\nCancelado: {motivo}".strip()
        self.save()
        
        return self


class GrupoFilial(SiscrModelBase):
    """
    Grupo de Filiais (Location Groups)
    
    Permite agrupar múltiplas filiais para:
    - Estoque consolidado
    - Fulfillment cruzado (atender pedido de uma filial com estoque de outra)
    - Regras de alocação inteligente
    """
    REGRA_ALOCACAO_CHOICES = [
        ('PROXIMIDADE', 'Proximidade'),
        ('ESTOQUE_DISPONIVEL', 'Maior Estoque Disponível'),
        ('CUSTO_MENOR', 'Menor Custo'),
        ('ROTACAO', 'Maior Rotação'),
        ('MANUAL', 'Manual'),
    ]
    
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.CASCADE,
        related_name='grupos_filiais',
        verbose_name='Empresa'
    )
    
    nome = models.CharField(
        max_length=255,
        verbose_name='Nome do Grupo',
        help_text='Ex: Região Sul, Região Norte, Centro de Distribuição'
    )
    
    codigo = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código',
        help_text='Código único para identificar o grupo'
    )
    
    filiais = models.ManyToManyField(
        'tenants.Filial',
        related_name='grupos',
        verbose_name='Filiais',
        help_text='Filiais que pertencem a este grupo'
    )
    
    regra_alocacao = models.CharField(
        max_length=30,
        choices=REGRA_ALOCACAO_CHOICES,
        default='ESTOQUE_DISPONIVEL',
        verbose_name='Regra de Alocação',
        help_text='Regra usada para determinar melhor filial para atendimento'
    )
    
    permite_fulfillment_cruzado = models.BooleanField(
        default=True,
        verbose_name='Permite Fulfillment Cruzado',
        help_text='Se permite atender pedido de uma filial com estoque de outra'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='Ativo'
    )
    
    class Meta:
        verbose_name = 'Grupo de Filiais'
        verbose_name_plural = 'Grupos de Filiais'
        ordering = ['empresa', 'nome']
        indexes = [
            models.Index(fields=['empresa', 'is_active']),
            models.Index(fields=['codigo']),
        ]
    
    def __str__(self):
        return f"{self.nome} ({self.empresa.nome})"
    
    def get_estoque_consolidado(self, produto):
        """
        Retorna estoque consolidado do produto em todas as filiais do grupo
        
        Args:
            produto: Produto a consultar
            
        Returns:
            Dict com totais consolidados
        """
        from django.db.models import Sum
        
        # Buscar todas as locations das filiais do grupo
        locations = Location.objects.filter(
            empresa=self.empresa,
            filial__in=self.filiais.all(),
            is_active=True
        )
        
        # Buscar estoques
        estoques = Estoque.objects.filter(
            produto=produto,
            location__in=locations,
            empresa=self.empresa
        )
        
        # Consolidar
        consolidado = estoques.aggregate(
            total_atual=Sum('quantidade_atual'),
            total_reservada=Sum('quantidade_reservada'),
            total_disponivel=Sum('quantidade_disponivel'),
            total_prevista_entrada=Sum('quantidade_prevista_entrada'),
            total_prevista_saida=Sum('quantidade_prevista_saida'),
        )
        
        # Calcular valor total consolidado
        valor_total = sum(
            estoque.valor_total for estoque in estoques
        )
        
        return {
            'quantidade_atual': consolidado['total_atual'] or Decimal('0.000'),
            'quantidade_reservada': consolidado['total_reservada'] or Decimal('0.000'),
            'quantidade_disponivel': consolidado['total_disponivel'] or Decimal('0.000'),
            'quantidade_prevista_entrada': consolidado['total_prevista_entrada'] or Decimal('0.000'),
            'quantidade_prevista_saida': consolidado['total_prevista_saida'] or Decimal('0.000'),
            'valor_total': Decimal(str(valor_total)),
            'locations': locations.count(),
        }
    
    def determinar_melhor_filial(self, produto, quantidade, filial_origem=None):
        """
        Determina a melhor filial para atender um pedido baseado na regra de alocação
        
        Args:
            produto: Produto necessário
            quantidade: Quantidade necessária
            filial_origem: Filial de origem do pedido (opcional)
            
        Returns:
            Filial recomendada ou None se não houver estoque suficiente
        """
        if not self.permite_fulfillment_cruzado and filial_origem:
            # Se não permite fulfillment cruzado, retornar filial de origem
            if filial_origem in self.filiais.all():
                return filial_origem
            return None
        
        # Buscar locations das filiais do grupo
        locations = Location.objects.filter(
            empresa=self.empresa,
            filial__in=self.filiais.all(),
            is_active=True,
            permite_saida=True
        )
        
        # Buscar estoques disponíveis
        estoques = Estoque.objects.filter(
            produto=produto,
            location__in=locations,
            empresa=self.empresa
        ).select_related('location', 'location__filial')
        
        # Filtrar apenas estoques com quantidade suficiente
        estoques_suficientes = [
            e for e in estoques
            if e.quantidade_disponivel >= quantidade
        ]
        
        if not estoques_suficientes:
            return None
        
        # Aplicar regra de alocação
        if self.regra_alocacao == 'ESTOQUE_DISPONIVEL':
            # Filial com maior estoque disponível
            melhor_estoque = max(estoques_suficientes, key=lambda e: e.quantidade_disponivel)
            return melhor_estoque.location.filial
        
        elif self.regra_alocacao == 'CUSTO_MENOR':
            # Filial com menor custo médio
            melhor_estoque = min(estoques_suficientes, key=lambda e: e.valor_custo_medio)
            return melhor_estoque.location.filial
        
        elif self.regra_alocacao == 'PROXIMIDADE':
            # Se há filial de origem, priorizar ela
            if filial_origem and filial_origem in self.filiais.all():
                estoque_origem = next(
                    (e for e in estoques_suficientes if e.location.filial == filial_origem),
                    None
                )
                if estoque_origem:
                    return filial_origem
            
            # Caso contrário, retornar primeira disponível
            return estoques_suficientes[0].location.filial
        
        elif self.regra_alocacao == 'MANUAL':
            # Retornar primeira disponível (deve ser escolhida manualmente)
            return estoques_suficientes[0].location.filial
        
        else:
            # Default: maior estoque disponível
            melhor_estoque = max(estoques_suficientes, key=lambda e: e.quantidade_disponivel)
            return melhor_estoque.location.filial
