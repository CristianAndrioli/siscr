# 💰 Análise: Módulo Financeiro - Lacunas e Proposta de Implementação

## 📊 Estado Atual

### ✅ O que JÁ EXISTE

1. **Contas a Receber/Pagar (Básico)**
   - Modelos Django com campos básicos
   - Status: Pendente, Parcial, Pago, Cancelado, Vencido
   - Formas de pagamento: Dinheiro, PIX, Boleto, Cartão, Transferência, Cheque
   - ⚠️ **LIMITAÇÃO**: Apenas campos de texto, sem integração real

2. **Integração Stripe**
   - ✅ Funciona apenas para **assinaturas SaaS** (pagamento do próprio sistema)
   - ❌ **NÃO funciona para recebimentos de clientes** (vendas)

3. **Frontend de Faturamento**
   - Páginas React: `NFVenda.tsx` e `NFSe.tsx`
   - ⚠️ **LIMITAÇÃO**: Apenas mockup/placeholder, sem backend

4. **Movimentações de Estoque**
   - Campo `numero_nota_fiscal` e `serie_nota_fiscal` em movimentações
   - ⚠️ **LIMITAÇÃO**: Apenas referência, sem emissão real

---

## ❌ O que ESTÁ FALTANDO

### 1. **Emissão de Notas Fiscais Eletrônicas (NF-e)**

**Problema:**
- Não há integração com SEFAZ
- Não há emissão real de NF-e
- Frontend existe mas é apenas mockup
- Não há backend para emissão

**O que precisa:**
- ✅ Integração com biblioteca fiscal (nfelib, PyTrustNFe)
- ✅ Modelo Django para NF-e
- ✅ Serviço de emissão
- ✅ Integração com certificado digital A1/A3
- ✅ Comunicação com webservices SEFAZ
- ✅ Geração de XML e PDF
- ✅ Cancelamento e inutilização
- ✅ Consulta de status

**Bibliotecas Recomendadas:**
- `nfelib` - Geração e validação de XMLs
- `PyTrustNFe` - Comunicação com webservices
- `signxml` - Assinatura digital

---

### 2. **Emissão de Boletos Bancários**

**Problema:**
- Campo "Boleto" existe em `ContaReceber`, mas é apenas texto
- Não há emissão real de boletos
- Não há integração com bancos

**O que precisa:**
- ✅ Integração com serviços de boleto:
  - **Gerencianet** (mais popular no Brasil)
  - **Banco do Brasil API**
  - **Bradesco API**
  - **Itaú API**
  - **PagSeguro** (também emite boletos)
- ✅ Modelo Django para Boletos
- ✅ Geração de código de barras
- ✅ Geração de PDF do boleto
- ✅ Registro no banco
- ✅ Consulta de pagamento
- ✅ Baixa automática via webhook

**Bibliotecas Recomendadas:**
- `gerencianet-sdk-python` - Para Gerencianet
- `barcode` - Geração de código de barras
- `reportlab` ou `WeasyPrint` - Geração de PDF

---

### 3. **Integração com Gateways de Pagamento para Recebimentos**

**Problema:**
- Stripe existe mas é apenas para assinaturas SaaS
- Não há integração para recebimentos de clientes (vendas)
- Não há suporte para maquininhas físicas

**O que precisa:**

#### 3.1. **Gateways Online (E-commerce/Vendas)**

**Opções Recomendadas:**

1. **Mercado Pago** ⭐ **RECOMENDADO para Brasil**
   - ✅ PIX nativo
   - ✅ Boleto excelente
   - ✅ Cartão de crédito/débito
   - ✅ Link de pagamento
   - ✅ Suporte local em português
   - ✅ Taxas competitivas

2. **PagSeguro**
   - ✅ PIX
   - ✅ Boleto
   - ✅ Cartão
   - ✅ Boa aceitação no Brasil

3. **Stripe** (já integrado, mas expandir)
   - ✅ PIX disponível
   - ✅ Boleto disponível
   - ✅ Cartão
   - ⚠️ Menor penetração no Brasil

4. **Asaas**
   - ✅ Focado em B2B
   - ✅ PIX e boleto
   - ✅ Boa para recebimentos recorrentes

#### 3.2. **Maquininhas Físicas (PDV/Presencial)**

**Opções:**

1. **Stone**
   - ✅ API para integração
   - ✅ Maquininhas físicas
   - ✅ App Stone para PDV

2. **PagSeguro**
   - ✅ Maquininhas físicas
   - ✅ API disponível

3. **Cielo**
   - ✅ Maquininhas físicas
   - ✅ API Cielo E-commerce

