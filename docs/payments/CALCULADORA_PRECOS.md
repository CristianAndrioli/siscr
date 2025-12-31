# 🧮 Calculadora de Preços - SISCR SaaS

## 📊 Cálculo Rápido de Precificação

### Fórmula Geral:

```
Preço Final = (Custos Fixos + Custos Variáveis + Margem de Lucro) / (1 - Taxa Stripe - Impostos)
```

---

## 💵 Exemplo Prático: Plano Básico

### Dados de Entrada:

**Custos:**
- Infraestrutura AWS: R$ 56/mês
- Taxa Stripe: 3,99% + R$ 0,39
- Impostos (Simples Nacional): 6%

**Meta:**
- Margem de lucro desejada: 70%
- Número de clientes: 1 (início)

### Cálculo Passo a Passo:

#### 1. Custo por Cliente (Custo Fixo)
```
Custo Fixo = R$ 56 / 1 cliente = R$ 56/cliente
```

#### 2. Custo Total (incluindo margem)
```
Custo Total = R$ 56 / (1 - 0,70) = R$ 56 / 0,30 = R$ 186,67
```

#### 3. Preço Bruto (antes de taxas)
```
Preço Bruto = Custo Total = R$ 186,67
```

#### 4. Ajuste para Taxa Stripe e Impostos
```
Taxa Total = Taxa Stripe + Impostos
Taxa Total = 3,99% + 6% = 9,99%

Preço Final = Preço Bruto / (1 - 0,0999)
Preço Final = R$ 186,67 / 0,9001 = R$ 207,28
```

**Arredondando**: **R$ 210/mês**

---

## 📋 Tabela de Cálculo Automático

### Para 1 Cliente (Início):

| Item | Valor | Observação |
|------|-------|------------|
| **Custo Infraestrutura** | R$ 56 | AWS Lightsail básico |
| **Custo por Cliente** | R$ 56 | Dividido por 1 cliente |
| **Margem Desejada** | 70% | Lucro sobre custo |
| **Custo + Margem** | R$ 186,67 | Custo / (1 - 0,70) |
| **Taxa Stripe** | 3,99% + R$ 0,39 | Por transação |
| **Impostos** | 6% | Simples Nacional |
| **Taxa Total** | ~10% | Stripe + Impostos |
| **Preço Final** | **R$ 210** | Arredondado |

**Validação:**
- Receita: R$ 210
- Taxa Stripe: (R$ 210 × 3,99%) + R$ 0,39 = R$ 8,78
- Impostos: R$ 210 × 6% = R$ 12,60
- Custos: R$ 56
- **Lucro**: R$ 210 - R$ 8,78 - R$ 12,60 - R$ 56 = **R$ 132,62**
- **Margem Real**: 63,2% ✅

---

### Para 5 Clientes (Crescimento):

| Item | Valor | Observação |
|------|-------|------------|
| **Custo Infraestrutura** | R$ 112 | AWS Lightsail médio |
| **Custo por Cliente** | R$ 22,40 | Dividido por 5 clientes |
| **Margem Desejada** | 80% | Lucro sobre custo |
| **Custo + Margem** | R$ 112,00 | Custo / (1 - 0,80) |
| **Taxa Stripe** | 3,99% + R$ 0,39 | Por transação |
| **Impostos** | 6% | Simples Nacional |
| **Taxa Total** | ~10% | Stripe + Impostos |
| **Preço Final** | **R$ 125** | Arredondado |

**Validação:**
- Receita Total: R$ 125 × 5 = R$ 625
- Taxa Stripe: 5 × [(R$ 125 × 3,99%) + R$ 0,39] = R$ 28,39
- Impostos: R$ 625 × 6% = R$ 37,50
- Custos: R$ 112
- **Lucro**: R$ 625 - R$ 28,39 - R$ 37,50 - R$ 112 = **R$ 447,11**
- **Margem Real**: 71,5% ✅

---

## 🎯 Precificação Recomendada por Fase

### FASE 1: Validação (1 Cliente)
**Preço Sugerido**: **R$ 399/mês**

**Justificativa:**
- Cobre custos com folga (R$ 56)
- Margem alta para investir em desenvolvimento
- Preço psicológico atraente (abaixo de R$ 400)
- Permite desconto sem perder dinheiro

**Cálculo:**
- Receita: R$ 399
- Taxa Stripe: R$ 16,33
- Impostos: R$ 23,94
- Custos: R$ 56
- **Lucro: R$ 302,73 (75,9% margem)**

---

### FASE 2: Crescimento (5-10 Clientes)
**Preços Sugeridos:**
- **Básico**: R$ 299/mês
- **Pro**: R$ 599/mês
- **Enterprise**: R$ 1.299/mês

**Justificativa:**
- Básico: Acessível, atrai clientes pequenos
- Pro: Preço médio, maior volume
- Enterprise: Premium, alta margem

**Cálculo Médio (Mix):**
- 3 × Básico: R$ 897
- 2 × Pro: R$ 1.198
- **Total**: R$ 2.095
- Custos: R$ 112
- Taxa Stripe: R$ 83,55
- Impostos: R$ 125,70
- **Lucro: R$ 1.773,75 (84,7% margem)**

