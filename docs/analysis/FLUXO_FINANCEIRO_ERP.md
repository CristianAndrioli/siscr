# 💰 Fluxo Financeiro Completo de um ERP

## 📋 Visão Geral

Em um ERP, o módulo financeiro está integrado com:
- **Compras/Entradas** → Contas a Pagar (CP)
- **Vendas/Saídas** → Contas a Receber (CR)
- **Estoque** → Movimentações físicas
- **Faturamento** → Notas Fiscais (NF-e, NFSe)

---

## 🔄 FLUXO 1: ENTRADA (COMPRA) → CONTAS A PAGAR

### **Passo a Passo:**

```
1. NOTA FISCAL DE ENTRADA (NF-e de Fornecedor)
   ↓
2. ENTRADA DE ESTOQUE
   - Produtos entram no estoque
   - Quantidade aumenta
   - Custo médio é atualizado
   ↓
3. CONTAS A PAGAR É GERADA AUTOMATICAMENTE
   - Valor = Valor da NF
   - Fornecedor = Emitente da NF
   - Data de Vencimento = Data da NF + Prazo (se houver)
   - Status = "Pendente"
   ↓
4. PAGAMENTO (Manual ou Automático)
   - Usuário registra pagamento
   - Atualiza: valor_pago, data_pagamento
   - Status muda para "Pago" ou "Parcial"
   ↓
5. BAIXA DA CONTA A PAGAR
   - Quando valor_pago = valor_total → Status = "Pago"
   - Conta é baixada (fechada)
```

### **Exemplo Prático:**

```
1. Compra de 100 unidades de Produto X por R$ 10.000,00
   - NF-e 123456 do Fornecedor ABC
   
2. Estoque:
   - Produto X: +100 unidades
   - Custo médio atualizado
   
3. Conta a Pagar criada:
   - Código: CP-001
   - Fornecedor: ABC
   - Valor Total: R$ 10.000,00
   - Vencimento: 30 dias
   - Status: Pendente
   
4. Pagamento (30 dias depois):
   - Usuário vai em "Contas a Pagar"
   - Seleciona CP-001
   - Clica em "Baixar" ou "Registrar Pagamento"
   - Informa:
     * Valor: R$ 10.000,00
     * Data: 15/12/2024
     * Forma: Transferência
     * Conta bancária: Banco X
   
5. Sistema atualiza:
   - valor_pago = R$ 10.000,00
   - valor_pendente = R$ 0,00
   - status = "Pago"
   - data_pagamento = 15/12/2024
```

### **Parcelamentos em Contas a Pagar:**

```
NF de R$ 30.000,00 em 3x:
   ↓
3 Contas a Pagar são criadas:
   - CP-001: R$ 10.000,00 - Vencimento: 30 dias
   - CP-002: R$ 10.000,00 - Vencimento: 60 dias
   - CP-003: R$ 10.000,00 - Vencimento: 90 dias
   
Cada parcela é baixada independentemente quando paga.
```

---

## 🔄 FLUXO 2: SAÍDA (VENDA) → CONTAS A RECEBER

### **Passo a Passo:**

```
1. PEDIDO DE VENDA / ORÇAMENTO
   - Cliente solicita produtos
   - Sistema cria pedido
   ↓
2. RESERVA DE ESTOQUE (Opcional)
   - Reserva SOFT ou HARD
   - Garante disponibilidade
   ↓
3. EMISSÃO DE NOTA FISCAL DE SAÍDA
   - NF-e é emitida
   - XML gerado e enviado para SEFAZ
   - PDF gerado
   ↓
4. SAÍDA DE ESTOQUE
   - Produtos saem do estoque
   - Quantidade diminui
   - Movimentação registrada
   ↓
5. CONTAS A RECEBER É GERADA AUTOMATICAMENTE
   - Valor = Valor da NF
   - Cliente = Destinatário da NF
   - Data de Vencimento = Data da NF + Prazo (se houver)
   - Status = "Pendente"
   ↓
6. PAGAMENTO (Várias formas)
   
   OPÇÃO A: PAGAMENTO À VISTA (Imediato)
   - Cliente paga na hora (PIX, Cartão, Dinheiro)
   - Sistema processa pagamento via gateway
   - Conta a Receber é baixada AUTOMATICAMENTE
   
   OPÇÃO B: BOLETO BANCÁRIO
   - Sistema gera boleto a partir da Conta a Receber
   - Boleto é enviado para o cliente
   - Cliente paga no banco
   - Sistema consulta pagamento (ou recebe webhook)
   - Conta a Receber é baixada AUTOMATICAMENTE quando pago
   
   OPÇÃO C: PARCELADO (Cartão ou Boleto)
   - Sistema cria múltiplas Contas a Receber
   - Cada parcela pode ter boleto próprio
   - Cada parcela é baixada quando paga
   
   OPÇÃO D: PAGAMENTO MANUAL (Depois)
   - Cliente paga depois (transferência, cheque, etc.)
   - Usuário registra pagamento manualmente
   - Conta a Receber é baixada MANUALMENTE
   ↓
7. BAIXA DA CONTA A RECEBER
   - Quando valor_recebido = valor_total → Status = "Pago"
   - Conta é baixada (fechada)
```