4. **Rede (GetNet)**
   - ✅ Maquininhas físicas
   - ✅ API disponível

**O que precisa:**
- ✅ Modelo Django para Transações de Pagamento
- ✅ Serviço abstrato de gateway (interface comum)
- ✅ Implementações específicas (Mercado Pago, PagSeguro, etc.)
- ✅ Webhooks para confirmação de pagamento
- ✅ Integração com ContaReceber (atualizar status automaticamente)
- ✅ Dashboard de transações
- ✅ Relatórios de recebimentos

---

### 4. **Integração com Estoque (Vendas)**

**Problema:**
- Movimentações de estoque têm referência a NF, mas não há fluxo completo
- Não há venda que integre: NF-e + Estoque + Pagamento + ContaReceber

**O que precisa:**
- ✅ Modelo `Venda` ou `PedidoVenda`
- ✅ Itens de venda (produtos, quantidades, valores)
- ✅ Fluxo completo:
  1. Criar pedido de venda
  2. Reservar estoque (soft reservation)
  3. Emitir NF-e
  4. Processar pagamento (gateway ou boleto)
  5. Confirmar venda → baixar estoque (hard reservation)
  6. Criar ContaReceber (se pagamento parcelado)
  7. Atualizar status automaticamente

---

## 🎯 Proposta de Implementação

### **Fase 1: Estrutura Base (2-3 semanas)**

#### 1.1. Criar App `faturamento`
```bash
python manage.py startapp faturamento
```

#### 1.2. Modelos Django

**NotaFiscalEletronica (NF-e)**
```python
class NotaFiscalEletronica(SiscrModelBase):
    numero = models.IntegerField()
    serie = models.CharField(max_length=3)
    chave_acesso = models.CharField(max_length=44, unique=True)
    cliente = models.ForeignKey(Pessoa, ...)
    empresa = models.ForeignKey(Empresa, ...)
    filial = models.ForeignKey(Filial, ...)
    
    # Status SEFAZ
    status_sefaz = models.CharField(...)  # AUTORIZADA, CANCELADA, etc.
    protocolo_autorizacao = models.CharField(...)
    
    # XML e PDF
    xml_assinado = models.TextField()  # XML completo
    xml_retorno = models.TextField()  # Retorno da SEFAZ
    pdf_path = models.FileField(...)
    
    # Datas
    data_emissao = models.DateTimeField()
    data_autorizacao = models.DateTimeField(null=True)
    
    # Valores
    valor_total = models.DecimalField(...)
    valor_produtos = models.DecimalField(...)
    valor_impostos = models.DecimalField(...)
```

**Boleto**
```python
class Boleto(SiscrModelBase):
    conta_receber = models.ForeignKey(ContaReceber, ...)
    
    # Dados do boleto
    nosso_numero = models.CharField(...)
    codigo_barras = models.CharField(...)
    linha_digitavel = models.CharField(...)
    
    # Integração
    gateway_id = models.CharField(...)  # ID no gateway (Gerencianet, etc.)
    gateway = models.CharField(...)  # 'gerencianet', 'pagseguro', etc.
    
    # Status
    status = models.CharField(...)  # GERADO, REGISTRADO, PAGO, CANCELADO
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True)
    
    # Arquivos
    pdf_path = models.FileField(...)
```

**TransacaoPagamento**
```python
class TransacaoPagamento(SiscrModelBase):
    conta_receber = models.ForeignKey(ContaReceber, ...)
    venda = models.ForeignKey('Venda', null=True, ...)
    
    # Gateway
    gateway = models.CharField(...)  # 'mercadopago', 'pagseguro', 'stripe', etc.
    gateway_transaction_id = models.CharField(...)
    
    # Valores
    valor = models.DecimalField(...)
    valor_liquido = models.DecimalField(...)  # Após taxas
    taxa_gateway = models.DecimalField(...)
    
    # Status
    status = models.CharField(...)  # PENDENTE, PROCESSANDO, APROVADO, RECUSADO, ESTORNADO
    
    # Método
    metodo_pagamento = models.CharField(...)  # 'pix', 'cartao_credito', 'cartao_debito', 'boleto'
    
    # Dados adicionais
    dados_gateway = models.JSONField(...)  # Dados completos do gateway
```

