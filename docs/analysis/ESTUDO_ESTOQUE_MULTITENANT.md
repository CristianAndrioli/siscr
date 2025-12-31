# 📦 Estudo: Lógicas de Estoque para Sistema Multi-Tenant Multi-Empresa Multi-Filial

## 📋 Contexto do Projeto

### Arquitetura Atual
- **Multi-tenant**: Schema isolation (django-tenants) - cada tenant tem seu próprio schema PostgreSQL
- **Hierarquia**: `Tenant → Empresa → Filial`
- **Isolamento**: Dados isolados por tenant (schema), com separação opcional por empresa/filial
- **Modelos existentes**: `Produto` já existe com campos `empresa` e `filial` (opcionais)
- **Status**: Não há módulo de estoque implementado ainda

### Requisitos Identificados
- ✅ Sistema multi-tenant (isolamento por schema)
- ✅ Multi-empresa (múltiplas empresas por tenant)
- ✅ Multi-filial (múltiplas filiais por empresa)
- ✅ Possível necessidade de estoque omnichannel
- ✅ Consideração de projeto separado vs integrado

---

## 🎯 Cenários de Uso de Estoque

### 1. **Estoque por Filial (Independente)**
Cada filial gerencia seu próprio estoque de forma independente.

**Exemplo:**
```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   ├── Filial: "Matriz - Centro"
│   │   └── Estoque: Notebook Dell (10 unidades)
│   ├── Filial: "Loja Norte"
│   │   └── Estoque: Notebook Dell (5 unidades)
│   └── Filial: "Loja Sul"
│       └── Estoque: Notebook Dell (8 unidades)
```

**Características:**
- Cada filial tem seu próprio estoque físico
- Transferências entre filiais são movimentações explícitas
- Relatórios consolidados somam estoques de todas as filiais

### 2. **Estoque Compartilhado (Centralizado)**
Estoque gerenciado no nível de empresa, compartilhado entre filiais.

**Exemplo:**
```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   └── Estoque Centralizado: Notebook Dell (23 unidades)
│       ├── Disponível para: Matriz, Loja Norte, Loja Sul
│       └── Reservas por filial são apenas lógicas
```

**Características:**
- Estoque físico único, mas pode ser reservado por filial
- Vendas de qualquer filial consomem do mesmo estoque
- Mais simples de gerenciar, mas menos controle granular

### 3. **Estoque Híbrido (Recomendado)**
Combinação: estoque físico por filial + estoque virtual compartilhado.

**Exemplo:**
```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   ├── Estoque Físico:
│   │   ├── Matriz: 10 unidades
│   │   ├── Loja Norte: 5 unidades
│   │   └── Loja Sul: 8 unidades
│   └── Estoque Virtual Compartilhado: 23 unidades
│       └── Permite venda de qualquer filial com transferência automática
```

**Características:**
- Flexibilidade máxima
- Suporta vendas omnichannel (vender de qualquer filial)
- Transferências automáticas quando necessário

### 4. **Estoque Omnichannel**
Estoque unificado que permite venda de qualquer canal (loja física, e-commerce, marketplace).

**Exemplo:**
```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   └── Estoque Omnichannel:
│       ├── Físico: Matriz (10), Loja Norte (5), Loja Sul (8)
│       ├── E-commerce: Reserva 3 unidades
│       ├── Marketplace: Reserva 2 unidades
│       └── Disponível Real: 18 unidades (23 - 5 reservadas)
```

**Características:**
- Visão unificada de estoque
- Reservas por canal
- Atualização em tempo real
- Complexidade maior

---

## 🏗️ Arquiteturas de Estoque

### **Opção 1: Estoque Integrado no Projeto Principal**

#### Estrutura de Modelos

```python
# estoque/models.py

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
    estado = models.CharField(max_length=2, verbose_name='Estado')
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
        ]
    
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
    produto = models.ForeignKey('cadastros.Produto', on_delete=models.PROTECT, related_name='estoques')
    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='estoques',
        verbose_name='Location'
    )
    empresa = models.ForeignKey('tenants.Empresa', on_delete=models.PROTECT, related_name='estoques')
    
    # Quantidades
    quantidade_atual = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    quantidade_reservada = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    quantidade_disponivel = models.DecimalField(max_digits=10, decimal_places=3, default=0, editable=False)
    
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
    valor_custo_medio = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2, default=0, editable=False)
    
    # Controle
    estoque_minimo = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    estoque_maximo = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    
    class Meta:
        unique_together = ['produto', 'location']
        verbose_name = 'Estoque'
        verbose_name_plural = 'Estoques'
        indexes = [
            models.Index(fields=['empresa', 'location']),
            models.Index(fields=['produto', 'location']),
            models.Index(fields=['location', 'is_deleted']),
        ]
    
    def save(self, *args, **kwargs):
        self.quantidade_disponivel = self.quantidade_atual - self.quantidade_reservada
        self.valor_total = self.quantidade_atual * self.valor_custo_medio
        super().save(*args, **kwargs)
    
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


class MovimentacaoEstoque(SiscrModelBase):
    """
    Histórico de movimentações de estoque
    Suporta entradas, saídas e transferências dentro do mesmo tenant
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
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    origem = models.CharField(max_length=20, choices=ORIGEM_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='CONFIRMADA')
    
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    quantidade_anterior = models.DecimalField(max_digits=10, decimal_places=3)
    quantidade_posterior = models.DecimalField(max_digits=10, decimal_places=3)
    
    valor_unitario = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
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
    
    observacoes = models.TextField(blank=True, null=True)
    data_movimentacao = models.DateTimeField(auto_now_add=True)
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
    
    def __str__(self):
        return f"{self.tipo} - {self.estoque.produto} ({self.quantidade})"
    
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
    Reservas de estoque (para vendas pendentes, e-commerce, etc.)
    """
    STATUS_CHOICES = [
        ('ATIVA', 'Ativa'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('EXPIRADA', 'Expirada'),
    ]
    
    estoque = models.ForeignKey(Estoque, on_delete=models.PROTECT, related_name='reservas')
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    
    # Origem da reserva
    origem_tipo = models.CharField(max_length=20, choices=[
        ('VENDA', 'Venda'),
        ('ECOMMERCE', 'E-commerce'),
        ('MARKETPLACE', 'Marketplace'),
        ('ORCAMENTO', 'Orçamento'),
    ])
    origem_id = models.IntegerField()  # ID do pedido/orçamento
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ATIVA')
    data_expiracao = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['estoque', 'status']),
            models.Index(fields=['origem_tipo', 'origem_id']),
        ]
```

#### Vantagens
- ✅ Integração nativa com produtos, empresas e filiais
- ✅ Compartilha autenticação e permissões
- ✅ Transações ACID garantidas
- ✅ Mais simples de desenvolver e manter
- ✅ Performance melhor (sem chamadas de rede)
- ✅ Custo menor (sem infraestrutura adicional)

#### Desvantagens
- ⚠️ Acopla estoque ao sistema principal
- ⚠️ Escalabilidade limitada ao banco do tenant
- ⚠️ Mais difícil de evoluir independentemente
- ⚠️ Se o sistema principal cair, estoque cai junto

---

### **Opção 2: Estoque em Projeto Separado (Microserviço)**

#### Arquitetura

```
┌─────────────────────────────────┐
│   SISCR Principal (Django)      │
│   - Cadastros                    │
│   - Financeiro                   │
│   - Vendas                       │
└──────────────┬──────────────────┘
               │ API REST
               │ (HTTPS)
               ▼
┌─────────────────────────────────┐
│   SISCR Estoque (Django/FastAPI)│
│   - Estoque                     │
│   - Movimentações               │
│   - Reservas                    │
│   - Transferências              │
└─────────────────────────────────┘
```

#### Estrutura de API

```python
# API Endpoints do Serviço de Estoque

GET    /api/estoque/produto/{produto_id}/filial/{filial_id}/
POST   /api/estoque/movimentacao/
GET    /api/estoque/filial/{filial_id}/produtos/
POST   /api/estoque/reserva/
DELETE /api/estoque/reserva/{reserva_id}/
POST   /api/estoque/transferencia/
GET    /api/estoque/empresa/{empresa_id}/consolidado/
```

#### Autenticação

```python
# Autenticação via JWT compartilhado ou API Key por tenant

# Opção A: JWT compartilhado
Authorization: Bearer <jwt_token_from_main_system>

# Opção B: API Key por tenant
X-Tenant-Id: <tenant_id>
X-API-Key: <tenant_api_key>
```

#### Vantagens
- ✅ Desacoplamento completo
- ✅ Escalabilidade independente
- ✅ Pode usar tecnologia diferente (FastAPI, Go, etc.)
- ✅ Pode ser usado por outros sistemas
- ✅ Evolução independente
- ✅ Isolamento de falhas (se estoque cair, sistema principal continua)

#### Desvantagens
- ❌ Complexidade maior (2 sistemas para manter)
- ❌ Latência de rede (chamadas HTTP)
- ❌ Transações distribuídas complexas
- ❌ Sincronização de dados (produtos, filiais)
- ❌ Custo maior (2 aplicações, 2 bancos)
- ❌ Debugging mais difícil
- ❌ Possível inconsistência de dados

---

## 🔄 Lógicas de Estoque por Cenário

### **Lógica 1: Estoque Físico por Filial (Simples)**

#### Regras
1. Cada filial tem estoque físico independente
2. Vendas consomem estoque da filial onde ocorreu a venda
3. Transferências entre filiais são movimentações explícitas
4. Relatórios consolidados somam estoques

#### Fluxo de Venda
```
1. Cliente compra na Filial A
2. Sistema verifica estoque na Filial A
3. Se disponível: reserva → confirma venda → baixa estoque
4. Se não disponível: sugere transferência ou outra filial
```

#### Modelo de Dados
```python
# Estoque sempre vinculado a uma filial específica
estoque = Estoque.objects.get(produto=produto, filial=filial_venda)
if estoque.quantidade_disponivel >= quantidade_venda:
    # Processa venda
    estoque.quantidade_atual -= quantidade_venda
    estoque.save()
```

---

### **Lógica 2: Estoque Compartilhado com Reservas**

#### Regras
1. Estoque físico pode estar em qualquer filial
2. Estoque virtual é compartilhado entre filiais
3. Vendas de qualquer filial podem consumir estoque de outra
4. Sistema gerencia transferências automaticamente

#### Fluxo de Venda Omnichannel
```
1. Cliente compra online (sem filial específica)
2. Sistema verifica estoque consolidado da empresa
3. Se disponível: reserva → aloca para filial mais próxima → confirma
4. Sistema agenda transferência se necessário
```

#### Modelo de Dados
```python
# Estoque consolidado por empresa
def get_estoque_consolidado(produto, empresa):
    estoques = Estoque.objects.filter(
        produto=produto,
        empresa=empresa
    )
    total = sum(e.quantidade_disponivel for e in estoques)
    return total

# Venda pode consumir de qualquer filial
def vender_produto(produto, empresa, quantidade):
    estoques = Estoque.objects.filter(
        produto=produto,
        empresa=empresa
    ).order_by('quantidade_disponivel')
    
    quantidade_restante = quantidade
    for estoque in estoques:
        if quantidade_restante <= 0:
            break
        if estoque.quantidade_disponivel > 0:
            consumir = min(quantidade_restante, estoque.quantidade_disponivel)
            estoque.quantidade_atual -= consumir
            estoque.save()
            quantidade_restante -= consumir
```

---

### **Lógica 3: Estoque Híbrido (Recomendado)**

#### Regras
1. Estoque físico por filial (controle granular)
2. Estoque virtual compartilhado (visão consolidada)
3. Vendas podem consumir de qualquer filial
4. Transferências automáticas quando necessário
5. Reservas por canal (físico, e-commerce, marketplace)

#### Fluxo Completo
```
1. Cliente compra online
2. Sistema verifica estoque consolidado
3. Se disponível:
   a. Cria reserva
   b. Aloca estoque da filial mais próxima
   c. Se filial diferente da entrega: agenda transferência
   d. Confirma venda
4. Sistema atualiza estoques em tempo real
```

#### Modelo de Dados Avançado
```python
class EstoqueVirtual(SiscrModelBase):
    """
    Visão consolidada de estoque por empresa
    """
    produto = models.ForeignKey('cadastros.Produto', on_delete=models.PROTECT)
    empresa = models.ForeignKey('tenants.Empresa', on_delete=models.PROTECT)
    
    quantidade_total = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    quantidade_reservada = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    quantidade_disponivel = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    
    # Atualizado via signals ou tarefas assíncronas
    ultima_atualizacao = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['produto', 'empresa']
    
    @classmethod
    def atualizar_consolidado(cls, produto, empresa):
        """Atualiza estoque virtual baseado nos estoques físicos"""
        estoques_fisicos = Estoque.objects.filter(
            produto=produto,
            empresa=empresa
        )
        
        total = sum(e.quantidade_atual for e in estoques_fisicos)
        reservado = sum(e.quantidade_reservada for e in estoques_fisicos)
        
        virtual, _ = cls.objects.get_or_create(
            produto=produto,
            empresa=empresa
        )
        virtual.quantidade_total = total
        virtual.quantidade_reservada = reservado
        virtual.quantidade_disponivel = total - reservado
        virtual.save()
```

