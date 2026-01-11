# 🏗️ Arquitetura: Módulo Financeiro e Faturamento

## 📋 Decisão Arquitetural

### **Recomendação: Módulos Separados mas Integrados**

```
┌─────────────────────────────────────────────────────────────┐
│                    MÓDULO FATURAMENTO                        │
│  (Emissão de Documentos Fiscais)                            │
│                                                              │
│  - NF-e (Nota Fiscal Eletrônica)                           │
│  - NFSe (Nota Fiscal de Serviços)                           │
│  - CT-e (Conhecimento de Transporte)                       │
│  - MDF-e (Manifesto de Documentos Fiscais)                 │
│  - NFC-e (Nota Fiscal Consumidor Eletrônica)               │
└─────────────────────────────────────────────────────────────┘
                        ↓ integra com ↓
┌─────────────────────────────────────────────────────────────┐
│                  MÓDULO FINANCEIRO                           │
│  (Gestão de Contas e Pagamentos)                            │
│                                                              │
│  - Contas a Receber                                         │
│  - Contas a Pagar                                           │
│  - Boletos                                                  │
│  - Transações de Pagamento                                  │
│  - Fluxo de Caixa                                           │
│  - Conciliação Bancária                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓ integra com ↓
┌─────────────────────────────────────────────────────────────┐
│                    MÓDULO VENDAS                             │
│  (Orquestração do Fluxo Completo)                          │
│                                                              │
│  - Pedidos de Venda                                         │
│  - Orçamentos                                               │
│  - Cotações                                                 │
│  - Integração: Faturamento + Financeiro + Estoque          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Justificativa: Por que Separar?

### **1. Separação de Responsabilidades (SoC)**

**Faturamento:**
- Responsabilidade: Emissão de documentos fiscais
- Foco: Compliance fiscal, SEFAZ, XMLs, PDFs
- Independência: Pode funcionar sem financeiro (emissão de NF sem pagamento)

**Financeiro:**
- Responsabilidade: Gestão de contas e pagamentos
- Foco: Fluxo de caixa, conciliação, boletos, gateways
- Independência: Pode funcionar sem faturamento (contas manuais)

### **2. Manutenção e Evolução**

- ✅ Mudanças na legislação fiscal → Apenas módulo Faturamento
- ✅ Mudanças em gateways → Apenas módulo Financeiro
- ✅ Facilita testes unitários
- ✅ Facilita deploy independente

### **3. Reutilização**

- ✅ Faturamento pode ser usado por outros módulos (compras, serviços)
- ✅ Financeiro pode receber de outras fontes (não só vendas)

---

## 📦 Estrutura de Apps Django

### **Opção 1: Apps Separados (RECOMENDADO)** ⭐

```
siscr/
├── faturamento/          # App de Faturamento
│   ├── models.py
│   │   ├── NotaFiscalEletronica
│   │   ├── NotaFiscalServico
│   │   ├── ConhecimentoTransporte
│   │   └── ...
│   ├── services/
│   │   ├── nfe_service.py
│   │   ├── nfse_service.py
│   │   └── ...
│   └── api/
│
├── financeiro/           # App Financeiro
│   ├── models.py
│   │   ├── ContaReceber (já existe em cadastros, mover?)
│   │   ├── ContaPagar (já existe em cadastros, mover?)
│   │   ├── Boleto
│   │   ├── TransacaoPagamento
│   │   ├── FluxoCaixa
│   │   └── ConciliacaoBancaria
│   ├── services/
│   │   ├── boleto_service.py
│   │   ├── payment_gateway.py
│   │   └── ...
│   └── api/
│
└── vendas/               # App de Vendas (Novo)
    ├── models.py
    │   ├── PedidoVenda
    │   ├── ItemPedido
    │   ├── Orcamento
    │   └── Cotacao
    ├── services/
    │   └── venda_service.py  # Orquestra tudo
    └── api/
```

### **Opção 2: App Único (NÃO RECOMENDADO)**

```
siscr/
└── faturamento_financeiro/  # Tudo junto
    ├── models.py
    │   ├── NotaFiscal...
    │   ├── ContaReceber...
    │   ├── Boleto...
    │   └── ...
    └── ...