### **Exemplo Prático - Venda à Vista:**

```
1. Venda de 50 unidades de Produto Y por R$ 5.000,00
   - Cliente: Empresa XYZ
   
2. Pedido criado:
   - Pedido: PED-001
   - Cliente: XYZ
   - Itens: 50x Produto Y
   
3. NF-e emitida:
   - NF-e 789012
   - Valor: R$ 5.000,00
   - Chave de acesso: 3521...
   
4. Estoque:
   - Produto Y: -50 unidades
   - Movimentação registrada
   
5. Conta a Receber criada:
   - Código: CR-001
   - Cliente: XYZ
   - Valor Total: R$ 5.000,00
   - Vencimento: Hoje (à vista)
   - Status: Pendente
   
6. Cliente paga via PIX:
   - Sistema processa via Mercado Pago
   - Pagamento aprovado em segundos
   
7. Sistema atualiza AUTOMATICAMENTE:
   - valor_recebido = R$ 5.000,00
   - valor_pendente = R$ 0,00
   - status = "Pago"
   - data_recebimento = Hoje
   - Conta é BAIXADA automaticamente
```

### **Exemplo Prático - Venda Parcelada com Boletos:**

```
1. Venda de R$ 30.000,00 em 3x
   - Cliente: Empresa ABC
   
2. NF-e emitida: R$ 30.000,00
   
3. Estoque: Produtos saem
   
4. 3 Contas a Receber são criadas:
   - CR-001: R$ 10.000,00 - Vencimento: 30 dias
   - CR-002: R$ 10.000,00 - Vencimento: 60 dias
   - CR-003: R$ 10.000,00 - Vencimento: 90 dias
   
5. Sistema gera 3 boletos:
   - Boleto 1: R$ 10.000,00 - Vencimento: 30 dias
   - Boleto 2: R$ 10.000,00 - Vencimento: 60 dias
   - Boleto 3: R$ 10.000,00 - Vencimento: 90 dias
   
6. Cliente paga Boleto 1:
   - Sistema recebe webhook do banco/gateway
   - CR-001 é baixada AUTOMATICAMENTE
   - Status: "Pago"
   
7. Cliente paga Boleto 2 (depois):
   - CR-002 é baixada AUTOMATICAMENTE
   
8. Cliente paga Boleto 3 (depois):
   - CR-003 é baixada AUTOMATICAMENTE
```

---

## 📊 COMPARAÇÃO: CONTAS A PAGAR vs CONTAS A RECEBER

| Aspecto | Contas a Pagar (CP) | Contas a Receber (CR) |
|---------|---------------------|----------------------|
| **Origem** | NF de Entrada (Compra) | NF de Saída (Venda) |
| **Quem deve** | Nós devemos ao fornecedor | Cliente nos deve |
| **Baixa** | Manual (registramos pagamento) | Manual ou Automática (via gateway/webhook) |
| **Boletos** | ❌ Não geramos (recebemos do fornecedor) | ✅ Geramos para o cliente |
| **Parcelamento** | ✅ Sim (ex: 3x de R$ 10.000) | ✅ Sim (ex: 3x de R$ 10.000) |
| **Pagamento** | Transferência, PIX, Boleto recebido | PIX, Cartão, Boleto gerado, Dinheiro |

---

## 🔄 FLUXO COMPLETO: SAÍDA (Venda)

### **Cenário Completo:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PEDIDO DE VENDA                                          │
│    - Cliente solicita produtos                              │
│    - Sistema cria PedidoVenda                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. RESERVA DE ESTOQUE (Opcional)                            │
│    - Reserva SOFT (temporária) ou HARD (bloqueia)           │
│    - Garante disponibilidade                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EMISSÃO DE NOTA FISCAL                                    │
│    - NF-e é emitida e enviada para SEFAZ                    │
│    - XML e PDF gerados                                      │
│    - Status: AUTORIZADA                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SAÍDA DE ESTOQUE                                          │
│    - Produtos saem do estoque                               │
│    - MovimentacaoEstoque criada (tipo=SAIDA)                │
│    - Quantidade atualizada                                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. FATURAMENTO                                               │
│    - Venda é faturada                                       │
│    - Status da venda: "FATURADA"                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. CONTAS A RECEBER CRIADA                                   │
│    - CR-001 criada automaticamente                          │
│    - Valor = Valor da NF                                    │
│    - Cliente = Destinatário                                 │
│    - Status: "Pendente"                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        │                               │
        ↓                               ↓