---

## 📊 Comparação de Abordagens

| Critério | Integrado | Separado (API) |
|----------|-----------|----------------|
| **Complexidade** | ⭐⭐ Baixa | ⭐⭐⭐⭐ Alta |
| **Performance** | ⭐⭐⭐⭐⭐ Excelente | ⭐⭐⭐ Boa (latência de rede) |
| **Escalabilidade** | ⭐⭐⭐ Boa | ⭐⭐⭐⭐⭐ Excelente |
| **Manutenção** | ⭐⭐⭐⭐ Fácil | ⭐⭐ Difícil |
| **Custo** | ⭐⭐⭐⭐⭐ Baixo | ⭐⭐⭐ Médio |
| **Desacoplamento** | ⭐⭐ Baixo | ⭐⭐⭐⭐⭐ Total |
| **Transações ACID** | ⭐⭐⭐⭐⭐ Garantidas | ⭐⭐ Complexas |
| **Debugging** | ⭐⭐⭐⭐ Fácil | ⭐⭐ Difícil |
| **Evolução Independente** | ⭐⭐ Limitada | ⭐⭐⭐⭐⭐ Total |

---

## 🎯 Recomendações por Cenário

### **Cenário 1: Estoque Simples (Por Filial)**
**Recomendação: INTEGRADO**

- ✅ Lógica simples
- ✅ Não precisa de alta escalabilidade
- ✅ Performance local é suficiente
- ✅ Custo-benefício melhor

### **Cenário 2: Estoque Omnichannel Complexo**
**Recomendação: HÍBRIDO (começar integrado, evoluir se necessário)**

- ✅ Começar integrado para validar necessidade
- ✅ Se crescer muito, pode extrair para microserviço depois
- ✅ Evita over-engineering inicial

### **Cenário 3: Múltiplos Sistemas Consumindo Estoque**
**Recomendação: SEPARADO**

- ✅ Se outros sistemas (e-commerce, marketplace) precisam acessar
- ✅ Se precisa de alta disponibilidade independente
- ✅ Se equipe grande para manter separado

---

## 🏗️ Arquitetura Recomendada: Integrada com Possibilidade de Evolução

### **Fase 1: Integrado (Recomendado para Começar)**

```
┌─────────────────────────────────────────┐
│   SISCR (Django)                        │
│   ├── cadastros/                        │
│   │   └── Produto                       │
│   ├── estoque/                          │
│   │   ├── Estoque (por filial)          │
│   │   ├── MovimentacaoEstoque           │
│   │   └── ReservaEstoque               │
│   └── vendas/                           │
│       └── Pedido (consome estoque)      │
└─────────────────────────────────────────┘
```

**Vantagens:**
- Desenvolvimento rápido
- Transações ACID garantidas
- Performance excelente
- Custo baixo

### **Fase 2: Se Necessário, Extrair para API (Evolução Futura)**

```
┌─────────────────────────────────────────┐
│   SISCR Principal                      │
│   └── API Client para Estoque          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   SISCR Estoque (API)                  │
│   └── Mesmos modelos, mas isolados     │
└─────────────────────────────────────────┘
```

**Quando considerar:**
- Volume muito alto de transações
- Necessidade de alta disponibilidade independente
- Múltiplos sistemas consumindo
- Equipe grande para manter

---

## 📐 Modelo de Dados Recomendado (Integrado)

### **Estrutura Completa**

```python
# estoque/models.py

from django.db import models
from core.base_models import SiscrModelBase

class Estoque(SiscrModelBase):
    """
    Estoque físico por filial
    """
    produto = models.ForeignKey(
        'cadastros.Produto',
        on_delete=models.PROTECT,
        related_name='estoques'
    )
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        related_name='estoques'
    )
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.PROTECT,
        related_name='estoques'
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
    
    # Localização física
    localizacao = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Localização',
        help_text='Ex: Prateleira A-3, Setor B'
    )
    
    # Valores (custo médio ponderado)
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
        unique_together = ['produto', 'filial']
        indexes = [
            models.Index(fields=['empresa', 'filial']),
            models.Index(fields=['produto', 'filial']),
            models.Index(fields=['empresa', 'produto']),
        ]
    
    def save(self, *args, **kwargs):
        # Calcular quantidade disponível
        self.quantidade_disponivel = self.quantidade_atual - self.quantidade_reservada
        
        # Calcular valor total
        self.valor_total = self.quantidade_atual * self.valor_custo_medio
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.produto} - {self.filial} ({self.quantidade_atual})"
    
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
    Histórico completo de movimentações de estoque
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
        ('TRANSFERENCIA', 'Transferência entre Filiais'),
        ('AJUSTE_MANUAL', 'Ajuste Manual'),
        ('PERDA', 'Perda/Danificação'),
        ('RESERVA', 'Reserva de Venda'),
        ('CANCELAMENTO', 'Cancelamento'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.PROTECT,
        related_name='movimentacoes'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    origem = models.CharField(max_length=20, choices=ORIGEM_CHOICES)
    
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    quantidade_anterior = models.DecimalField(max_digits=10, decimal_places=3)
    quantidade_posterior = models.DecimalField(max_digits=10, decimal_places=3)
    
    valor_unitario = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Para transferências
    filial_origem = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        related_name='transferencias_origem',
        null=True,
        blank=True
    )
    filial_destino = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        related_name='transferencias_destino',
        null=True,
        blank=True
    )
    
    # Referências
    documento_referencia = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Documento de Referência',
        help_text='Ex: NF-001234, Pedido-567'
    )
    observacoes = models.TextField(blank=True, null=True)
    
    data_movimentacao = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Movimentação de Estoque'
        verbose_name_plural = 'Movimentações de Estoque'
        ordering = ['-data_movimentacao']
        indexes = [
            models.Index(fields=['estoque', 'data_movimentacao']),
            models.Index(fields=['tipo', 'data_movimentacao']),
            models.Index(fields=['origem', 'data_movimentacao']),
        ]
    
    def __str__(self):
        return f"{self.tipo} - {self.estoque.produto} ({self.quantidade})"


class ReservaEstoque(SiscrModelBase):
    """
    Reservas de estoque para vendas pendentes, e-commerce, etc.
    """
    STATUS_CHOICES = [
        ('ATIVA', 'Ativa'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('EXPIRADA', 'Expirada'),
    ]
    
    ORIGEM_CHOICES = [
        ('VENDA', 'Venda'),
        ('ECOMMERCE', 'E-commerce'),
        ('MARKETPLACE', 'Marketplace'),
        ('ORCAMENTO', 'Orçamento'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.PROTECT,
        related_name='reservas'
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    
    origem_tipo = models.CharField(max_length=20, choices=ORIGEM_CHOICES)
    origem_id = models.IntegerField(
        help_text='ID do pedido, orçamento, etc.'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ATIVA'
    )
    data_expiracao = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Data de expiração da reserva (para e-commerce)'
    )
    
    class Meta:
        verbose_name = 'Reserva de Estoque'
        verbose_name_plural = 'Reservas de Estoque'
        indexes = [
            models.Index(fields=['estoque', 'status']),
            models.Index(fields=['origem_tipo', 'origem_id']),
            models.Index(fields=['status', 'data_expiracao']),
        ]
    
    def __str__(self):
        return f"Reserva {self.origem_tipo} - {self.estoque.produto} ({self.quantidade})"
    
    def confirmar(self):
        """Confirma a reserva e baixa o estoque"""
        if self.status != 'ATIVA':
            raise ValueError("Apenas reservas ativas podem ser confirmadas")
        
        self.estoque.quantidade_atual -= self.quantidade
        self.estoque.quantidade_reservada -= self.quantidade
        self.estoque.save()
        
        self.status = 'CONFIRMADA'
        self.save()
    
    def cancelar(self):
        """Cancela a reserva e libera o estoque"""
        if self.status != 'ATIVA':
            raise ValueError("Apenas reservas ativas podem ser canceladas")
        
        self.estoque.quantidade_reservada -= self.quantidade
        self.estoque.save()
        
        self.status = 'CANCELADA'
        self.save()
```

---

## 💾 Abordagem para Representar Saídas de Estoque

### **Questão: Número Negativo vs Número Positivo com Tipo**

Ao registrar movimentações de estoque, há duas abordagens principais:

### **Abordagem 1: Número Negativo para Saídas**

```python
# Movimentação de entrada
quantidade = 10  # Positivo

# Movimentação de saída
quantidade = -10  # Negativo
```

**Vantagens:**
- ✅ Cálculo simples: `saldo = sum(quantidades)` funciona diretamente
- ✅ Menos campos: não precisa de campo `tipo` separado
- ✅ Matemática intuitiva: entrada (+) e saída (-)

**Desvantagens:**
- ❌ Pode causar confusão: números negativos podem ser interpretados como erro
- ❌ Validações mais complexas: precisa verificar se negativo é válido
- ❌ Queries mais complexas: `WHERE quantidade < 0` ao invés de `WHERE tipo = 'SAIDA'`
- ❌ Relatórios menos claros: precisa usar `ABS()` para mostrar valores
- ❌ Risco de erros: fácil esquecer o sinal negativo
- ❌ Agregações confusas: `SUM(quantidade)` pode dar zero se entradas = saídas

### **Abordagem 2: Número Positivo com Campo Tipo (RECOMENDADA)**

```python
# Movimentação de entrada
tipo = 'ENTRADA'
quantidade = 10  # Sempre positivo

# Movimentação de saída
tipo = 'SAIDA'
quantidade = 10  # Sempre positivo
```

**Vantagens:**
- ✅ **Clareza**: Sempre fica claro o que a quantidade representa
- ✅ **Validações simples**: `quantidade >= 0` sempre
- ✅ **Queries mais legíveis**: `WHERE tipo = 'SAIDA'` é mais claro que `WHERE quantidade < 0`
- ✅ **Relatórios mais fáceis**: Não precisa usar `ABS()` ou verificar sinal
- ✅ **Menos erros**: Impossível esquecer sinal negativo
- ✅ **Agregações claras**: Fácil separar entradas e saídas
- ✅ **Auditoria melhor**: Tipo explícito facilita rastreamento
- ✅ **Flexibilidade**: Permite adicionar novos tipos facilmente

**Desvantagens:**
- ⚠️ Cálculo de saldo requer lógica: `entradas - saídas`
- ⚠️ Um campo a mais no modelo

### **Recomendação: Abordagem 2 (Número Positivo com Tipo)**

**Por quê?**

1. **Clareza e Manutenibilidade**
   - Código mais legível e fácil de entender
   - Menos propenso a erros
   - Facilita onboarding de novos desenvolvedores

2. **Queries e Relatórios**
   ```python
   # Mais claro
   entradas = MovimentacaoEstoque.objects.filter(tipo='ENTRADA')
   saidas = MovimentacaoEstoque.objects.filter(tipo='SAIDA')
   
   # vs menos claro
   entradas = MovimentacaoEstoque.objects.filter(quantidade__gt=0)
   saidas = MovimentacaoEstoque.objects.filter(quantidade__lt=0)
   ```

3. **Validações**
   ```python
   # Sempre válido
   if quantidade < 0:
       raise ValueError("Quantidade deve ser positiva")
   
   # vs precisa verificar contexto
   if tipo == 'SAIDA' and quantidade > 0:
       quantidade = -quantidade  # Confuso!
   ```

4. **Agregações**
   ```python
   # Claro e explícito
   total_entradas = movimentacoes.filter(tipo='ENTRADA').aggregate(
       total=Sum('quantidade')
   )['total'] or 0
   
   total_saidas = movimentacoes.filter(tipo='SAIDA').aggregate(
       total=Sum('quantidade')
   )['total'] or 0
   
   saldo = total_entradas - total_saidas
   ```

5. **Padrão da Indústria**
   - Sistemas ERP/WMS profissionais usam esta abordagem
   - Salesforce, SAP, Oracle usam tipo + quantidade positiva
   - Facilita integração com outros sistemas

### **Implementação Recomendada**