```

**Problemas:**
- ❌ App muito grande e complexo
- ❌ Dificulta manutenção
- ❌ Mistura responsabilidades

---

## 🔄 Integração entre Módulos

### **Fluxo de Venda Completo:**

```python
# vendas/services/venda_service.py

class VendaService:
    """
    Orquestra o fluxo completo de venda:
    - Cria pedido
    - Reserva estoque
    - Emite NF-e (faturamento)
    - Baixa estoque
    - Cria Conta a Receber (financeiro)
    - Processa pagamento (financeiro)
    """
    
    @transaction.atomic
    def processar_venda(self, dados_venda):
        # 1. Criar Pedido
        pedido = PedidoVenda.objects.create(...)
        
        # 2. Reservar Estoque
        from estoque.services import criar_reserva
        criar_reserva(...)
        
        # 3. Emitir NF-e (FATURAMENTO)
        from faturamento.services import NFEService
        nfe_service = NFEService(...)
        nfe = nfe_service.emitir(pedido)
        
        # 4. Baixar Estoque
        from estoque.services import processar_saida_estoque
        processar_saida_estoque(...)
        
        # 5. Criar Conta a Receber (FINANCEIRO)
        from financeiro.services import FinanceiroService
        financeiro_service = FinanceiroService()
        conta_receber = financeiro_service.criar_conta_receber(
            origem='VENDA',
            referencia=nfe,
            valor=nfe.valor_total,
            cliente=pedido.cliente
        )
        
        # 6. Processar Pagamento (FINANCEIRO)
        if dados_venda['forma_pagamento'] == 'PIX':
            transacao = financeiro_service.processar_pagamento(
                conta_receber=conta_receber,
                metodo='PIX',
                gateway='mercadopago'
            )
        elif dados_venda['forma_pagamento'] == 'BOLETO':
            boleto = financeiro_service.gerar_boleto(conta_receber)
        
        return {
            'pedido': pedido,
            'nfe': nfe,
            'conta_receber': conta_receber,
            'transacao': transacao if 'transacao' in locals() else None
        }
```

---

## 📊 Modelos e Relacionamentos

### **Diagrama de Relacionamentos:**

```
┌─────────────────┐
│  PedidoVenda    │
│  (vendas)       │
└────────┬─────────┘
         │
         │ 1:N
         ↓
┌─────────────────┐
│  ItemPedido     │
│  (vendas)       │
└────────┬─────────┘
         │
         │ referencia
         ↓
┌─────────────────┐      ┌─────────────────┐
│  NotaFiscal     │      │  Movimentacao    │
│  Eletronica     │      │  Estoque         │
│  (faturamento)  │      │  (estoque)       │
└────────┬─────────┘      └─────────────────┘
         │
         │ 1:1
         ↓
┌─────────────────┐
│  ContaReceber   │
│  (financeiro)   │
└────────┬─────────┘
         │
         │ 1:N
         ↓
┌─────────────────┐      ┌─────────────────┐
│  Boleto         │      │  Transacao       │
│  (financeiro)   │      │  Pagamento       │
│                 │      │  (financeiro)    │
└─────────────────┘      └─────────────────┘
```

### **Modelos Detalhados:**

#### **1. Faturamento (App `faturamento`)**

```python
# faturamento/models.py

class NotaFiscalEletronica(SiscrModelBase):
    """NF-e (Nota Fiscal Eletrônica)"""
    numero = models.IntegerField()
    serie = models.CharField(max_length=3)
    chave_acesso = models.CharField(max_length=44, unique=True)
    
    # Relacionamentos
    empresa = models.ForeignKey('tenants.Empresa', ...)
    filial = models.ForeignKey('tenants.Filial', ...)
    cliente = models.ForeignKey('cadastros.Pessoa', ...)
    
    # Origem (pode vir de venda, compra, etc.)
    pedido_venda = models.ForeignKey('vendas.PedidoVenda', null=True, ...)
    
    # Status SEFAZ
    status_sefaz = models.CharField(...)  # AUTORIZADA, CANCELADA, etc.
    
    # XML e PDF
    xml_assinado = models.TextField()
    pdf_path = models.FileField(...)
    
    # Valores
    valor_total = models.DecimalField(...)
    
    class Meta:
        app_label = 'faturamento'