┌───────────────┐              ┌──────────────────┐
│ PAGAMENTO    │              │ BOLETO GERADO    │
│ À VISTA      │              │                  │
│              │              │ - Boleto criado  │
│ Via:         │              │   no gateway     │
│ - PIX        │              │ - PDF gerado     │
│ - Cartão     │              │ - Enviado para   │
│ - Maquininha │              │   cliente        │
└───────────────┘              └──────────────────┘
        │                               │
        │                               │
        └───────────────┬───────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. PAGAMENTO PROCESSADO                                      │
│    - Gateway processa pagamento                             │
│    - Webhook recebido (ou consulta manual)                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. BAIXA AUTOMÁTICA DA CONTA A RECEBER                      │
│    - valor_recebido = valor_total                           │
│    - status = "Pago"                                        │
│    - data_recebimento = data do pagamento                   │
│    - Conta é BAIXADA                                        │
└─────────────────────────────────────────────────────────────┘
```

### **Código Exemplo (Pseudo-código):**

```python
# 1. Criar Pedido de Venda
pedido = PedidoVenda.objects.create(
    cliente=cliente,
    itens=[...],
    status='PENDENTE'
)

# 2. Reservar Estoque
for item in pedido.itens:
    criar_reserva(
        produto=item.produto,
        quantidade=item.quantidade,
        tipo='HARD',
        origem='VENDA',
        documento_referencia=pedido.numero
    )

# 3. Emitir NF-e
nfe = nfe_service.emitir(
    cliente=cliente,
    itens=pedido.itens,
    empresa=empresa
)

# 4. Baixar Estoque
for item in pedido.itens:
    processar_saida_estoque(
        produto=item.produto,
        location=location,
        quantidade=item.quantidade,
        origem='VENDA',
        numero_nota_fiscal=nfe.numero,
        serie_nota_fiscal=nfe.serie
    )

# 5. Faturar
pedido.status = 'FATURADA'
pedido.nota_fiscal = nfe
pedido.save()

# 6. Criar Conta a Receber
conta_receber = ContaReceber.objects.create(
    cliente=cliente,
    valor_total=nfe.valor_total,
    data_emissao=nfe.data_emissao,
    data_vencimento=nfe.data_emissao + timedelta(days=30),
    status='Pendente',
    numero_documento=f"NF-{nfe.numero}"
)

# 7. Processar Pagamento
if forma_pagamento == 'PIX' or forma_pagamento == 'CARTAO':
    # Pagamento via gateway
    transacao = gateway.criar_transacao(
        valor=conta_receber.valor_total,
        metodo=forma_pagamento,
        cliente=cliente
    )
    
    # Aguardar confirmação (webhook ou polling)
    if transacao.status == 'APROVADO':
        # 8. Baixar Conta a Receber AUTOMATICAMENTE
        conta_receber.valor_recebido = conta_receber.valor_total
        conta_receber.data_recebimento = timezone.now()
        conta_receber.status = 'Pago'
        conta_receber.save()
        
elif forma_pagamento == 'BOLETO':
    # Gerar boleto
    boleto = boleto_service.gerar(conta_receber)
    
    # Boleto será pago depois
    # Quando pago, webhook atualiza conta_receber automaticamente
```

---

## 🔄 FLUXO COMPLETO: ENTRADA (Compra)

### **Cenário Completo:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. NOTA FISCAL DE ENTRADA (Recebida do Fornecedor)          │
│    - NF-e 123456 do Fornecedor ABC                          │
│    - Valor: R$ 10.000,00                                    │
│    - Prazo: 30 dias                                         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ENTRADA DE ESTOQUE                                        │
│    - Produtos entram no estoque                             │
│    - MovimentacaoEstoque criada (tipo=ENTRADA)              │
│    - Quantidade aumenta                                     │
│    - Custo médio atualizado                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CONTAS A PAGAR CRIADA AUTOMATICAMENTE                     │
│    - CP-001 criada                                          │
│    - Fornecedor = ABC                                       │
│    - Valor = R$ 10.000,00                                   │
│    - Vencimento = 30 dias                                    │
│    - Status: "Pendente"                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AGUARDAR VENCIMENTO                                       │
│    - Sistema pode alertar quando próximo do vencimento       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PAGAMENTO (MANUAL)                                        │
│    - Usuário vai em "Contas a Pagar"                        │
│    - Seleciona CP-001                                       │
│    - Clica em "Baixar" ou "Registrar Pagamento"             │
│    - Informa:                                                │
│      * Valor: R$ 10.000,00                                   │
│      * Data: 15/12/2024                                      │
│      * Forma: Transferência                                  │
│      * Conta bancária: Banco X                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. BAIXA MANUAL DA CONTA A PAGAR                             │
│    - valor_pago = R$ 10.000,00                              │
│    - valor_pendente = R$ 0,00                               │
│    - status = "Pago"                                        │
│    - data_pagamento = 15/12/2024                            │
│    - Conta é BAIXADA                                        │
└─────────────────────────────────────────────────────────────┘
```