```python
class MovimentacaoEstoque(SiscrModelBase):
    """
    Movimentação de estoque usando abordagem: quantidade sempre positiva + tipo
    """
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SAIDA', 'Saída'),
        ('TRANSFERENCIA', 'Transferência'),
        ('AJUSTE', 'Ajuste'),
    ]
    
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],  # Sempre positivo
        verbose_name='Quantidade',
        help_text='Quantidade sempre positiva. Use o campo tipo para indicar entrada/saída.'
    )
    
    def clean(self):
        """Validação: quantidade sempre positiva"""
        if self.quantidade <= 0:
            raise ValidationError({
                'quantidade': 'Quantidade deve ser sempre positiva. Use o campo tipo para indicar entrada/saída.'
            })
    
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
    
    @classmethod
    def calcular_saldo(cls, estoque, data_inicio=None, data_fim=None):
        """
        Calcula saldo de estoque baseado em movimentações
        """
        movimentacoes = cls.objects.filter(estoque=estoque, status='CONFIRMADA')
        
        if data_inicio:
            movimentacoes = movimentacoes.filter(data_movimentacao__gte=data_inicio)
        if data_fim:
            movimentacoes = movimentacoes.filter(data_movimentacao__lte=data_fim)
        
        total_entradas = movimentacoes.filter(tipo='ENTRADA').aggregate(
            total=Sum('quantidade')
        )['total'] or 0
        
        total_saidas = movimentacoes.filter(tipo='SAIDA').aggregate(
            total=Sum('quantidade')
        )['total'] or 0
        
        return total_entradas - total_saidas
```

### **Exceção: Transferências**

Para transferências, pode haver confusão. Recomendação:

**Opção A: Duas Movimentações (Recomendada)**
```python
# Transferência de Location A para Location B
# Cria 2 movimentações:

# 1. Saída na Location A
MovimentacaoEstoque.objects.create(
    estoque=estoque_a,
    tipo='SAIDA',
    origem='TRANSFERENCIA',
    quantidade=10,  # Positivo
    location_origem=location_a,
    location_destino=location_b
)

# 2. Entrada na Location B
MovimentacaoEstoque.objects.create(
    estoque=estoque_b,
    tipo='ENTRADA',
    origem='TRANSFERENCIA',
    quantidade=10,  # Positivo
    location_origem=location_a,
    location_destino=location_b
)
```

**Opção B: Uma Movimentação com Tipo Transferência**
```python
# Uma única movimentação que representa a transferência
MovimentacaoEstoque.objects.create(
    estoque_origem=estoque_a,
    estoque_destino=estoque_b,
    tipo='TRANSFERENCIA',
    quantidade=10,  # Positivo
    # Impacto: -10 em A, +10 em B
)
```

**Recomendação**: Opção A (duas movimentações) é mais clara e facilita auditoria.

### **Resumo**

| Aspecto | Negativo | Positivo + Tipo |
|---------|----------|-----------------|
| **Clareza** | ⚠️ Menos clara | ✅ Muito clara |
| **Validação** | ⚠️ Complexa | ✅ Simples |
| **Queries** | ⚠️ Menos legível | ✅ Mais legível |
| **Relatórios** | ⚠️ Precisa ABS() | ✅ Direto |
| **Erros** | ❌ Fácil esquecer sinal | ✅ Impossível |
| **Padrão Indústria** | ⚠️ Pouco usado | ✅ Padrão |
| **Manutenção** | ⚠️ Mais difícil | ✅ Mais fácil |

**Conclusão**: Use **quantidade sempre positiva** com campo `tipo` para indicar entrada/saída. É mais clara, menos propensa a erros e segue padrões da indústria.

---

## 📍 Locations (Localizações Físicas)

### **Conceito**

Locations representam locais físicos onde o estoque é armazenado. Diferente de Filiais (que são unidades de negócio), Locations são pontos físicos de armazenamento.

### **Tipos de Locations**

1. **Loja**: Ponto de venda físico
2. **Almoxarifado**: Depósito interno para materiais
3. **Armazém**: Depósito maior para estoque
4. **Centro de Distribuição**: CD para distribuição regional
5. **Estoque em Terceiros**: Estoque armazenado por terceiros
6. **Outro**: Outros tipos de localização

### **Características**

- ✅ **Endereço Completo**: Logradouro, número, complemento, bairro, cidade, estado, CEP
- ✅ **Coordenadas**: Latitude/longitude para cálculo de distância
- ✅ **Controle de Operações**: Permite entrada, saída, transferência
- ✅ **Vinculado a Empresa**: Cada location pertence a uma empresa
- ✅ **Múltiplas Locations por Empresa**: Uma empresa pode ter várias locations

### **Relação com Filiais**

**Opção 1: Location = Filial (Simples)**
- Cada filial tem uma location correspondente
- Mais simples, mas menos flexível

**Opção 2: Location Independente (Recomendado)**
- Locations são independentes de filiais
- Uma filial pode ter múltiplas locations
- Uma location pode servir múltiplas filiais
- Mais flexível para casos complexos

**Recomendação**: Começar com Location independente, permitindo maior flexibilidade.

---

## 📊 Previsão de Movimentações

### **Conceito**

O sistema precisa prever entradas, saídas e transferências futuras para:
- Planejamento de estoque
- Alertas de estoque mínimo considerando previsões
- Otimização de compras
- Gestão de transferências

### **Campos de Previsão no Estoque**

```python
# No modelo Estoque
quantidade_prevista_entrada = DecimalField(...)  # Entradas futuras
quantidade_prevista_saida = DecimalField(...)    # Saídas futuras
```

### **Fontes de Previsão**

#### **1. Previsão de Entradas**

**Origens:**
- **Compras Confirmadas**: Pedidos de compra confirmados, mas ainda não recebidos
- **Transferências Pendentes**: Transferências aprovadas, mas ainda não recebidas
- **Devoluções Pendentes**: Devoluções aprovadas, mas ainda não processadas
- **Produção**: Itens em produção (se aplicável)

**Exemplo:**
```
Estoque Atual: 10 unidades
Compra Confirmada (não recebida): 20 unidades
Transferência Pendente: 5 unidades
Previsão Entrada Total: 25 unidades
Estoque Previsto: 35 unidades
```

#### **2. Previsão de Saídas**

**Origens:**
- **Vendas Confirmadas**: Pedidos de venda confirmados, mas ainda não faturados
- **Transferências Pendentes**: Transferências aprovadas, mas ainda não enviadas
- **Reservas Ativas**: Soft e hard reservations
- **Orçamentos com Alta Probabilidade**: Orçamentos com alta chance de conversão

**Exemplo:**
```
Estoque Atual: 10 unidades
Vendas Confirmadas (não faturadas): 3 unidades
Reservas Ativas: 2 unidades
Previsão Saída Total: 5 unidades
Estoque Previsto Disponível: 5 unidades
```

#### **3. Previsão de Transferências**

**Transferências dentro do mesmo tenant:**
- Location A → Location B (dentro da mesma empresa)
- Location A → Location B (entre empresas do mesmo tenant)

**Fluxo:**
```
1. Solicitação de transferência
2. Aprovação
3. Criação de previsão:
   - Location Origem: quantidade_prevista_saida += quantidade
   - Location Destino: quantidade_prevista_entrada += quantidade
4. Quando transferência é confirmada:
   - Remove previsão
   - Atualiza estoque real
```

### **Modelo de Previsão**

```python
# estoque/models.py

class PrevisaoMovimentacao(SiscrModelBase):
    """
    Previsão de movimentação futura de estoque
    """
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada Prevista'),
        ('SAIDA', 'Saída Prevista'),
        ('TRANSFERENCIA', 'Transferência Prevista'),
    ]
    
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('REALIZADA', 'Realizada'),
    ]
    
    estoque = models.ForeignKey(
        Estoque,
        on_delete=models.CASCADE,
        related_name='previsoes'
    )
    
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE')
    
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    data_prevista = models.DateTimeField(verbose_name='Data Prevista')
    
    # Origem da previsão
    origem_tipo = models.CharField(
        max_length=30,
        choices=[
            ('COMPRA', 'Compra'),
            ('VENDA', 'Venda'),
            ('TRANSFERENCIA', 'Transferência'),
            ('DEVOLUCAO', 'Devolução'),
            ('ORCAMENTO', 'Orçamento'),
        ]
    )
    origem_id = models.IntegerField(help_text='ID do pedido, orçamento, etc.')
    
    # Para transferências
    location_origem = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='previsoes_origem',
        null=True,
        blank=True
    )
    location_destino = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='previsoes_destino',
        null=True,
        blank=True
    )
    
    observacoes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Previsão de Movimentação'
        verbose_name_plural = 'Previsões de Movimentação'
        ordering = ['data_prevista']
        indexes = [
            models.Index(fields=['estoque', 'data_prevista']),
            models.Index(fields=['tipo', 'status']),
            models.Index(fields=['origem_tipo', 'origem_id']),
        ]
    
    def confirmar(self):
        """Confirma previsão e atualiza estoque previsto"""
        if self.status != 'PENDENTE':
            raise ValueError("Apenas previsões pendentes podem ser confirmadas")
        
        if self.tipo == 'ENTRADA':
            self.estoque.quantidade_prevista_entrada += self.quantidade
        elif self.tipo == 'SAIDA':
            self.estoque.quantidade_prevista_saida += self.quantidade
        
        self.estoque.save()
        self.status = 'CONFIRMADA'
        self.save()
    
    def realizar(self):
        """Marca previsão como realizada e remove da previsão"""
        if self.status != 'CONFIRMADA':
            raise ValueError("Apenas previsões confirmadas podem ser realizadas")
        
        # Remover da previsão
        if self.tipo == 'ENTRADA':
            self.estoque.quantidade_prevista_entrada -= self.quantidade
        elif self.tipo == 'SAIDA':
            self.estoque.quantidade_prevista_saida -= self.quantidade
        
        self.estoque.save()
        self.status = 'REALIZADA'
        self.save()
    
    def cancelar(self):
        """Cancela previsão e remove da previsão"""
        if self.status not in ['PENDENTE', 'CONFIRMADA']:
            raise ValueError("Previsão não pode ser cancelada neste status")
        
        # Remover da previsão se estava confirmada
        if self.status == 'CONFIRMADA':
            if self.tipo == 'ENTRADA':
                self.estoque.quantidade_prevista_entrada -= self.quantidade
            elif self.tipo == 'SAIDA':
                self.estoque.quantidade_prevista_saida -= self.quantidade
            self.estoque.save()
        
        self.status = 'CANCELADA'
        self.save()
```

### **Atualização de Previsões**

As previsões devem ser atualizadas automaticamente:

1. **Ao criar pedido de compra**: Criar previsão de entrada
2. **Ao criar pedido de venda**: Criar previsão de saída
3. **Ao confirmar recebimento**: Realizar previsão de entrada
4. **Ao confirmar faturamento**: Realizar previsão de saída
5. **Ao cancelar pedido**: Cancelar previsão correspondente

---

## 🔄 Tratamento de Retorno e Cancelamento de Nota Fiscal

### **Contexto**

Quando uma Nota Fiscal é cancelada ou há retorno de mercadoria, o sistema precisa decidir:
1. **O estoque retorna?** (devolução física)
2. **O estoque não retorna?** (cancelamento apenas fiscal)
3. **Como tratar o custo?** (reverter custo médio?)

### **Cenários de Retorno/Cancelamento**

#### **Cenário 1: Cancelamento de NF de Entrada (Compra)**

**Situação:**
- NF de compra foi emitida e estoque foi dado entrada
- NF é cancelada (erro, devolução, etc.)

**Decisões:**

**Opção A: Estoque Retorna (Devolução Física)**
- Mercadoria volta para o fornecedor
- Estoque físico diminui
- Custo médio é recalculado (remove entrada original)

**Opção B: Estoque Não Retorna (Cancelamento Apenas Fiscal)**
- Mercadoria fica com a empresa
- Estoque físico não muda
- Apenas ajuste fiscal (sem impacto no estoque)

**Implementação:**
```python
def cancelar_nf_entrada(numero_nf, serie_nf, devolver_estoque=True, motivo=None):
    """
    Cancela NF de entrada e trata estoque conforme decisão
    """
    # Buscar movimentações relacionadas à NF
    movimentacoes = MovimentacaoEstoque.objects.filter(
        numero_nota_fiscal=numero_nf,
        serie_nota_fiscal=serie_nf,
        origem='COMPRA',
        tipo='ENTRADA',
        status='CONFIRMADA'
    )
    
    for movimentacao in movimentacoes:
        if devolver_estoque:
            # Reverter movimentação (remove estoque)
            movimentacao.reverter(motivo=motivo or "Cancelamento de NF de Entrada")
        else:
            # Apenas marcar como cancelada (sem reverter estoque)
            movimentacao.status = 'CANCELADA'
            movimentacao.motivo_cancelamento = motivo or "Cancelamento Fiscal (sem devolução)"
            movimentacao.save()
```

#### **Cenário 2: Cancelamento de NF de Saída (Venda)**

**Situação:**
- NF de venda foi emitida e estoque foi dado baixa
- NF é cancelada (cliente devolveu, erro, etc.)

**Decisões:**

**Opção A: Estoque Retorna (Devolução do Cliente)**
- Cliente devolve mercadoria
- Estoque físico aumenta
- Custo médio pode ser recalculado (se usar custo original)