**Venda**
```python
class Venda(SiscrModelBase):
    numero_pedido = models.CharField(...)
    cliente = models.ForeignKey(Pessoa, ...)
    empresa = models.ForeignKey(Empresa, ...)
    filial = models.ForeignKey(Filial, ...)
    
    # Status
    status = models.CharField(...)  # RASCUNHO, PENDENTE_PAGAMENTO, PAGA, CANCELADA
    
    # Valores
    valor_total = models.DecimalField(...)
    valor_desconto = models.DecimalField(...)
    valor_frete = models.DecimalField(...)
    
    # Relacionamentos
    nota_fiscal = models.ForeignKey(NotaFiscalEletronica, null=True, ...)
    transacoes_pagamento = models.ManyToManyField(TransacaoPagamento)
    
    # Datas
    data_venda = models.DateTimeField()
    data_pagamento = models.DateTimeField(null=True)
```

**ItemVenda**
```python
class ItemVenda(SiscrModelBase):
    venda = models.ForeignKey(Venda, ...)
    produto = models.ForeignKey(Produto, ...)
    
    quantidade = models.DecimalField(...)
    valor_unitario = models.DecimalField(...)
    valor_total = models.DecimalField(...)
    
    # Estoque
    location = models.ForeignKey(Location, ...)
    movimentacao_estoque = models.ForeignKey(MovimentacaoEstoque, null=True, ...)
```

---

### **Fase 2: Integração NF-e (3-4 semanas)**

#### 2.1. Instalar Dependências
```bash
pip install nfelib PyTrustNFe signxml lxml
```

#### 2.2. Serviço de Emissão NF-e
```python
# faturamento/services/nfe_service.py

class NFEService:
    def __init__(self, empresa, certificado_path, senha_certificado):
        self.empresa = empresa
        self.certificado = certificado_path
        self.senha = senha_certificado
    
    def emitir(self, venda, itens):
        """
        1. Gerar XML com nfelib
        2. Assinar XML com signxml
        3. Enviar para SEFAZ com PyTrustNFe
        4. Processar retorno
        5. Salvar no banco
        6. Gerar PDF
        """
        pass
    
    def cancelar(self, nfe, justificativa):
        """Cancelar NF-e na SEFAZ"""
        pass
    
    def consultar_status(self, nfe):
        """Consultar status na SEFAZ"""
        pass
```

#### 2.3. Tasks Celery
- Emissão assíncrona
- Retry automático
- Consulta de status

---

### **Fase 3: Integração Boletos (2-3 semanas)**

#### 3.1. Escolher Gateway de Boleto

**Recomendação: Gerencianet**
- Mais popular no Brasil
- API bem documentada
- Suporte a PIX também
- SDK Python disponível

#### 3.2. Instalar SDK
```bash
pip install gerencianet-sdk-python
```

#### 3.3. Serviço de Boleto
```python
# faturamento/services/boleto_service.py

class BoletoService:
    def __init__(self, gateway='gerencianet'):
        self.gateway = gateway
    
    def gerar(self, conta_receber):
        """
        1. Criar boleto no gateway
        2. Obter código de barras e linha digitável
        3. Gerar PDF
        4. Salvar no banco
        5. Retornar dados
        """
        pass
    
    def consultar_pagamento(self, boleto):
        """Consultar se boleto foi pago"""
        pass
    
    def cancelar(self, boleto):
        """Cancelar boleto"""
        pass
```

#### 3.4. Webhook para Baixa Automática
- Configurar webhook no gateway
- Atualizar `ContaReceber` automaticamente quando pago

---

### **Fase 4: Integração Gateways de Pagamento (3-4 semanas)**

#### 4.1. Interface Abstrata
```python
# faturamento/services/payment_gateway.py

class PaymentGatewayInterface:
    def criar_transacao(self, valor, metodo, dados_cliente):
        """Criar transação no gateway"""
        pass
    
    def consultar_transacao(self, transaction_id):
        """Consultar status da transação"""
        pass
    
    def estornar(self, transaction_id):
        """Estornar transação"""
        pass
```

#### 4.2. Implementações

**Mercado Pago**
```python
class MercadoPagoGateway(PaymentGatewayInterface):
    def criar_transacao(self, valor, metodo, dados_cliente):
        # Integração com Mercado Pago SDK
        pass
```

**PagSeguro**
```python
class PagSeguroGateway(PaymentGatewayInterface):
    def criar_transacao(self, valor, metodo, dados_cliente):
        # Integração com PagSeguro API
        pass
```

**Stripe (Expandir)**
```python
class StripeGateway(PaymentGatewayInterface):
    def criar_transacao(self, valor, metodo, dados_cliente):
        # Usar Stripe já existente, mas para recebimentos
        pass
```

#### 4.3. Webhooks
- Configurar webhooks em cada gateway
- Atualizar `TransacaoPagamento` e `ContaReceber` automaticamente

---

