# cadastros/models.py
# Models movidos de core/models.py

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from core.base_models import SiscrModelBase

# Estados brasileiros (constante compartilhada)
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


class Pessoa(SiscrModelBase):
    # Tipos de Pessoa
    TIPO_CHOICES = [
        ('PF', 'Pessoa Física'),
        ('PJ', 'Pessoa Jurídica'),
    ]
    
    # Coluna de Controle
    codigo_cadastro = models.IntegerField(primary_key=True, verbose_name='Código Cadastro')
    
    # 1. Informações Básicas
    tipo = models.CharField(max_length=2, choices=TIPO_CHOICES, default='PF', verbose_name='Tipo de Pessoa')
    cpf_cnpj = models.CharField(max_length=18, unique=True, verbose_name='CPF/CNPJ')
    
    # Pessoa Física
    nome_completo = models.CharField(max_length=255, blank=True, null=True, verbose_name='Nome Completo')
    
    # Pessoa Jurídica
    razao_social = models.CharField(max_length=255, blank=True, null=True, verbose_name='Razão Social')
    nome_fantasia = models.CharField(max_length=255, blank=True, null=True, verbose_name='Nome Fantasia')
    
    # NOVO: Inscrição Estadual
    inscricao_estadual = models.CharField(max_length=20, blank=True, null=True, verbose_name='Inscrição Estadual')
    contribuinte = models.BooleanField(default=True, verbose_name='Contribuinte ICMS')

    # 2. Endereço
    logradouro = models.CharField(max_length=255, verbose_name='Logradouro')
    numero = models.CharField(max_length=10, verbose_name='Número')
    letra = models.CharField(max_length=2, blank=True, null=True, verbose_name='Letra')
    complemento = models.CharField(max_length=100, blank=True, null=True, verbose_name='Complemento')
    bairro = models.CharField(max_length=100, verbose_name='Bairro')
    cidade = models.CharField(max_length=100, verbose_name='Cidade')
    estado = models.CharField(max_length=2, choices=ESTADOS_CHOICES, default='SC')
    cep = models.CharField(max_length=9, default='99999-999')

    # 3. Contato
    nome_contato = models.CharField(max_length=100, blank=True, null=True, verbose_name='Nome do Contato')
    telefone_fixo = models.CharField(max_length=15, blank=True, null=True, verbose_name='Telefone Fixo')
    telefone_celular = models.CharField(max_length=15, blank=True, null=True, verbose_name='Celular')
    email = models.EmailField(max_length=255, blank=True, null=True, verbose_name='Email')
    cargo = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cargo')
    comissoes = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name='Comissão (%)')

    # 4. Observações
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    
    # 5. Vínculo com Empresa/Filial (para separação de dados)
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pessoas',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pessoas',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )

    class Meta:
        verbose_name = 'Pessoa'
        verbose_name_plural = 'Pessoas'
        indexes = [
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
        ]

    def __str__(self):
        return self.nome_completo or self.razao_social or f"Código {self.codigo_cadastro}"


class Servico(SiscrModelBase):
    # Campos Identificadores e Gerais
    codigo_servico = models.IntegerField(primary_key=True) 
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    
    # Seção: Valores e Contratos
    valor_base = models.DecimalField(max_digits=10, decimal_places=2, help_text="Valor base de venda do serviço.")
    tipo_contrato = models.CharField(max_length=50, choices=[('Mensal', 'Mensal'), ('Anual', 'Anual'), ('Projeto', 'Por Projeto'), ('Avulso', 'Avulso')], default='Avulso')
    prazo_execucao = models.IntegerField(blank=True, null=True, help_text="Prazo em dias úteis para execução, se aplicável.")
    valor_impostos_estimado = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="Estimativa de impostos incidentes.", default=0.00)
    
    # Seção: Tributação
    codigo_ncm = models.CharField(max_length=10, blank=True, null=True, help_text="Código NCM para classificação fiscal (se aplicável).")
    cfop = models.CharField(max_length=4, blank=True, null=True, help_text="CFOP - Código Fiscal de Operações e Prestações.")
    tributacao_pis = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Alíquota PIS (%)", default=0.00)
    tributacao_cofins = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Alíquota COFINS (%)", default=0.00)
    icms_tributado = models.BooleanField(default=False, help_text="O serviço incide ICMS?")
    
    # Vínculo com Empresa/Filial (para separação de dados)
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='servicos',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='servicos',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )

    class Meta:
        verbose_name = 'Serviço'
        verbose_name_plural = 'Serviços'
        indexes = [
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
        ]

    def __str__(self):
        return self.nome