**Opção B: Estoque Não Retorna (Cancelamento Apenas Fiscal)**
- Mercadoria não volta
- Estoque físico não muda
- Apenas ajuste fiscal (sem impacto no estoque)

**Implementação:**
```python
def cancelar_nf_saida(numero_nf, serie_nf, devolver_estoque=True, motivo=None):
    """
    Cancela NF de saída e trata estoque conforme decisão
    """
    # Buscar movimentações relacionadas à NF
    movimentacoes = MovimentacaoEstoque.objects.filter(
        numero_nota_fiscal=numero_nf,
        serie_nota_fiscal=serie_nf,
        origem='VENDA',
        tipo='SAIDA',
        status='CONFIRMADA'
    )
    
    for movimentacao in movimentacoes:
        if devolver_estoque:
            # Reverter movimentação (retorna estoque)
            movimentacao.reverter(motivo=motivo or "Cancelamento de NF de Saída - Devolução")
        else:
            # Apenas marcar como cancelada (sem retornar estoque)
            movimentacao.status = 'CANCELADA'
            movimentacao.motivo_cancelamento = motivo or "Cancelamento Fiscal (sem devolução)"
            movimentacao.save()
```

#### **Cenário 3: Retorno Parcial de NF**

**Situação:**
- NF foi emitida com múltiplos itens
- Apenas alguns itens são devolvidos/cancelados

**Tratamento:**
- Criar movimentação reversa apenas para itens devolvidos
- Manter movimentação original para itens não devolvidos
- Registrar motivo específico por item

### **Modelo de Decisão: Estoque Retorna ou Não?**

#### **Critérios para Decisão Automática**

```python
def determinar_se_estoque_retorna(tipo_nf, motivo_cancelamento, tipo_operacao):
    """
    Determina automaticamente se estoque deve retornar
    Baseado em regras de negócio
    """
    # Regras para NF de Entrada (Compra)
    if tipo_nf == 'ENTRADA':
        # Sempre retorna se:
        if motivo_cancelamento in ['DEVOLUCAO', 'ERRO_FORNECEDOR', 'PRODUTO_DEFEITUOSO']:
            return True
        # Não retorna se:
        if motivo_cancelamento in ['ERRO_FISCAL', 'CANCELAMENTO_APENAS_FISCAL']:
            return False
    
    # Regras para NF de Saída (Venda)
    elif tipo_nf == 'SAIDA':
        # Sempre retorna se:
        if motivo_cancelamento in ['DEVOLUCAO_CLIENTE', 'PRODUTO_DEFEITUOSO']:
            return True
        # Não retorna se:
        if motivo_cancelamento in ['ERRO_FISCAL', 'BONIFICACAO', 'PERDA']:
            return False
    
    # Padrão: sempre perguntar ao usuário
    return None  # Requer decisão manual
```

### **Interface para Decisão Manual**

Quando não é possível determinar automaticamente, o sistema deve:

1. **Notificar usuário** sobre necessidade de decisão
2. **Mostrar detalhes** da NF e movimentações relacionadas
3. **Permitir escolha**: Estoque retorna ou não?
4. **Registrar decisão** para auditoria

### **Tratamento de Custo Médio**

#### **Quando Estoque Retorna**

**NF de Entrada Cancelada:**
- Remove entrada do cálculo de custo médio
- Recalcula custo médio sem essa entrada
- Mantém histórico para auditoria

**NF de Saída Cancelada (com devolução):**
- Adiciona estoque de volta
- Custo pode ser:
  - **Custo Original**: Usa custo da movimentação original
  - **Custo Atual**: Usa custo médio atual
  - **Custo Zero**: Não impacta custo médio (para devoluções)

#### **Quando Estoque Não Retorna**

- Não impacta quantidade de estoque
- Não recalcula custo médio
- Apenas ajuste fiscal/documental

### **Modelo de Configuração**

```python
# estoque/models.py

class ConfiguracaoEstoque(SiscrModelBase):
    """
    Configurações de comportamento do estoque por empresa
    """
    empresa = models.OneToOneField(
        'tenants.Empresa',
        on_delete=models.CASCADE,
        related_name='configuracao_estoque'
    )
    
    # Comportamento em cancelamento de NF
    cancelamento_nf_entrada_padrao = models.CharField(
        max_length=20,
        choices=[
            ('DEVOLVER', 'Devolver Estoque (Padrão)'),
            ('MANTER', 'Manter Estoque (Padrão)'),
            ('PERGUNTAR', 'Sempre Perguntar'),
        ],
        default='PERGUNTAR',
        verbose_name='Cancelamento NF Entrada'
    )
    
    cancelamento_nf_saida_padrao = models.CharField(
        max_length=20,
        choices=[
            ('DEVOLVER', 'Devolver Estoque (Padrão)'),
            ('MANTER', 'Manter Estoque (Padrão)'),
            ('PERGUNTAR', 'Sempre Perguntar'),
        ],
        default='PERGUNTAR',
        verbose_name='Cancelamento NF Saída'
    )
    
    # Tratamento de custo em devolução
    custo_devolucao = models.CharField(
        max_length=20,
        choices=[
            ('ORIGINAL', 'Usar Custo Original'),
            ('ATUAL', 'Usar Custo Médio Atual'),
            ('ZERO', 'Custo Zero (não impacta)'),
        ],
        default='ORIGINAL',
        verbose_name='Custo em Devolução'
    )
    
    # Auto-aprovação de reversões
    auto_aprovar_reversao = models.BooleanField(
        default=False,
        verbose_name='Auto-aprovar Reversões',
        help_text='Aprovar automaticamente reversões de movimentações'
    )
```

### **Fluxo Completo de Cancelamento**

```
1. Usuário solicita cancelamento de NF
   ↓
2. Sistema busca movimentações relacionadas
   ↓
3. Para cada movimentação:
   a. Verifica configuração da empresa
   b. Se "PERGUNTAR": mostra interface de decisão
   c. Se padrão definido: usa padrão
   ↓
4. Se devolver estoque:
   a. Cria movimentação reversa
   b. Atualiza estoque físico
   c. Recalcula custo médio (se aplicável)
   ↓
5. Se não devolver:
   a. Marca movimentação como cancelada
   b. Registra motivo
   c. Não altera estoque físico
   ↓
6. Gera log de auditoria
```

### **Recomendações**

1. **Sempre perguntar na primeira vez**: Para casos ambíguos, perguntar ao usuário
2. **Aprender com decisões**: Salvar padrões para próximas vezes
3. **Auditoria completa**: Registrar todas as decisões e motivos
4. **Permitir correção**: Permitir reverter decisão se necessário
5. **Validações**: Verificar se há movimentações dependentes antes de cancelar

---

## 🔄 Fluxos de Negócio

### **Fluxo 1: Entrada de Estoque (Compra)**

```
1. Recebimento de Nota Fiscal de Compra
2. Para cada item da NF:
   a. Buscar ou criar Estoque(produto, filial)
   b. Calcular novo custo médio ponderado
   c. Adicionar quantidade
   d. Criar MovimentacaoEstoque (ENTRADA, COMPRA)
3. Atualizar valor_custo_medio do estoque
```

### **Fluxo 2: Saída de Estoque (Venda)**

```
1. Criação de Pedido de Venda
2. Para cada item do pedido:
   a. Verificar estoque disponível na filial
   b. Se disponível:
      - Criar ReservaEstoque
      - Atualizar quantidade_reservada
   c. Se não disponível:
      - Verificar estoque consolidado
      - Se disponível em outra filial: sugerir transferência
      - Se não disponível: negar venda
3. Ao confirmar venda:
   a. Confirmar ReservaEstoque
   b. Baixar quantidade_atual
   c. Criar MovimentacaoEstoque (SAIDA, VENDA)
```

### **Fluxo 3: Transferência entre Filiais**

```
1. Solicitação de transferência (Filial A → Filial B)
2. Verificar estoque disponível na Filial A
3. Se disponível:
   a. Criar ReservaEstoque na Filial A
   b. Criar MovimentacaoEstoque (SAIDA, TRANSFERENCIA) na Filial A
   c. Baixar estoque da Filial A
   d. Quando recebido na Filial B:
      - Criar MovimentacaoEstoque (ENTRADA, TRANSFERENCIA) na Filial B
      - Adicionar estoque na Filial B
      - Cancelar ReservaEstoque da Filial A
```

### **Fluxo 4: Venda Omnichannel (E-commerce)**

```
1. Cliente adiciona produto ao carrinho no e-commerce
2. Sistema verifica estoque consolidado da empresa
3. Se disponível:
   a. Criar ReservaEstoque com data_expiracao (ex: 30 minutos)
   b. Atualizar quantidade_reservada
4. Cliente finaliza compra:
   a. Confirmar ReservaEstoque
   b. Alocar para filial mais próxima do endereço de entrega
   c. Se filial diferente: agendar transferência
   d. Baixar estoque
5. Se cliente não finalizar em 30min:
   a. Expirar ReservaEstoque automaticamente
   b. Liberar quantidade_reservada
```

---

## 🏢 Análise: Sistema de Estoque da Salesforce (Omnichannel Inventory)

A Salesforce implementa um sistema robusto de gerenciamento de estoque omnichannel que utiliza conceitos avançados de reservas e organização de localizações. Analisando esses conceitos e sua aplicabilidade ao projeto.

### **Conceitos Principais do Salesforce**

#### 1. **Soft Reservation (Reserva Suave)**

**Definição:**
- Reserva provisória de inventário que indica intenção de alocação
- Não bloqueia fisicamente a quantidade no estoque
- Permite flexibilidade para ajustes ou reatribuições
- Geralmente aplicada quando item é adicionado ao carrinho, mas pedido ainda não foi finalizado

**Características:**
- ✅ Não reduz `quantidade_disponivel` imediatamente
- ✅ Pode ser cancelada sem impacto no estoque físico
- ✅ Permite múltiplas soft reservations para o mesmo item
- ✅ Útil para e-commerce (carrinho de compras)
- ✅ Expira automaticamente após período determinado

**Exemplo de Uso:**
```
Cliente adiciona 2 Notebooks Dell ao carrinho no e-commerce
→ Sistema cria Soft Reservation (2 unidades)
→ Estoque disponível continua: 10 unidades
→ Se cliente não finalizar em 30min: Soft Reservation expira
→ Se cliente finalizar: Soft Reservation vira Hard Reservation
```

#### 2. **Hard Reservation (Reserva Rígida)**

**Definição:**
- Reserva confirmada que bloqueia fisicamente a quantidade de estoque
- Garante que os produtos estejam disponíveis para atendimento
- Ocorre quando pedido é confirmado/finalizado
- Reduz imediatamente a quantidade disponível

**Características:**
- ✅ Reduz `quantidade_disponivel` imediatamente
- ✅ Bloqueia estoque para o pedido específico
- ✅ Não pode ser cancelada facilmente (requer processo)
- ✅ Garante disponibilidade para o cliente
- ✅ Usada para pedidos confirmados

**Exemplo de Uso:**
```
Cliente finaliza compra de 2 Notebooks Dell
→ Sistema converte Soft Reservation em Hard Reservation
→ Estoque disponível reduz: 10 → 8 unidades
→ Estoque reservado aumenta: 0 → 2 unidades
→ Produto garantido para este pedido
```

#### 3. **Locations (Localizações)**

**Definição:**
- Representam locais físicos onde o inventário é armazenado
- Cada location possui registros de inventário específicos
- Exemplos: loja física, armazém, centro de distribuição, estoque em trânsito

**Características:**
- ✅ Cada location tem estoque físico independente
- ✅ Pode ter múltiplas locations para o mesmo produto
- ✅ Permite rastreamento granular de onde está cada item
- ✅ Suporta localização física dentro da location (prateleira, setor)

**Estrutura:**
```
Location: "Armazém Central - SP"
├── Produto: Notebook Dell
│   ├── Quantidade: 50 unidades
│   ├── Localização: Setor A, Prateleira 3
│   └── Status: Disponível
│
Location: "Loja Shopping Center"
├── Produto: Notebook Dell
│   ├── Quantidade: 10 unidades
│   ├── Localização: Vitrine Principal
│   └── Status: Disponível
```

#### 4. **Location Groups (Grupos de Localizações)**

**Definição:**
- Agregações lógicas de múltiplas locations
- Permite visão consolidada do inventário em diversos locais
- Facilita estratégias de fulfillment otimizadas
- Exemplos: todas as lojas de uma região, todas as lojas de uma marca

**Características:**
- ✅ Permite gerenciar estoque de forma agregada
- ✅ Facilita atendimento de pedidos a partir de múltiplas locations
- ✅ Suporta regras de negócio (proximidade, capacidade, custo)
- ✅ Permite alocação automática baseada em critérios