### **Fase 5: Fluxo Completo de Venda (2 semanas)**

#### 5.1. Serviço de Venda
```python
# faturamento/services/venda_service.py

class VendaService:
    @transaction.atomic
    def criar_venda(self, cliente, itens, forma_pagamento):
        """
        Fluxo completo:
        1. Criar Venda (status: RASCUNHO)
        2. Reservar estoque (SOFT reservation)
        3. Se pagamento à vista:
           - Processar pagamento no gateway
           - Se aprovado:
             - Confirmar venda
             - Emitir NF-e
             - Baixar estoque (HARD reservation)
             - Criar movimentação de estoque
        4. Se pagamento parcelado:
           - Emitir NF-e
           - Criar ContaReceber
           - Baixar estoque
        5. Atualizar status da venda
        """
        pass
```

---

## 📋 Estrutura de Arquivos Proposta

```
faturamento/
├── __init__.py
├── models.py
│   ├── NotaFiscalEletronica
│   ├── Boleto
│   ├── TransacaoPagamento
│   ├── Venda
│   └── ItemVenda
├── services/
│   ├── __init__.py
│   ├── nfe_service.py
│   ├── boleto_service.py
│   ├── payment_gateway.py
│   ├── mercado_pago_gateway.py
│   ├── pagseguro_gateway.py
│   ├── stripe_gateway.py
│   └── venda_service.py
├── api/
│   ├── __init__.py
│   ├── serializers.py
│   ├── viewsets.py
│   └── urls.py
├── tasks.py
│   ├── emitir_nfe_async
│   ├── consultar_status_nfe
│   ├── processar_webhook_pagamento
│   └── consultar_boletos_pagos
├── admin.py
└── migrations/
```

---

## 🔧 Dependências Necessárias

```txt
# Emissão Fiscal
nfelib>=1.0.0
PyTrustNFe>=1.0.0
signxml>=3.0.0
lxml>=4.9.0

# Boletos
gerencianet-sdk-python>=1.0.0
barcode>=0.15.0
reportlab>=3.6.0  # Para PDF de boleto

# Gateways de Pagamento
mercadopago>=2.0.0
pagseguro-python-sdk>=1.0.0
stripe>=7.0.0  # Já existe, mas expandir uso
```

---

## 📊 Priorização

### **Alta Prioridade (MVP)**
1. ✅ **Boletos** - Mais simples, impacto imediato
2. ✅ **Gateways de Pagamento** (Mercado Pago) - Recebimentos online
3. ✅ **Fluxo de Venda Básico** - Integrar tudo

### **Média Prioridade**
4. ⚠️ **NF-e** - Mais complexo, requer certificado digital
5. ⚠️ **NFSe** - Similar à NF-e

### **Baixa Prioridade**
6. ⚠️ **Maquininhas Físicas** - Se houver necessidade de PDV
7. ⚠️ **CT-e, MDF-e** - Se necessário para logística

---

## 🎯 Próximos Passos Imediatos

1. **Criar app `faturamento`**
2. **Implementar modelos base** (Boleto, TransacaoPagamento, Venda)
3. **Integrar Gerencianet para boletos** (mais rápido de implementar)
4. **Integrar Mercado Pago** para pagamentos online
5. **Criar fluxo básico de venda** (sem NF-e inicialmente)
6. **Depois implementar NF-e** (mais complexo)

---

## 📚 Recursos e Documentação

### NF-e
- [nfelib PyPI](https://pypi.org/project/nfelib/)
- [PyTrustNFe PyPI](https://pypi.org/project/PyTrustNFe/)
- [Manual de Integração SEFAZ](http://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/fq8PlV3kMo=)

### Boletos
- [Gerencianet SDK Python](https://github.com/gerencianet/gn-api-sdk-python)
- [Documentação Gerencianet](https://dev.gerencianet.com.br/docs)

### Gateways
- [Mercado Pago Developers](https://www.mercadopago.com.br/developers/pt/docs)
- [PagSeguro API](https://dev.pagseguro.uol.com.br/docs)
- [Stripe Brasil](https://stripe.com/br/docs)

---

## 💡 Observações Importantes

1. **Certificado Digital**: NF-e requer certificado A1 ou A3 válido
2. **Ambiente**: Começar com homologação, depois produção
3. **Webhooks**: Configurar adequadamente para atualizações automáticas
4. **Segurança**: Nunca armazenar senhas de certificado em texto plano
5. **Testes**: Criar ambiente de testes para cada gateway
6. **Logs**: Registrar todas as transações para auditoria

---

**Status**: 📝 Proposta - Aguardando aprovação para implementação