class NotaFiscalServico(SiscrModelBase):
    """NFSe (Nota Fiscal de Serviços)"""
    # Similar à NF-e, mas para serviços
    pass


class ItemNotaFiscal(SiscrModelBase):
    """Itens da NF-e"""
    nota_fiscal = models.ForeignKey(NotaFiscalEletronica, ...)
    produto = models.ForeignKey('cadastros.Produto', ...)
    quantidade = models.DecimalField(...)
    valor_unitario = models.DecimalField(...)
    valor_total = models.DecimalField(...)
    
    class Meta:
        app_label = 'faturamento'
```

#### **2. Financeiro (App `financeiro`)**

```python
# financeiro/models.py

class ContaReceber(SiscrModelBase):
    """Conta a Receber (mover de cadastros para financeiro?)"""
    # Campos existentes...
    
    # Origem (pode vir de venda, serviço, etc.)
    nota_fiscal = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        null=True,
        related_name='contas_receber'
    )
    pedido_venda = models.ForeignKey(
        'vendas.PedidoVenda',
        null=True,
        related_name='contas_receber'
    )
    
    # Valores
    valor_total = models.DecimalField(...)
    valor_recebido = models.DecimalField(...)
    valor_pendente = models.DecimalField(...)
    
    # Status
    status = models.CharField(...)  # Pendente, Pago, etc.
    
    class Meta:
        app_label = 'financeiro'


class ContaPagar(SiscrModelBase):
    """Conta a Pagar (mover de cadastros para financeiro?)"""
    # Campos existentes...
    
    # Origem (pode vir de compra, serviço, etc.)
    nota_fiscal_entrada = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        null=True,
        related_name='contas_pagar'
    )
    
    class Meta:
        app_label = 'financeiro'


class Boleto(SiscrModelBase):
    """Boleto Bancário"""
    conta_receber = models.ForeignKey(
        ContaReceber,
        related_name='boletos'
    )
    
    # Dados do boleto
    nosso_numero = models.CharField(...)
    codigo_barras = models.CharField(...)
    linha_digitavel = models.CharField(...)
    
    # Integração
    gateway = models.CharField(...)  # 'gerencianet', 'pagseguro'
    gateway_id = models.CharField(...)
    
    # Status
    status = models.CharField(...)  # GERADO, REGISTRADO, PAGO, CANCELADO
    
    # Arquivos
    pdf_path = models.FileField(...)
    
    class Meta:
        app_label = 'financeiro'


class TransacaoPagamento(SiscrModelBase):
    """Transação de Pagamento (PIX, Cartão, etc.)"""
    conta_receber = models.ForeignKey(
        ContaReceber,
        related_name='transacoes'
    )
    
    # Gateway
    gateway = models.CharField(...)  # 'mercadopago', 'pagseguro', 'stripe'
    gateway_transaction_id = models.CharField(...)
    
    # Método
    metodo_pagamento = models.CharField(...)  # 'pix', 'cartao_credito', etc.
    
    # Valores
    valor = models.DecimalField(...)
    valor_liquido = models.DecimalField(...)  # Após taxas
    taxa_gateway = models.DecimalField(...)
    
    # Status
    status = models.CharField(...)  # PENDENTE, APROVADO, RECUSADO
    
    class Meta:
        app_label = 'financeiro'
```

#### **3. Vendas (App `vendas`)**

```python
# vendas/models.py

class PedidoVenda(SiscrModelBase):
    """Pedido de Venda"""
    numero_pedido = models.CharField(...)
    cliente = models.ForeignKey('cadastros.Pessoa', ...)
    empresa = models.ForeignKey('tenants.Empresa', ...)
    filial = models.ForeignKey('tenants.Filial', ...)
    
    # Status
    status = models.CharField(...)  # RASCUNHO, PENDENTE, FATURADO, CANCELADO
    
    # Relacionamentos
    nota_fiscal = models.ForeignKey(
        'faturamento.NotaFiscalEletronica',
        null=True,
        related_name='pedidos'
    )
    
    # Valores
    valor_total = models.DecimalField(...)
    
    class Meta:
        app_label = 'vendas'