**Estrutura:**
```
Location Group: "Região Sul"
├── Location: "Loja Porto Alegre"
├── Location: "Loja Florianópolis"
└── Location: "Loja Curitiba"
    └── Estoque Consolidado: 45 unidades

Location Group: "E-commerce Fulfillment"
├── Location: "Armazém Central - SP"
├── Location: "Armazém Regional - RJ"
└── Location: "Centro de Distribuição - MG"
    └── Estoque Consolidado: 200 unidades
```

### **Fluxo de Reservas no Salesforce**

```
1. Cliente adiciona produto ao carrinho
   → Soft Reservation criada no Location Group
   → Estoque disponível NÃO é reduzido ainda

2. Sistema determina melhor Location dentro do Group
   → Baseado em: proximidade, estoque, capacidade, custo

3. Soft Reservation é atribuída ao Location Group
   → Pode ser transferida entre locations se necessário

4. Cliente finaliza pedido
   → Soft Reservation → Hard Reservation
   → Hard Reservation transferida para Location específica
   → Estoque disponível é reduzido na Location

5. Pedido é atendido
   → Hard Reservation confirmada
   → Estoque físico reduzido
   → Movimentação registrada
```

### **Aplicação ao Projeto SISCR**

#### **Mapeamento de Conceitos**

| Salesforce | SISCR Atual | Compatibilidade |
|------------|-------------|-----------------|
| **Location** | **Filial** | ✅ Alta - Filial já representa local físico |
| **Location Group** | **Empresa** ou **Grupo de Filiais** | ⚠️ Parcial - Precisa criar conceito de grupo |
| **Soft Reservation** | **ReservaEstoque (status=ATIVA)** | ✅ Alta - Pode implementar |
| **Hard Reservation** | **ReservaEstoque (status=CONFIRMADA)** | ✅ Alta - Já previsto no modelo |

#### **Adaptação Proposta**

**1. Filial = Location**
```python
# Já existe no sistema
class Filial(SiscrModelBase):
    # Representa location física
    # Pode ter estoque físico
```

**2. Location Group (Novo Conceito)**
```python
# Novo modelo a ser criado
class GrupoFilial(SiscrModelBase):
    """
    Grupo de Filiais (equivalente a Location Group)
    Permite agrupar filiais para estoque consolidado
    """
    nome = models.CharField(max_length=255)
    empresa = models.ForeignKey('tenants.Empresa', on_delete=models.CASCADE)
    filiais = models.ManyToManyField('tenants.Filial', related_name='grupos')
    
    # Configurações
    permite_fulfillment_cruzado = models.BooleanField(
        default=True,
        help_text='Permite atender pedido de qualquer filial do grupo'
    )
    regra_alocacao = models.CharField(
        max_length=20,
        choices=[
            ('PROXIMIDADE', 'Por Proximidade'),
            ('ESTOQUE', 'Por Disponibilidade de Estoque'),
            ('CUSTO', 'Por Menor Custo'),
            ('ROUND_ROBIN', 'Distribuição Equilibrada'),
        ],
        default='ESTOQUE'
    )
    
    class Meta:
        verbose_name = 'Grupo de Filiais'
        verbose_name_plural = 'Grupos de Filiais'
```

**3. Soft Reservation (Melhorar Modelo Existente)**
```python
class ReservaEstoque(SiscrModelBase):
    # ... campos existentes ...
    
    # NOVO: Tipo de reserva
    tipo_reserva = models.CharField(
        max_length=20,
        choices=[
            ('SOFT', 'Soft Reservation'),
            ('HARD', 'Hard Reservation'),
        ],
        default='SOFT'
    )
    
    # NOVO: Location Group (opcional)
    grupo_filial = models.ForeignKey(
        'estoque.GrupoFilial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reservas',
        help_text='Reserva no grupo (soft) ou filial específica (hard)'
    )
    
    # Comportamento:
    # - SOFT: Não reduz quantidade_disponivel, apenas reserva lógica
    # - HARD: Reduz quantidade_disponivel e quantidade_reservada
```

**4. Hard Reservation (Melhorar Modelo Existente)**
```python
# Quando Soft Reservation vira Hard Reservation:
def confirmar_reserva(reserva):
    if reserva.tipo_reserva == 'SOFT':
        # Determinar melhor filial dentro do grupo
        if reserva.grupo_filial:
            filial = determinar_melhor_filial(
                reserva.grupo_filial,
                reserva.produto,
                reserva.quantidade
            )
            reserva.estoque = Estoque.objects.get(
                produto=reserva.produto,
                filial=filial
            )
        
        # Converter para HARD
        reserva.tipo_reserva = 'HARD'
        reserva.estoque.quantidade_reservada += reserva.quantidade
        reserva.estoque.quantidade_disponivel -= reserva.quantidade
        reserva.estoque.save()
        reserva.status = 'CONFIRMADA'
        reserva.save()
```

### **Vantagens de Implementar Conceitos do Salesforce**

#### ✅ **1. Flexibilidade de Reservas**
- Soft reservations permitem carrinho de compras sem bloquear estoque
- Hard reservations garantem disponibilidade para pedidos confirmados
- Reduz risco de overselling

#### ✅ **2. Otimização de Fulfillment**
- Location Groups permitem escolher melhor filial para atender pedido
- Baseado em proximidade, custo, disponibilidade
- Melhora experiência do cliente e reduz custos

#### ✅ **3. Escalabilidade**
- Suporta crescimento de filiais sem complexidade adicional
- Grupos podem ser reorganizados conforme necessário
- Facilita expansão geográfica

#### ✅ **4. Visão Consolidada**
- Estoque consolidado por grupo facilita relatórios
- Permite venda omnichannel (vender de qualquer filial)
- Mantém controle granular por filial

### **Desafios e Considerações**

#### ⚠️ **1. Complexidade Adicional**
- Requer lógica mais sofisticada de alocação
- Precisa de regras de negócio bem definidas
- Pode ser over-engineering para casos simples

#### ⚠️ **2. Performance**
- Determinar melhor filial pode ser custoso computacionalmente
- Múltiplas soft reservations podem impactar performance
- Requer cache e otimizações

#### ⚠️ **3. Sincronização**
- Soft reservations expiram - precisa de job assíncrono
- Hard reservations precisam ser sincronizadas em tempo real
- Transferências entre filiais requerem coordenação

### **Recomendação: Implementação Gradual**

#### **Fase 1: Básico (Sem Salesforce)**
- Estoque físico por filial
- Reservas simples (hard only)
- Transferências manuais

#### **Fase 2: Soft Reservations**
- Adicionar soft reservations para e-commerce
- Expiração automática
- Conversão soft → hard

#### **Fase 3: Location Groups**
- Criar grupos de filiais
- Alocação automática baseada em regras
- Fulfillment otimizado

#### **Fase 4: Avançado**
- Múltiplas regras de alocação
- Machine learning para otimização
- Integração com sistemas de logística

### **Modelo de Dados Proposto (Com Conceitos Salesforce)**

```python
# estoque/models.py

class GrupoFilial(SiscrModelBase):
    """
    Grupo de Filiais (Location Group)
    Permite agrupar filiais para estoque consolidado e fulfillment otimizado
    """
    nome = models.CharField(max_length=255, verbose_name='Nome do Grupo')
    empresa = models.ForeignKey(
        'tenants.Empresa',
        on_delete=models.CASCADE,
        related_name='grupos_filiais'
    )
    filiais = models.ManyToManyField(
        'tenants.Filial',
        related_name='grupos',
        verbose_name='Filiais do Grupo'
    )
    
    # Configurações de Fulfillment
    permite_fulfillment_cruzado = models.BooleanField(
        default=True,
        verbose_name='Permite Fulfillment Cruzado',
        help_text='Permite atender pedido de qualquer filial do grupo'
    )
    
    regra_alocacao = models.CharField(
        max_length=20,
        choices=[
            ('PROXIMIDADE', 'Por Proximidade ao Cliente'),
            ('ESTOQUE', 'Por Maior Disponibilidade de Estoque'),
            ('CUSTO', 'Por Menor Custo de Envio'),
            ('ROUND_ROBIN', 'Distribuição Equilibrada'),
            ('PRIORIDADE', 'Por Prioridade da Filial'),
        ],
        default='ESTOQUE',
        verbose_name='Regra de Alocação'
    )
    
    # Prioridades (para regra PRIORIDADE)
    prioridade_filiais = models.JSONField(
        default=dict,
        blank=True,
        help_text='JSON com prioridades: {"filial_id": 1, "filial_id": 2}'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    
    class Meta:
        verbose_name = 'Grupo de Filiais'
        verbose_name_plural = 'Grupos de Filiais'
        ordering = ['nome']
    
    def __str__(self):
        return f"{self.nome} ({self.empresa.nome})"
    
    def get_estoque_consolidado(self, produto):
        """Retorna estoque consolidado do grupo para um produto"""
        estoques = Estoque.objects.filter(
            produto=produto,
            filial__in=self.filiais.all()
        )
        return {
            'total': sum(e.quantidade_atual for e in estoques),
            'reservado': sum(e.quantidade_reservada for e in estoques),
            'disponivel': sum(e.quantidade_disponivel for e in estoques),
        }
    
    def determinar_melhor_filial(self, produto, quantidade, endereco_cliente=None):
        """
        Determina a melhor filial dentro do grupo para atender um pedido
        Baseado na regra_alocacao configurada
        """
        filiais_disponiveis = self.filiais.filter(
            estoques__produto=produto,
            estoques__quantidade_disponivel__gte=quantidade
        ).distinct()
        
        if not filiais_disponiveis.exists():
            return None
        
        if self.regra_alocacao == 'ESTOQUE':
            # Filial com maior estoque disponível
            melhor = None
            maior_estoque = 0
            for filial in filiais_disponiveis:
                estoque = Estoque.objects.get(produto=produto, filial=filial)
                if estoque.quantidade_disponivel > maior_estoque:
                    maior_estoque = estoque.quantidade_disponivel
                    melhor = filial
            return melhor
        
        elif self.regra_alocacao == 'PROXIMIDADE':
            # Filial mais próxima (requer cálculo de distância)
            # Implementar lógica de geolocalização
            return filiais_disponiveis.first()  # Placeholder
        
        elif self.regra_alocacao == 'PRIORIDADE':
            # Filial com maior prioridade
            melhor = None
            maior_prioridade = 0
            for filial in filiais_disponiveis:
                prioridade = self.prioridade_filiais.get(str(filial.id), 0)
                if prioridade > maior_prioridade:
                    maior_prioridade = prioridade
                    melhor = filial
            return melhor or filiais_disponiveis.first()
        
        else:
            # Round robin ou padrão
            return filiais_disponiveis.first()


class ReservaEstoque(SiscrModelBase):
    """
    Reservas de estoque (melhorado com conceitos Salesforce)
    """
    STATUS_CHOICES = [
        ('ATIVA', 'Ativa'),
        ('CONFIRMADA', 'Confirmada'),
        ('CANCELADA', 'Cancelada'),
        ('EXPIRADA', 'Expirada'),
    ]
    
    ORIGEM_CHOICES = [
        ('VENDA', 'Venda'),
        ('ECOMMERCE', 'E-commerce'),
        ('MARKETPLACE', 'Marketplace'),
        ('ORCAMENTO', 'Orçamento'),
    ]
    
    TIPO_RESERVA_CHOICES = [
        ('SOFT', 'Soft Reservation'),
        ('HARD', 'Hard Reservation'),
    ]
    
    # Reserva pode estar em grupo (soft) ou filial específica (hard)
    grupo_filial = models.ForeignKey(
        GrupoFilial,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reservas',
        verbose_name='Grupo de Filiais',
        help_text='Para soft reservations - reserva no grupo'
    )
    
    estoque = models.ForeignKey(
        'Estoque',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reservas',
        verbose_name='Estoque',
        help_text='Para hard reservations - estoque específico da filial'
    )
    
    # Se não tem estoque nem grupo, usar produto + filial
    produto = models.ForeignKey(
        'cadastros.Produto',
        on_delete=models.PROTECT,
        related_name='reservas'
    )
    filial = models.ForeignKey(
        'tenants.Filial',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='reservas'
    )
    
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    
    tipo_reserva = models.CharField(
        max_length=20,
        choices=TIPO_RESERVA_CHOICES,
        default='SOFT',
        verbose_name='Tipo de Reserva'
    )
    
    origem_tipo = models.CharField(max_length=20, choices=ORIGEM_CHOICES)
    origem_id = models.IntegerField(help_text='ID do pedido, orçamento, etc.')
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ATIVA'
    )
    
    data_expiracao = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Data de expiração (para soft reservations)'
    )
    
    class Meta:
        verbose_name = 'Reserva de Estoque'
        verbose_name_plural = 'Reservas de Estoque'
        indexes = [
            models.Index(fields=['grupo_filial', 'status']),
            models.Index(fields=['estoque', 'status']),
            models.Index(fields=['tipo_reserva', 'status']),
            models.Index(fields=['status', 'data_expiracao']),
        ]
    
    def __str__(self):
        tipo = "Soft" if self.tipo_reserva == 'SOFT' else "Hard"
        return f"{tipo} Reservation - {self.produto} ({self.quantidade})"
    
    def confirmar(self):
        """
        Confirma reserva (converte soft em hard se necessário)
        """
        if self.status != 'ATIVA':
            raise ValueError("Apenas reservas ativas podem ser confirmadas")
        
        # Se é soft reservation, precisa determinar filial
        if self.tipo_reserva == 'SOFT' and self.grupo_filial:
            # Determinar melhor filial
            filial = self.grupo_filial.determinar_melhor_filial(
                self.produto,
                self.quantidade
            )
            
            if not filial:
                raise ValueError("Nenhuma filial disponível no grupo")
            
            # Obter ou criar estoque
            self.estoque, _ = Estoque.objects.get_or_create(
                produto=self.produto,
                filial=filial,
                defaults={'empresa': filial.empresa}
            )
            
            # Converter para hard
            self.tipo_reserva = 'HARD'
            self.filial = filial
            self.grupo_filial = None  # Não precisa mais do grupo
        
        # Aplicar hard reservation
        if self.tipo_reserva == 'HARD' and self.estoque:
            self.estoque.quantidade_reservada += self.quantidade
            self.estoque.quantidade_disponivel -= self.quantidade
            self.estoque.save()
        
        self.status = 'CONFIRMADA'
        self.save()
    
    def cancelar(self):
        """Cancela a reserva e libera o estoque"""
        if self.status not in ['ATIVA', 'CONFIRMADA']:
            raise ValueError("Reserva não pode ser cancelada neste status")
        
        # Se é hard reservation, liberar estoque
        if self.tipo_reserva == 'HARD' and self.estoque:
            self.estoque.quantidade_reservada -= self.quantidade
            self.estoque.quantidade_disponivel += self.quantidade
            self.estoque.save()
        
        self.status = 'CANCELADA'
        self.save()
    
    def expirar(self):
        """Expira uma soft reservation"""
        if self.tipo_reserva != 'SOFT':
            raise ValueError("Apenas soft reservations podem expirar")
        
        if self.status != 'ATIVA':
            return
        
        self.status = 'EXPIRADA'
        self.save()
```