### **Código Exemplo (Pseudo-código):**

```python
# 1. Receber NF de Entrada
nfe_entrada = receber_nfe_entrada(
    arquivo_xml='nfe_fornecedor.xml',
    fornecedor=fornecedor
)

# 2. Entrada de Estoque
for item in nfe_entrada.itens:
    processar_entrada_estoque(
        produto=item.produto,
        location=location,
        quantidade=item.quantidade,
        valor_unitario=item.valor_unitario,
        origem='COMPRA',
        numero_nota_fiscal=nfe_entrada.numero,
        serie_nota_fiscal=nfe_entrada.serie
    )

# 3. Criar Conta a Pagar AUTOMATICAMENTE
conta_pagar = ContaPagar.objects.create(
    fornecedor=fornecedor,
    valor_total=nfe_entrada.valor_total,
    data_emissao=nfe_entrada.data_emissao,
    data_vencimento=nfe_entrada.data_emissao + timedelta(days=30),
    status='Pendente',
    numero_documento=f"NF-{nfe_entrada.numero}"
)

# 4. Aguardar vencimento...

# 5. Pagamento MANUAL (usuário registra)
# Interface: "Contas a Pagar" → Selecionar CP-001 → "Baixar"
conta_pagar.valor_pago = conta_pagar.valor_total
conta_pagar.data_pagamento = timezone.now()
conta_pagar.status = 'Pago'
conta_pagar.save()
```

---

## 📋 RESUMO: BAIXAS

### **Contas a Pagar (CP):**
- ✅ **SEMPRE MANUAL**
- Usuário registra quando pagou
- Não há integração automática (não controlamos pagamentos do fornecedor)

### **Contas a Receber (CR):**
- ✅ **AUTOMÁTICA** quando:
  - Pagamento via gateway (PIX, Cartão) → Webhook atualiza
  - Boleto pago → Webhook do banco/gateway atualiza
  
- ✅ **MANUAL** quando:
  - Cliente paga depois (transferência, cheque)
  - Usuário registra pagamento recebido

---

## 🎯 PARCELAMENTOS

### **Contas a Pagar Parceladas:**

```
NF de R$ 30.000,00 em 3x:
   ↓
3 Contas a Pagar:
   - CP-001: R$ 10.000,00 - Venc: 30 dias
   - CP-002: R$ 10.000,00 - Venc: 60 dias
   - CP-003: R$ 10.000,00 - Venc: 90 dias
   
Cada uma é baixada independentemente quando paga.
```

### **Contas a Receber Parceladas:**

```
Venda de R$ 30.000,00 em 3x:
   ↓
3 Contas a Receber:
   - CR-001: R$ 10.000,00 - Venc: 30 dias
   - CR-002: R$ 10.000,00 - Venc: 60 dias
   - CR-003: R$ 10.000,00 - Venc: 90 dias
   
3 Boletos podem ser gerados (um para cada parcela).
Cada um é baixado quando pago.
```

---

## ✅ CONCLUSÃO

### **Fluxo de Saída (Venda):**
1. NF emitida → Estoque baixa → CR criada
2. Pagamento (PIX/Cartão) → CR baixada AUTOMATICAMENTE
3. OU Boleto gerado → Cliente paga → CR baixada AUTOMATICAMENTE (via webhook)

### **Fluxo de Entrada (Compra):**
1. NF recebida → Estoque sobe → CP criada
2. Pagamento → CP baixada MANUALMENTE (usuário registra)

### **Boletos:**
- ✅ Gerados a partir de **Contas a Receber**
- ❌ **NÃO** são gerados para Contas a Pagar (recebemos do fornecedor)

### **Parcelamentos:**
- ✅ Existem em **ambos** (CP e CR)
- Cada parcela é uma conta separada
- Cada parcela é baixada independentemente

---

**Status**: ✅ Explicação Completa