class ItemPedido(SiscrModelBase):
    """Item do Pedido de Venda"""
    pedido = models.ForeignKey(PedidoVenda, related_name='itens')
    produto = models.ForeignKey('cadastros.Produto', ...)
    quantidade = models.DecimalField(...)
    valor_unitario = models.DecimalField(...)
    valor_total = models.DecimalField(...)
    
    # Estoque
    location = models.ForeignKey('estoque.Location', ...)
    movimentacao_estoque = models.ForeignKey(
        'estoque.MovimentacaoEstoque',
        null=True
    )
    
    class Meta:
        app_label = 'vendas'
```

---

## 🔧 Serviços e Integrações

### **1. Serviço de Venda (Orquestrador)**

```python
# vendas/services/venda_service.py

class VendaService:
    """
    Orquestra o fluxo completo de venda
    Integra: Estoque + Faturamento + Financeiro
    """
    
    def __init__(self):
        self.nfe_service = NFEService()
        self.financeiro_service = FinanceiroService()
        self.estoque_service = EstoqueService()
    
    @transaction.atomic
    def processar_venda_completa(self, dados):
        # 1. Criar Pedido
        pedido = self._criar_pedido(dados)
        
        # 2. Reservar Estoque
        self._reservar_estoque(pedido)
        
        # 3. Emitir NF-e
        nfe = self.nfe_service.emitir(pedido)
        
        # 4. Baixar Estoque
        self._baixar_estoque(pedido, nfe)
        
        # 5. Criar Conta a Receber
        conta_receber = self.financeiro_service.criar_conta_receber(
            origem='VENDA',
            referencia=nfe,
            valor=nfe.valor_total,
            cliente=pedido.cliente
        )
        
        # 6. Processar Pagamento
        if dados['forma_pagamento'] == 'PIX':
            transacao = self.financeiro_service.processar_pix(conta_receber)
        elif dados['forma_pagamento'] == 'BOLETO':
            boleto = self.financeiro_service.gerar_boleto(conta_receber)
        elif dados['forma_pagamento'] == 'CARTAO':
            transacao = self.financeiro_service.processar_cartao(conta_receber)
        
        return {
            'pedido': pedido,
            'nfe': nfe,
            'conta_receber': conta_receber
        }
```

### **2. Serviço Financeiro**

```python
# financeiro/services/financeiro_service.py

class FinanceiroService:
    """
    Gerencia contas e pagamentos
    """
    
    def criar_conta_receber(self, origem, referencia, valor, cliente):
        """Cria Conta a Receber a partir de uma origem"""
        return ContaReceber.objects.create(
            cliente=cliente,
            valor_total=valor,
            nota_fiscal=referencia if origem == 'VENDA' else None,
            # ...
        )
    
    def gerar_boleto(self, conta_receber):
        """Gera boleto a partir de Conta a Receber"""
        boleto_service = BoletoService()
        return boleto_service.gerar(conta_receber)
    
    def processar_pix(self, conta_receber):
        """Processa pagamento PIX"""
        gateway = PaymentGatewayFactory.create('mercadopago')
        return gateway.criar_transacao_pix(conta_receber)
```

---

## 📋 Decisão: Mover Contas a Receber/Pagar?

### **Situação Atual:**
- `ContaReceber` e `ContaPagar` estão em `cadastros/models.py`

### **Opção 1: Mover para `financeiro`** ⭐ RECOMENDADO

**Vantagens:**
- ✅ Organização lógica (financeiro fica junto)
- ✅ Facilita manutenção
- ✅ Separação clara de responsabilidades

**Desvantagens:**
- ⚠️ Requer migração de dados
- ⚠️ Atualizar imports em todo código

**Como fazer:**
```python
# 1. Criar app financeiro
python manage.py startapp financeiro