### **Conclusão: Faz Sentido Implementar?**

#### ✅ **SIM, mas de forma gradual**

**Vantagens:**
- ✅ Soft/Hard reservations resolvem problema real (carrinho de compras)
- ✅ Location Groups facilitam expansão e otimização
- ✅ Alinhado com melhores práticas do mercado
- ✅ Escalável para crescimento futuro

**Recomendação:**
1. **Começar simples**: Estoque físico por filial + reservas básicas
2. **Adicionar soft reservations**: Quando implementar e-commerce
3. **Adicionar location groups**: Quando tiver múltiplas filiais e necessidade de otimização
4. **Evoluir**: Adicionar regras mais sofisticadas conforme necessidade

**Não implementar se:**
- ❌ Apenas uma filial por empresa
- ❌ Não há e-commerce (não precisa soft reservations)
- ❌ Volume baixo (over-engineering)

---

## ⚙️ Processamento de Estoque: Quando e Por Que Usar Workers Celery

### **O Que Significa "Processar Estoque"?**

"Processar estoque" refere-se a operações que mantêm os dados de inventário atualizados, precisos e consistentes. Essas operações geralmente são computacionalmente custosas ou precisam ser executadas periodicamente, não em tempo real.

### **Por Que Muitos Sistemas Têm Esse Conceito?**

Sistemas ERP/WMS implementam processamento de estoque porque:

1. **Cálculos Complexos**: Alguns cálculos são muito pesados para fazer em tempo real
2. **Consistência de Dados**: Garante que todos os dados estejam sincronizados
3. **Performance**: Evita bloquear operações críticas (vendas) com cálculos demorados
4. **Reconciliação**: Detecta e corrige inconsistências automaticamente
5. **Análises**: Gera indicadores e relatórios que não precisam ser em tempo real

### **O Que Precisa Ser Processado?**

#### **1. Cálculo de Custos (Custo Médio Ponderado)**

**Por quê?**
- Quando há entradas de produtos com preços diferentes, o custo médio precisa ser recalculado
- Cálculo pode ser complexo com muitas movimentações
- Não precisa ser em tempo real (pode processar em lote)

**Exemplo:**
```
Estoque atual: 10 unidades a R$ 50,00 = R$ 500,00
Nova entrada: 20 unidades a R$ 60,00 = R$ 1.200,00

Custo Médio = (500 + 1200) / (10 + 20) = R$ 56,67

Se fizer em tempo real: pode bloquear venda
Se processar em background: venda continua rápida
```

**Quando processar:**
- Após cada entrada de estoque (compra)
- Em lote a cada X minutos/horas
- Antes de gerar relatórios de custos

#### **2. Atualização de Quantidades Disponíveis**

**Por quê?**
- Quantidade disponível = quantidade_atual - quantidade_reservada
- Pode haver inconsistências se houver falhas em transações
- Soft reservations podem expirar e liberar estoque

**Exemplo:**
```
Estoque: quantidade_atual = 10, quantidade_reservada = 3
Disponível deveria ser: 7

Mas se houver soft reservation expirada:
- quantidade_reservada deveria ser 2
- Disponível deveria ser 8

Processamento corrige isso automaticamente
```

**Quando processar:**
- Após cada movimentação (síncrono para hard reservations)
- Periodicamente para reconciliar (assíncrono)
- Ao expirar soft reservations

#### **3. Expiração de Soft Reservations**

**Por quê?**
- Soft reservations têm data de expiração (ex: 30 minutos)
- Precisam ser expiradas automaticamente
- Liberam estoque quando expiram

**Exemplo:**
```
Cliente adiciona produto ao carrinho → Soft Reservation criada
Cliente não finaliza compra em 30min → Soft Reservation expira
Estoque volta a ficar disponível para outros clientes
```

**Quando processar:**
- Periodicamente (a cada 1-5 minutos)
- Verificar todas as soft reservations expiradas
- Atualizar status e liberar estoque

#### **4. Reconciliação de Estoque**

**Por quê?**
- Pode haver inconsistências entre estoque físico e lógico
- Falhas em transações podem deixar dados inconsistentes
- Ajustes manuais podem criar divergências

**Exemplo:**
```
Estoque Lógico: 10 unidades
Estoque Físico (contagem): 8 unidades
Diferença: -2 unidades (faltam 2)

Reconciliação:
- Detecta diferença
- Cria ajuste automático ou notifica para ajuste manual
- Atualiza estoque lógico para bater com físico
```

**Quando processar:**
- Diariamente (reconciliação leve)
- Semanalmente (reconciliação completa)
- Após contagens físicas

#### **5. Cálculo de Indicadores**

**Por quê?**
- Rotatividade de estoque, giro, dias de estoque
- Produtos parados, produtos com baixa rotatividade
- Cálculos podem ser pesados com muitos produtos

**Exemplo:**
```
Para cada produto:
- Calcular rotatividade (vendas / estoque médio)
- Calcular dias de estoque (estoque / vendas diárias)
- Identificar produtos parados (>90 dias sem movimento)
- Identificar produtos com estoque mínimo atingido
```

**Quando processar:**
- Diariamente (indicadores básicos)
- Semanalmente (análises mais complexas)
- Mensalmente (relatórios consolidados)

#### **6. Atualização de Estoque Consolidado**

**Por quê?**
- Location Groups precisam de estoque consolidado atualizado
- Múltiplas filiais = múltiplos cálculos
- Pode ser custoso calcular em tempo real

**Exemplo:**
```
Grupo de Filiais "Região Sul":
- Filial A: 10 unidades
- Filial B: 5 unidades
- Filial C: 8 unidades
Total Consolidado: 23 unidades

Se houver venda na Filial A:
- Atualizar Filial A: 10 → 9 (síncrono)
- Atualizar Consolidado: 23 → 22 (pode ser assíncrono)
```

**Quando processar:**
- Após cada movimentação (pode ser assíncrono)
- Periodicamente para garantir consistência
- Antes de consultas de estoque consolidado

#### **7. Notificações e Alertas**

**Por quê?**
- Estoque mínimo atingido
- Produtos parados
- Necessidade de reposição
- Não precisa ser em tempo real

**Exemplo:**
```
Produto: Notebook Dell
Estoque Mínimo: 5 unidades
Estoque Atual: 3 unidades

Sistema detecta e envia alerta:
- Email para comprador
- Notificação no sistema
- Sugestão de compra
```

**Quando processar:**
- Diariamente (verificar alertas)
- Imediatamente após movimentações críticas (opcional)

---

### **Tarefas Celery Recomendadas para Estoque**

#### **1. Tarefas Periódicas (Celery Beat)**

```python
# estoque/tasks.py

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from estoque.models import Estoque, ReservaEstoque, MovimentacaoEstoque
from django.db.models import Sum, F

@shared_task
def expirar_soft_reservations():
    """
    Expira soft reservations que passaram da data de expiração
    Executa a cada 5 minutos
    """
    agora = timezone.now()
    reservas_expiradas = ReservaEstoque.objects.filter(
        tipo_reserva='SOFT',
        status='ATIVA',
        data_expiracao__lt=agora
    )
    
    for reserva in reservas_expiradas:
        reserva.expirar()
    
    return f"Expiraram {reservas_expiradas.count()} soft reservations"


@shared_task
def atualizar_custo_medio_produtos():
    """
    Recalcula custo médio ponderado de todos os produtos
    Executa a cada 1 hora
    """
    produtos_processados = 0
    
    for estoque in Estoque.objects.select_related('produto').all():
        # Buscar últimas entradas
        entradas = MovimentacaoEstoque.objects.filter(
            estoque=estoque,
            tipo='ENTRADA',
            origem='COMPRA'
        ).order_by('-data_movimentacao')[:10]  # Últimas 10 entradas
        
        if entradas.exists():
            # Calcular custo médio ponderado
            total_quantidade = sum(e.quantidade for e in entradas)
            total_valor = sum(e.valor_total for e in entradas)
            
            if total_quantidade > 0:
                custo_medio = total_valor / total_quantidade
                estoque.valor_custo_medio = custo_medio
                estoque.save()
                produtos_processados += 1
    
    return f"Atualizados {produtos_processados} custos médios"


@shared_task
def reconciliar_estoque_disponivel():
    """
    Recalcula quantidade_disponivel de todos os estoques
    Garante consistência: disponivel = atual - reservado
    Executa a cada 30 minutos
    """
    estoques_atualizados = 0
    
    for estoque in Estoque.objects.all():
        # Recalcular disponível
        disponivel_calculado = estoque.quantidade_atual - estoque.quantidade_reservada
        
        # Se diferente, atualizar
        if estoque.quantidade_disponivel != disponivel_calculado:
            estoque.quantidade_disponivel = disponivel_calculado
            estoque.save()
            estoques_atualizados += 1
    
    return f"Reconciliados {estoques_atualizados} estoques"


@shared_task
def atualizar_estoque_consolidado_grupos():
    """
    Atualiza estoque consolidado de todos os grupos de filiais
    Executa a cada 15 minutos
    """
    from estoque.models import GrupoFilial, EstoqueVirtual
    
    grupos_atualizados = 0
    
    for grupo in GrupoFilial.objects.filter(is_active=True):
        # Para cada produto, calcular estoque consolidado
        produtos = grupo.filiais.values_list(
            'estoques__produto', flat=True
        ).distinct()
        
        for produto_id in produtos:
            estoques = Estoque.objects.filter(
                produto_id=produto_id,
                filial__in=grupo.filiais.all()
            )
            
            total = sum(e.quantidade_atual for e in estoques)
            reservado = sum(e.quantidade_reservada for e in estoques)
            disponivel = sum(e.quantidade_disponivel for e in estoques)
            
            # Atualizar ou criar estoque virtual
            EstoqueVirtual.objects.update_or_create(
                produto_id=produto_id,
                empresa=grupo.empresa,
                defaults={
                    'quantidade_total': total,
                    'quantidade_reservada': reservado,
                    'quantidade_disponivel': disponivel,
                }
            )
        
        grupos_atualizados += 1
    
    return f"Atualizados {grupos_atualizados} grupos"


@shared_task
def verificar_estoque_minimo():
    """
    Verifica produtos abaixo do estoque mínimo e envia alertas
    Executa diariamente
    """
    from django.core.mail import send_mail
    from django.conf import settings
    
    estoques_baixos = Estoque.objects.filter(
        quantidade_atual__lt=F('estoque_minimo'),
        estoque_minimo__gt=0
    ).select_related('produto', 'filial', 'empresa')
    
    alertas_enviados = 0
    
    for estoque in estoques_baixos:
        # Enviar email para responsável
        assunto = f"Alerta: Estoque Mínimo - {estoque.produto.nome}"
        mensagem = f"""
        Produto: {estoque.produto.nome}
        Filial: {estoque.filial.nome}
        Estoque Atual: {estoque.quantidade_atual}
        Estoque Mínimo: {estoque.estoque_minimo}
        Diferença: {estoque.estoque_minimo - estoque.quantidade_atual}
        """
        
        # Buscar email do responsável (implementar lógica)
        # send_mail(assunto, mensagem, settings.DEFAULT_FROM_EMAIL, [email])
        alertas_enviados += 1
    
    return f"Enviados {alertas_enviados} alertas de estoque mínimo"


@shared_task
def calcular_indicadores_estoque():
    """
    Calcula indicadores de estoque (rotatividade, giro, etc.)
    Executa semanalmente
    """
    from datetime import datetime, timedelta
    
    # Período: últimos 30 dias
    data_inicio = timezone.now() - timedelta(days=30)
    
    indicadores_calculados = 0
    
    for estoque in Estoque.objects.select_related('produto').all():
        # Calcular vendas no período
        vendas = MovimentacaoEstoque.objects.filter(
            estoque=estoque,
            tipo='SAIDA',
            origem='VENDA',
            data_movimentacao__gte=data_inicio
        ).aggregate(total=Sum('quantidade'))['total'] or 0
        
        # Calcular estoque médio (simplificado)
        estoque_medio = estoque.quantidade_atual
        
        # Calcular rotatividade
        if estoque_medio > 0:
            rotatividade = vendas / estoque_medio
        else:
            rotatividade = 0
        
        # Calcular dias de estoque
        if vendas > 0:
            vendas_diarias = vendas / 30
            dias_estoque = estoque.quantidade_atual / vendas_diarias if vendas_diarias > 0 else 0
        else:
            dias_estoque = 999  # Produto parado
        
        # Salvar indicadores (criar modelo se necessário)
        # IndicadorEstoque.objects.update_or_create(...)
        
        indicadores_calculados += 1
    
    return f"Calculados indicadores para {indicadores_calculados} estoques"
```