class Produto(SiscrModelBase):
    # Campos Identificadores e Gerais
    codigo_produto = models.IntegerField(primary_key=True) 
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    
    # Seção: Valores e Logística
    valor_custo = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Custo de aquisição do produto.")
    valor_venda = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Preço de venda sugerido.")
    unidade_medida = models.CharField(max_length=10, choices=[('UN', 'Unidade'), ('KG', 'Kilograma'), ('LT', 'Litro'), ('M2', 'Metro Quadrado')], default='UN')
    peso_liquido = models.DecimalField(max_digits=10, decimal_places=3, blank=True, null=True, help_text="Peso líquido em Kg.")
    peso_bruto = models.DecimalField(max_digits=10, decimal_places=3, blank=True, null=True, help_text="Peso bruto em Kg (incluindo embalagem).")
    
    # Seção: Tributação Nacional
    codigo_ncm = models.CharField(max_length=10, help_text="Nomenclatura Comum do Mercosul.")
    cfop_interno = models.CharField(max_length=4, blank=True, null=True, help_text="CFOP para vendas internas.")
    origem_mercadoria = models.CharField(max_length=2, choices=[('0', 'Nacional'), ('1', 'Estrangeira - Importação Direta'), ('2', 'Estrangeira - Adquirida no Mercado Interno')], default='0', help_text="CST de Origem.")
    cst_icms = models.CharField(max_length=3, blank=True, null=True, help_text="CST/CSOSN do ICMS.")
    aliquota_icms = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Alíquota ICMS (%)")
    aliquota_ipi = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Alíquota IPI (%)")
    
    # Seção: Comércio Exterior (Importação/Exportação)
    codigo_di = models.CharField(max_length=20, blank=True, null=True, help_text="Número de Declaração de Importação (DI) mais recente.")
    incoterm = models.CharField(max_length=10, blank=True, null=True, help_text="Último Incoterm utilizado (e.g., FOB, CIF).")
    moeda_negociacao = models.CharField(max_length=3, choices=[('BRL', 'Real'), ('USD', 'Dólar Americano'), ('EUR', 'Euro')], default='BRL', help_text="Moeda de negociação padrão.")
    aliquota_ii = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Alíquota de Imposto de Importação (II) (%)")
    
    # Vínculo com Empresa/Filial (para separação de dados)
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='produtos',
        verbose_name='Empresa',
        help_text='Deixe em branco para dados compartilhados entre todas as empresas'
    )
    
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='produtos',
        verbose_name='Filial',
        help_text='Deixe em branco para dados compartilhados entre todas as filiais'
    )

    class Meta:
        verbose_name = 'Produto'
        verbose_name_plural = 'Produtos'
        indexes = [
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
        ]

    def __str__(self):
        return f"{self.codigo_produto} - {self.nome}"


# ============================================================================
# MODELOS DE FINANCEIRO
# ============================================================================

class ContaReceber(SiscrModelBase):
    """Modelo para Contas a Receber"""
    
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
        Pessoa,
        on_delete=models.PROTECT,
        related_name='contas_receber',
        verbose_name='Cliente',
        limit_choices_to={'tipo': 'PJ'}  # Apenas clientes (PJ)
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
        verbose_name = 'Conta a Receber'
        verbose_name_plural = 'Contas a Receber'
        ordering = ['-data_vencimento', '-codigo_conta']
        indexes = [
            models.Index(fields=['cliente', 'status']),
            models.Index(fields=['data_vencimento', 'status']),
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
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
    """Modelo para Contas a Pagar"""
    
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
        Pessoa,
        on_delete=models.PROTECT,
        related_name='contas_pagar',
        verbose_name='Fornecedor',
        limit_choices_to={'tipo': 'PJ'}  # Apenas fornecedores (PJ)
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
        verbose_name = 'Conta a Pagar'
        verbose_name_plural = 'Contas a Pagar'
        ordering = ['-data_vencimento', '-codigo_conta']
        indexes = [
            models.Index(fields=['fornecedor', 'status']),
            models.Index(fields=['data_vencimento', 'status']),
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['empresa']),
            models.Index(fields=['filial']),
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