# 2. Mover modelos
# - Copiar ContaReceber e ContaPagar para financeiro/models.py
# - Atualizar app_label

# 3. Criar migração
python manage.py makemigrations financeiro

# 4. Migrar dados (se necessário)
# - Criar script de migração de dados
```

### **Opção 2: Manter em `cadastros`**

**Vantagens:**
- ✅ Não precisa migrar
- ✅ Menos trabalho inicial

**Desvantagens:**
- ❌ Organização menos lógica
- ❌ Mistura responsabilidades

---

## 🎯 Estrutura Final Recomendada

```
siscr/
├── cadastros/          # Cadastros básicos
│   ├── Pessoa
│   ├── Produto
│   └── Servico
│
├── estoque/            # Gestão de estoque
│   ├── Location
│   ├── Estoque
│   └── MovimentacaoEstoque
│
├── faturamento/        # ⭐ NOVO - Emissão de documentos fiscais
│   ├── NotaFiscalEletronica
│   ├── NotaFiscalServico
│   └── ItemNotaFiscal
│
├── financeiro/         # ⭐ NOVO - Gestão financeira
│   ├── ContaReceber (movido de cadastros)
│   ├── ContaPagar (movido de cadastros)
│   ├── Boleto
│   ├── TransacaoPagamento
│   └── FluxoCaixa
│
└── vendas/             # ⭐ NOVO - Orquestração de vendas
    ├── PedidoVenda
    ├── ItemPedido
    └── Orcamento
```

---

## 📊 Fluxo de Dados

```
┌──────────────┐
│  PedidoVenda │
│  (vendas)    │
└──────┬───────┘
       │
       │ cria
       ↓
┌──────────────┐      ┌──────────────┐
│  NotaFiscal  │      │  Movimentacao│
│  (faturamento)│      │  Estoque     │
└──────┬───────┘      │  (estoque)   │
       │              └──────────────┘
       │ cria
       ↓
┌──────────────┐
│ ContaReceber │
│ (financeiro) │
└──────┬───────┘
       │
       │ gera
       ↓
┌──────────────┐      ┌──────────────┐
│   Boleto     │      │ Transacao    │
│ (financeiro) │      │ Pagamento    │
└──────────────┘      │ (financeiro) │
                      └──────────────┘
```

---

## ✅ Checklist de Implementação

### **Fase 1: Estrutura Base**
- [ ] Criar app `faturamento`
- [ ] Criar app `financeiro`
- [ ] Criar app `vendas`
- [ ] Mover `ContaReceber` e `ContaPagar` para `financeiro`
- [ ] Criar modelos base de cada app

### **Fase 2: Faturamento**
- [ ] Implementar `NFEService`
- [ ] Integrar com biblioteca fiscal (nfelib/PyTrustNFe)
- [ ] Criar endpoints API para emissão
- [ ] Implementar geração de PDF

### **Fase 3: Financeiro**
- [ ] Implementar `BoletoService`
- [ ] Integrar Gerencianet
- [ ] Implementar `PaymentGateway` (Mercado Pago)
- [ ] Criar endpoints API
- [ ] Implementar webhooks

### **Fase 4: Vendas**
- [ ] Implementar `VendaService`
- [ ] Integrar com estoque
- [ ] Integrar com faturamento
- [ ] Integrar com financeiro
- [ ] Criar endpoints API

### **Fase 5: Frontend**
- [ ] Página de Pedidos de Venda
- [ ] Integrar com APIs
- [ ] Fluxo completo de venda

---

## 🎯 Conclusão

### **Arquitetura Recomendada:**

1. **3 Apps Separados:**
   - `faturamento` - Documentos fiscais
   - `financeiro` - Contas e pagamentos
   - `vendas` - Orquestração

2. **Integração via Serviços:**
   - Cada app tem seus serviços
   - `VendaService` orquestra tudo

3. **Benefícios:**
   - ✅ Separação de responsabilidades
   - ✅ Facilita manutenção
   - ✅ Permite evolução independente
   - ✅ Facilita testes

---

**Status**: ✅ Arquitetura Definida