#### **2. Tarefas Assíncronas (Chamadas Sob Demanda)**

```python
@shared_task
def processar_entrada_estoque(estoque_id, movimentacao_id):
    """
    Processa entrada de estoque de forma assíncrona
    - Recalcula custo médio
    - Atualiza quantidades
    - Atualiza estoque consolidado
    """
    from estoque.models import Estoque, MovimentacaoEstoque
    
    estoque = Estoque.objects.get(id=estoque_id)
    movimentacao = MovimentacaoEstoque.objects.get(id=movimentacao_id)
    
    # Recalcular custo médio ponderado
    entradas_recentes = MovimentacaoEstoque.objects.filter(
        estoque=estoque,
        tipo='ENTRADA',
        origem='COMPRA'
    ).order_by('-data_movimentacao')[:10]
    
    if entradas_recentes.exists():
        total_quantidade = sum(e.quantidade for e in entradas_recentes)
        total_valor = sum(e.valor_total for e in entradas_recentes)
        
        if total_quantidade > 0:
            estoque.valor_custo_medio = total_valor / total_quantidade
            estoque.save()
    
    # Atualizar estoque consolidado (se houver grupo)
    if estoque.filial.grupos.exists():
        atualizar_estoque_consolidado_grupos.delay()
    
    return f"Processada entrada de estoque {estoque_id}"


@shared_task
def processar_saida_estoque(estoque_id, movimentacao_id):
    """
    Processa saída de estoque de forma assíncrona
    - Atualiza quantidades
    - Atualiza estoque consolidado
    - Verifica estoque mínimo
    """
    from estoque.models import Estoque, MovimentacaoEstoque
    
    estoque = Estoque.objects.get(id=estoque_id)
    
    # Verificar se está abaixo do mínimo
    if estoque.quantidade_atual < estoque.estoque_minimo:
        # Enviar alerta assíncrono
        verificar_estoque_minimo.delay()
    
    # Atualizar estoque consolidado
    if estoque.filial.grupos.exists():
        atualizar_estoque_consolidado_grupos.delay()
    
    return f"Processada saída de estoque {estoque_id}"
```

### **Configuração do Celery Beat**

```python
# siscr/settings.py

CELERY_BEAT_SCHEDULE = {
    # ... tarefas existentes de subscriptions ...
    
    # Estoque: Expirar soft reservations (a cada 5 minutos)
    'expirar-soft-reservations': {
        'task': 'estoque.tasks.expirar_soft_reservations',
        'schedule': 300.0,  # 5 minutos
    },
    
    # Estoque: Reconciliar quantidades disponíveis (a cada 30 minutos)
    'reconciliar-estoque-disponivel': {
        'task': 'estoque.tasks.reconciliar_estoque_disponivel',
        'schedule': 1800.0,  # 30 minutos
    },
    
    # Estoque: Atualizar custo médio (a cada 1 hora)
    'atualizar-custo-medio': {
        'task': 'estoque.tasks.atualizar_custo_medio_produtos',
        'schedule': 3600.0,  # 1 hora
    },
    
    # Estoque: Atualizar estoque consolidado (a cada 15 minutos)
    'atualizar-estoque-consolidado': {
        'task': 'estoque.tasks.atualizar_estoque_consolidado_grupos',
        'schedule': 900.0,  # 15 minutos
    },
    
    # Estoque: Verificar estoque mínimo (diariamente)
    'verificar-estoque-minimo': {
        'task': 'estoque.tasks.verificar_estoque_minimo',
        'schedule': 86400.0,  # 24 horas
    },
    
    # Estoque: Calcular indicadores (semanalmente)
    'calcular-indicadores-estoque': {
        'task': 'estoque.tasks.calcular_indicadores_estoque',
        'schedule': 604800.0,  # 7 dias
    },
}
```

### **Quando Usar Processamento Assíncrono vs Síncrono**

#### **✅ Processar Sincronamente (Tempo Real)**

- **Quantidades básicas**: `quantidade_atual`, `quantidade_reservada`, `quantidade_disponivel`
- **Hard reservations**: Precisa bloquear estoque imediatamente
- **Vendas confirmadas**: Precisa baixar estoque imediatamente
- **Validações críticas**: Verificar disponibilidade antes de vender

**Razão**: Essas operações são rápidas e críticas para o negócio.

#### **✅ Processar Assincronamente (Background)**

- **Custo médio ponderado**: Cálculo pode ser complexo
- **Estoque consolidado**: Múltiplas filiais = múltiplos cálculos
- **Indicadores**: Análises pesadas, não críticas
- **Reconciliação**: Pode ser feito periodicamente
- **Notificações**: Não precisa ser imediato
- **Soft reservations expiradas**: Pode processar em lote

**Razão**: Essas operações são pesadas ou não críticas para operação imediata.

### **Recomendação Final**

#### **✅ SIM, implementar workers Celery para estoque**

**Tarefas essenciais:**
1. ✅ **Expirar soft reservations** (a cada 5 minutos)
2. ✅ **Reconciliar quantidades** (a cada 30 minutos)
3. ✅ **Atualizar custo médio** (a cada 1 hora)
4. ✅ **Atualizar estoque consolidado** (a cada 15 minutos)

**Tarefas opcionais (conforme necessidade):**
5. ⚠️ **Verificar estoque mínimo** (diariamente)
6. ⚠️ **Calcular indicadores** (semanalmente)

**Não processar em background:**
- ❌ Quantidades básicas (atualizar síncrono)
- ❌ Hard reservations (bloquear imediatamente)
- ❌ Validações de disponibilidade (tempo real)

**Benefícios:**
- ✅ Performance: Vendas não são bloqueadas por cálculos pesados
- ✅ Consistência: Dados sempre atualizados e reconciliados
- ✅ Escalabilidade: Pode processar grandes volumes
- ✅ Confiabilidade: Tarefas podem ser reprocessadas se falharem

---

## 🚀 Considerações de Performance

### **Índices Recomendados**

```python
# Já incluídos nos modelos, mas importante destacar:

# Para consultas por empresa/filial
Index(fields=['empresa', 'filial'])
Index(fields=['produto', 'filial'])

# Para consultas consolidadas
Index(fields=['empresa', 'produto'])

# Para movimentações
Index(fields=['estoque', 'data_movimentacao'])
Index(fields=['tipo', 'data_movimentacao'])

# Para reservas
Index(fields=['status', 'data_expiracao'])
```

### **Otimizações**

1. **Cache de Estoque Consolidado**
   - Cachear estoque consolidado por empresa (Redis)
   - Invalidar cache ao fazer movimentações
   - TTL de 1-5 minutos

2. **Atualização Assíncrona**
   - Usar Celery para atualizar estoque consolidado
   - Não bloquear venda enquanto atualiza

3. **Read Replicas**
   - Para relatórios pesados, usar read replica
   - Consultas de estoque consolidado em read replica

---

## 📋 Plano de Execução - Desenvolvimento do Módulo de Estoque

### **Estrutura Hierárquica Confirmada**

```
Tenant (Schema isolado)
└── Empresa (sempre criada no signup)
    ├── Location (vinculada à empresa, filial opcional)
    │   └── Estoque (por produto + location)
    │
    └── Filial (opcional, criada depois)
        └── Location (vinculada à filial)
            └── Estoque (por produto + location)
```

**Regras:**
- ✅ Location sempre vinculada a Empresa (obrigatório)
- ✅ Location pode ter Filial (opcional, null=True)
- ✅ Se `filial=None`: Location é da empresa (sem filiais ou compartilhada)
- ✅ Se `filial!=None`: Location é específica da filial

---

## 🚀 FASE 1: Fundação - Modelos e Estrutura Base

### **1.1 Criar App Estoque**
- [ ] Criar app `estoque` no projeto
- [ ] Adicionar ao `INSTALLED_APPS`
- [ ] Criar estrutura de pastas (`models.py`, `admin.py`, `api/`, etc.)

### **1.2 Modelo Location**
- [ ] Criar modelo `Location` com:
  - [ ] Vínculo obrigatório com `Empresa`
  - [ ] Vínculo opcional com `Filial` (null=True, blank=True)
  - [ ] Tipo (LOJA, ALMOXARIFADO, ARMAZEM, etc.)
  - [ ] Endereço completo (logradouro, número, complemento, bairro, cidade, estado, CEP)
  - [ ] Coordenadas (latitude, longitude) - opcional
  - [ ] Controle de operações (permite_entrada, permite_saida, permite_transferencia)
  - [ ] Validação: filial deve pertencer à empresa
- [ ] Criar migration
- [ ] Registrar no Admin Django
- [ ] Testes unitários básicos

### **1.3 Modelo Estoque**
- [ ] Criar modelo `Estoque` com:
  - [ ] Vínculo com `Produto` e `Location`
  - [ ] Quantidades (atual, reservada, disponível)
  - [ ] Quantidades previstas (entrada, saída)
  - [ ] Localização interna (prateleira, setor)
  - [ ] Valores (custo médio, valor total)
  - [ ] Controle (estoque mínimo, máximo)
  - [ ] Unique together: produto + location
- [ ] Criar migration
- [ ] Registrar no Admin Django
- [ ] Testes unitários básicos

### **1.4 Modelo MovimentacaoEstoque**
- [ ] Criar modelo `MovimentacaoEstoque` com:
  - [ ] Tipo (ENTRADA, SAIDA, TRANSFERENCIA, AJUSTE)
  - [ ] Origem (COMPRA, VENDA, DEVOLUCAO, etc.)
  - [ ] Status (PENDENTE, CONFIRMADA, CANCELADA, REVERTIDA)
  - [ ] Quantidade (sempre positiva)
  - [ ] Valores (unitário, total)
  - [ ] Locations (origem, destino) - para transferências
  - [ ] Referências (documento, NF, série NF)
  - [ ] Rastreamento de reversões (movimentacao_original)
  - [ ] Data prevista (para previsões)
- [ ] Criar migration
- [ ] Registrar no Admin Django
- [ ] Método `reverter()` para cancelamentos
- [ ] Testes unitários básicos

**Entregável Fase 1**: Modelos criados, migrations aplicadas, Admin funcional

---

## 🔄 FASE 2: Lógica de Negócio Core

### **2.1 Serviços de Entrada de Estoque**
- [ ] Criar `estoque/services.py`
- [ ] Função `processar_entrada_estoque()`:
  - [ ] Validar location permite entrada
  - [ ] Buscar ou criar estoque
  - [ ] Atualizar quantidade_atual
  - [ ] Calcular custo médio ponderado
  - [ ] Criar movimentação (tipo=ENTRADA)
  - [ ] Atualizar quantidade_prevista_entrada (se havia previsão)
- [ ] Validações de negócio
- [ ] Testes unitários

### **2.2 Serviços de Saída de Estoque**
- [ ] Função `processar_saida_estoque()`:
  - [ ] Validar location permite saída
  - [ ] Validar estoque disponível
  - [ ] Atualizar quantidade_atual
  - [ ] Criar movimentação (tipo=SAIDA)
  - [ ] Atualizar quantidade_prevista_saida (se havia previsão)
  - [ ] Verificar estoque mínimo (alertar se necessário)