---

### FASE 3: Escala (10+ Clientes)
**Mesmos Planos**, mas com infraestrutura otimizada:

**Custos:**
- AWS EC2 + RDS: R$ 250/mês
- Taxa Stripe: ~R$ 200/mês (10 clientes)
- Impostos: ~R$ 350/mês
- **Total Custos**: R$ 800/mês

**Receita (10 clientes mix):**
- 5 × Básico: R$ 1.495
- 3 × Pro: R$ 1.797
- 2 × Enterprise: R$ 2.598
- **Total**: R$ 5.890

**Lucro: R$ 5.090 (86,4% margem)**

---

## 📈 Simulador de Cenários

### Cenário 1: Preço Baixo (R$ 199/mês)

**Para 1 cliente:**
- Receita: R$ 199
- Taxa Stripe: R$ 8,34
- Impostos: R$ 11,94
- Custos: R$ 56
- **Lucro: R$ 122,72 (61,7% margem)**

**Para 5 clientes:**
- Receita: R$ 995
- Custos: R$ 112
- Taxa Stripe: R$ 39,70
- Impostos: R$ 59,70
- **Lucro: R$ 783,60 (78,7% margem)**

**Vantagem**: Preço mais acessível, mais fácil vender
**Desvantagem**: Margem menor, precisa de mais clientes

---

### Cenário 2: Preço Médio (R$ 399/mês)

**Para 1 cliente:**
- Receita: R$ 399
- Taxa Stripe: R$ 16,33
- Impostos: R$ 23,94
- Custos: R$ 56
- **Lucro: R$ 302,73 (75,9% margem)**

**Para 5 clientes:**
- Receita: R$ 1.995
- Custos: R$ 112
- Taxa Stripe: R$ 79,60
- Impostos: R$ 119,70
- **Lucro: R$ 1.683,70 (84,4% margem)**

**Vantagem**: Boa margem, preço competitivo
**Desvantagem**: Pode ser alto para alguns clientes

---

### Cenário 3: Preço Alto (R$ 599/mês)

**Para 1 cliente:**
- Receita: R$ 599
- Taxa Stripe: R$ 24,30
- Impostos: R$ 35,94
- Custos: R$ 56
- **Lucro: R$ 482,76 (80,6% margem)**

**Para 5 clientes:**
- Receita: R$ 2.995
- Custos: R$ 112
- Taxa Stripe: R$ 119,50
- Impostos: R$ 179,70
- **Lucro: R$ 2.583,80 (86,3% margem)**

**Vantagem**: Alta margem, posicionamento premium
**Desvantagem**: Pode limitar número de clientes

---

## 🎯 Recomendação Final

### Para INÍCIO (1-3 clientes):
**Preço Único: R$ 399/mês**

**Por quê:**
- ✅ Cobre custos com folga
- ✅ Margem alta (75%+)
- ✅ Permite investir em melhorias
- ✅ Preço psicológico bom (abaixo de R$ 400)
- ✅ Pode oferecer desconto sem perder dinheiro

---

### Para CRESCIMENTO (5-10 clientes):
**3 Planos:**
- **Básico**: R$ 299/mês
- **Pro**: R$ 599/mês
- **Enterprise**: R$ 1.299/mês

**Por quê:**
- ✅ Atende diferentes perfis
- ✅ Facilita upsell
- ✅ Margem média alta (85%+)
- ✅ Escalável

---

### Para ESCALA (10+ clientes):
**Mesmos planos**, mas:
- Otimizar custos de infraestrutura
- Negociar taxas com Stripe (volume)
- Considerar desconto anual (15% off)

---

## 💡 Dicas de Precificação

### 1. **Teste Preços**
- Comece com R$ 399/mês
- Ajuste baseado em feedback
- Monitore conversão

### 2. **Ofereça Desconto Anual**
- 15% de desconto = 2 meses grátis
- Melhora cash flow
- Reduz churn

### 3. **Crie Urgência**
- "Primeiros 10 clientes: 20% off no primeiro ano"
- "Preço promocional até [data]"

### 4. **Valorize o Produto**
- Não venda tecnologia, venda resultado
- Destaque economia de tempo
- Mostre ROI (retorno sobre investimento)

---

## 📊 Planilha Excel/Google Sheets

### Estrutura Sugerida:

```
A1: Preço Mensalidade
A2: Número de Clientes
A3: Custo Infraestrutura
A4: Taxa Stripe (%)
A5: Taxa Fixa Stripe (R$)
A6: Impostos (%)

B1: Receita Total = A1 * A2
B2: Custo por Cliente = A3 / A2
B3: Taxa Stripe Total = (B1 * A4/100) + (A5 * A2)
B4: Impostos Total = B1 * A6/100
B5: Custo Total = A3 + B3 + B4
B6: Lucro = B1 - B5
B7: Margem % = (B6 / B1) * 100
```

---

**Última atualização**: 2024
**Status**: Modelo de cálculo - pronto para uso