- [ ] Validações de negócio
- [ ] Testes unitários

### **2.3 Cálculo de Custo Médio Ponderado**
- [ ] Função `calcular_custo_medio_ponderado()`:
  - [ ] Buscar últimas entradas (compras)
  - [ ] Calcular: (soma valores) / (soma quantidades)
  - [ ] Atualizar estoque.valor_custo_medio
- [ ] Testes unitários com diferentes cenários

### **2.4 Validações e Regras de Negócio**
- [ ] Validar estoque mínimo/máximo
- [ ] Validar permissões de location
- [ ] Validar filial pertence à empresa
- [ ] Validar quantidade sempre positiva
- [ ] Testes unitários

**Entregável Fase 2**: Serviços core funcionando, lógica de negócio implementada

---

## 📦 FASE 3: Reservas e Previsões

### **3.1 Modelo ReservaEstoque**
- [ ] Criar modelo `ReservaEstoque` com:
  - [ ] Tipo de reserva (SOFT, HARD)
  - [ ] Vínculo com estoque ou grupo de filiais
  - [ ] Quantidade
  - [ ] Origem (VENDA, ECOMMERCE, etc.)
  - [ ] Status (ATIVA, CONFIRMADA, CANCELADA, EXPIRADA)
  - [ ] Data de expiração
- [ ] Métodos: `confirmar()`, `cancelar()`, `expirar()`
- [ ] Criar migration
- [ ] Registrar no Admin
- [ ] Testes unitários

### **3.2 Modelo PrevisaoMovimentacao**
- [ ] Criar modelo `PrevisaoMovimentacao` com:
  - [ ] Tipo (ENTRADA, SAIDA, TRANSFERENCIA)
  - [ ] Status (PENDENTE, CONFIRMADA, CANCELADA, REALIZADA)
  - [ ] Quantidade
  - [ ] Data prevista
  - [ ] Origem (COMPRA, VENDA, etc.)
- [ ] Métodos: `confirmar()`, `realizar()`, `cancelar()`
- [ ] Atualizar estoque.quantidade_prevista_* automaticamente
- [ ] Criar migration
- [ ] Testes unitários

### **3.3 Lógica de Reservas**
- [ ] Função `criar_reserva()`:
  - [ ] Validar estoque disponível
  - [ ] Criar reserva (SOFT ou HARD)
  - [ ] Atualizar quantidade_reservada (se HARD)
- [ ] Função `confirmar_reserva()`:
  - [ ] Converter SOFT → HARD se necessário
  - [ ] Baixar estoque
- [ ] Função `cancelar_reserva()`:
  - [ ] Liberar estoque reservado
- [ ] Testes unitários

### **3.4 Tarefas Celery - Expiração de Reservas**
- [ ] Criar `estoque/tasks.py`
- [ ] Tarefa `expirar_soft_reservations()`:
  - [ ] Buscar reservas SOFT expiradas
  - [ ] Chamar `reserva.expirar()` para cada uma
- [ ] Configurar no Celery Beat (a cada 5 minutos)
- [ ] Testes unitários

**Entregável Fase 3**: Sistema de reservas funcionando, previsões implementadas

---

## 🔀 FASE 4: Transferências e Location Groups

### **4.1 Lógica de Transferência**
- [ ] Função `processar_transferencia()`:
  - [ ] Validar locations origem e destino
  - [ ] Validar estoque disponível na origem
  - [ ] Criar 2 movimentações:
    - [ ] Saída na origem (tipo=SAIDA, origem=TRANSFERENCIA)
    - [ ] Entrada no destino (tipo=ENTRADA, origem=TRANSFERENCIA)
  - [ ] Atualizar estoques
  - [ ] Rastrear transferência
- [ ] Validações (mesmo tenant, mesma empresa, etc.)
- [ ] Testes unitários

### **4.2 Modelo GrupoFilial (Location Groups)**
- [ ] Criar modelo `GrupoFilial` com:
  - [ ] Nome
  - [ ] Empresa
  - [ ] Filiais (ManyToMany)
  - [ ] Regra de alocação
  - [ ] Permite fulfillment cruzado
- [ ] Método `determinar_melhor_filial()`
- [ ] Método `get_estoque_consolidado()`
- [ ] Criar migration
- [ ] Registrar no Admin
- [ ] Testes unitários

### **4.3 Aprovação de Transferências (Opcional)**
- [ ] Campo `requer_aprovacao` no modelo
- [ ] Status de aprovação
- [ ] Workflow de aprovação
- [ ] Notificações

**Entregável Fase 4**: Transferências funcionando, location groups implementados

---

## 🔌 FASE 5: API REST

### **5.1 Serializers**
- [ ] `LocationSerializer`
- [ ] `EstoqueSerializer`
- [ ] `MovimentacaoEstoqueSerializer`
- [ ] `ReservaEstoqueSerializer`
- [ ] `PrevisaoMovimentacaoSerializer`
- [ ] `GrupoFilialSerializer`

### **5.2 ViewSets**
- [ ] `LocationViewSet` (CRUD completo)
- [ ] `EstoqueViewSet` (list, retrieve, update parcial)
- [ ] `MovimentacaoEstoqueViewSet` (list, create, retrieve)
- [ ] `ReservaEstoqueViewSet` (CRUD + ações: confirmar, cancelar)
- [ ] `PrevisaoMovimentacaoViewSet` (CRUD)
- [ ] `GrupoFilialViewSet` (CRUD)

### **5.3 Endpoints Especiais**
- [ ] `GET /api/estoque/consolidado/` - Estoque consolidado por empresa/grupo
- [ ] `POST /api/estoque/entrada/` - Processar entrada
- [ ] `POST /api/estoque/saida/` - Processar saída
- [ ] `POST /api/estoque/transferencia/` - Processar transferência
- [ ] `POST /api/estoque/reserva/` - Criar reserva
- [ ] `POST /api/estoque/reserva/{id}/confirmar/` - Confirmar reserva
- [ ] `POST /api/estoque/reserva/{id}/cancelar/` - Cancelar reserva

### **5.4 Filtros e Permissões**
- [ ] Filtrar por empresa/filial do usuário
- [ ] Filtrar por location
- [ ] Filtrar por produto
- [ ] Permissões baseadas em roles
- [ ] Validações de quota

### **5.5 URLs**
- [ ] Configurar URLs do app estoque
- [ ] Incluir no router principal
- [ ] Documentação básica

**Entregável Fase 5**: API REST completa e funcional

---

## 🧮 FASE 6: Processamento Assíncrono (Celery)

### **6.1 Tarefas Periódicas**
- [ ] `expirar_soft_reservations` (5 min)
- [ ] `reconciliar_estoque_disponivel` (30 min)
- [ ] `atualizar_custo_medio_produtos` (1 hora)
- [ ] `atualizar_estoque_consolidado_grupos` (15 min)
- [ ] `verificar_estoque_minimo` (diário)
- [ ] `calcular_indicadores_estoque` (semanal)

### **6.2 Tarefas Assíncronas**
- [ ] `processar_entrada_estoque_async` (chamada após compra)
- [ ] `processar_saida_estoque_async` (chamada após venda)

### **6.3 Configuração Celery Beat**
- [ ] Adicionar tarefas ao `CELERY_BEAT_SCHEDULE`
- [ ] Testar execução periódica
- [ ] Monitoramento e logs

**Entregável Fase 6**: Tarefas assíncronas funcionando

---

## 🔄 FASE 7: Tratamento de Cancelamento/Retorno de NF

### **7.1 Modelo ConfiguracaoEstoque**
- [ ] Criar modelo com configurações por empresa:
  - [ ] Comportamento em cancelamento NF entrada
  - [ ] Comportamento em cancelamento NF saída
  - [ ] Tratamento de custo em devolução
- [ ] Criar migration
- [ ] Registrar no Admin

### **7.2 Lógica de Cancelamento**
- [ ] Função `cancelar_nf_entrada()`:
  - [ ] Buscar movimentações da NF
  - [ ] Decidir se devolve estoque (configuração ou manual)
  - [ ] Reverter movimentações se necessário
- [ ] Função `cancelar_nf_saida()`:
  - [ ] Buscar movimentações da NF
  - [ ] Decidir se retorna estoque
  - [ ] Reverter movimentações se necessário
- [ ] Interface para decisão manual
- [ ] Testes unitários

### **7.3 Reversão de Movimentações**
- [ ] Melhorar método `reverter()` do modelo
- [ ] Tratamento de custo médio em reversões
- [ ] Auditoria completa
- [ ] Testes unitários

**Entregável Fase 7**: Sistema de cancelamento/retorno funcionando

---

## 🛒 FASE 8: Integração com Vendas

### **8.1 Integração com Módulo de Vendas**
- [ ] Identificar módulo de vendas/pedidos
- [ ] Criar signals ou serviços de integração
- [ ] Reserva automática ao criar pedido
- [ ] Baixa automática ao confirmar venda
- [ ] Liberação de reserva ao cancelar pedido

### **8.2 Validações de Estoque em Vendas**
- [ ] Verificar disponibilidade antes de criar pedido
- [ ] Sugerir locations alternativas se necessário
- [ ] Alertas de estoque insuficiente

**Entregável Fase 8**: Integração com vendas funcionando

---

## 📊 FASE 9: Relatórios e Indicadores

### **9.1 Relatórios Básicos**
- [ ] Relatório de estoque por location
- [ ] Relatório de estoque consolidado (empresa/grupo)
- [ ] Relatório de movimentações
- [ ] Relatório de reservas

### **9.2 Indicadores**
- [ ] Rotatividade de estoque
- [ ] Giro de estoque
- [ ] Dias de estoque
- [ ] Produtos parados
- [ ] Produtos com estoque mínimo

### **9.3 Alertas**
- [ ] Estoque mínimo atingido
- [ ] Produtos parados
- [ ] Necessidade de reposição
- [ ] Notificações por email

**Entregável Fase 9**: Relatórios e indicadores funcionando

---

## 🎨 FASE 10: Frontend (Interface)

### **10.1 Páginas Básicas**
- [ ] Listagem de Locations
- [ ] Cadastro/Edição de Location
- [ ] Listagem de Estoque
- [ ] Detalhes de Estoque
- [ ] Listagem de Movimentações
- [ ] Formulário de Entrada de Estoque
- [ ] Formulário de Saída de Estoque
- [ ] Formulário de Transferência

### **10.2 Funcionalidades Avançadas**
- [ ] Dashboard de estoque
- [ ] Gráficos e visualizações
- [ ] Filtros avançados
- [ ] Exportação de relatórios

**Entregável Fase 10**: Interface completa e funcional

---

## 📝 Resumo das Fases

| Fase | Descrição | Prioridade | Complexidade |
|------|-----------|------------|--------------|
| **1** | Fundação - Modelos | 🔴 Crítica | Média |
| **2** | Lógica Core | 🔴 Crítica | Alta |
| **3** | Reservas | 🟡 Importante | Média |
| **4** | Transferências | 🟡 Importante | Média |
| **5** | API REST | 🔴 Crítica | Média |
| **6** | Celery | 🟡 Importante | Baixa |
| **7** | Cancelamento NF | 🟢 Desejável | Média |
| **8** | Integração Vendas | 🔴 Crítica | Alta |
| **9** | Relatórios | 🟢 Desejável | Baixa |
| **10** | Frontend | 🔴 Crítica | Alta |

**Ordem Recomendada de Execução:**
1. Fase 1 → Fase 2 → Fase 5 (MVP básico)
2. Fase 3 → Fase 4 (Funcionalidades avançadas)
3. Fase 6 → Fase 8 (Integrações)
4. Fase 7 → Fase 9 → Fase 10 (Completar sistema)

---

## 🎯 Conclusão e Recomendação Final

### **Recomendação: INTEGRADO (com possibilidade de evolução)**

**Por quê?**

1. **Simplicidade**: Começar integrado é mais simples e rápido
2. **Performance**: Transações ACID garantidas, sem latência de rede
3. **Custo**: Menor custo de infraestrutura e manutenção
4. **Evolução**: Se necessário, pode extrair para API depois
5. **Adequado ao tamanho**: Para a maioria dos casos, integrado é suficiente

### **Quando considerar projeto separado?**

- ✅ Volume muito alto (>1000 transações/minuto)
- ✅ Múltiplos sistemas externos consumindo
- ✅ Necessidade de alta disponibilidade independente
- ✅ Equipe grande para manter separado
- ✅ Tecnologia diferente necessária

### **Próximos Passos**

1. Validar requisitos com stakeholders
2. Definir se precisa de estoque omnichannel desde o início
3. Começar com modelo integrado simples
4. Evoluir conforme necessidade

---

**Última atualização**: {{ data_atual }}

