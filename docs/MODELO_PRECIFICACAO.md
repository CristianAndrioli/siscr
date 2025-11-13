# 💰 Modelo de Precificação - SISCR SaaS

## ⚠️ Resposta Direta: Custos Fixos AWS Lightsail

**SIM, AWS Lightsail tem custo fixo mensal mesmo sem uso!**

- O Lightsail cobra **por hora** até atingir o **custo máximo mensal** do plano
- Se a instância estiver **ligada 24/7**, você paga o valor total do mês
- Se você **desligar a instância**, não paga enquanto estiver desligada
- **Mas**: Para um SaaS, você precisa estar sempre online → custo fixo garantido

**Exemplo:**
- Plano de $10/mês = ~R$ 50/mês
- Se ficar ligado o mês inteiro = R$ 50 fixo
- Se desligar por 15 dias = R$ 25 (mas sua aplicação não funciona!)

---

## 📊 Análise de Custos Detalhada

### 1. Custos de Infraestrutura (AWS)

#### **Cenário Inicial (1-3 Clientes)**

**AWS Lightsail - Plano Básico:**
- **Instância**: $10/mês (~R$ 50)
  - 2 GB RAM, 1 vCPU, 60 GB SSD, 3 TB transferência
- **Route 53 (DNS)**: $0.50/mês (~R$ 2.50)
- **Backup Snapshot**: $0.05/GB (~R$ 1-3/mês)
- **Total Infraestrutura**: **~R$ 53-56/mês**

#### **Cenário Crescimento (5-10 Clientes)**

**AWS Lightsail - Plano Médio:**
- **Instância**: $20/mês (~R$ 100)
  - 4 GB RAM, 2 vCPU, 80 GB SSD, 4 TB transferência
- **Route 53**: $0.50/mês (~R$ 2.50)
- **Backup**: ~R$ 5-10/mês
- **Total Infraestrutura**: **~R$ 107-112/mês**

#### **Cenário Escala (10+ Clientes)**

**AWS EC2 + RDS:**
- **EC2 t3.small**: ~$15/mês (~R$ 75)
- **RDS db.t3.micro**: ~$12/mês (~R$ 60)
- **ElastiCache Redis**: ~$15/mês (~R$ 75)
- **S3 Storage**: ~$5/mês (~R$ 25)
- **Route 53**: $0.50/mês (~R$ 2.50)
- **CloudWatch**: ~$5/mês (~R$ 25)
- **Total Infraestrutura**: **~R$ 242-250/mês**

---

### 2. Taxas de Pagamento (Stripe Brasil)

**Taxas da Stripe no Brasil:**
- **Cartão de Crédito/Débito Nacional**: 3,99% + R$ 0,39 por transação
- **Cartão Internacional**: 4,99% + R$ 0,39 por transação
- **Boleto**: R$ 3,00 por boleto (sem taxa percentual)
- **PIX**: 0,99% + R$ 0,39 por transação

**Exemplo de cálculo:**
- Mensalidade de R$ 100
- Taxa Stripe: (R$ 100 × 3,99%) + R$ 0,39 = R$ 3,99 + R$ 0,39 = **R$ 4,38**
- Você recebe: R$ 100 - R$ 4,38 = **R$ 95,62**

---

### 3. Impostos no Brasil

#### **ISS (Imposto Sobre Serviços)**
- Varia de **2% a 5%** dependendo do município
- Média nacional: **~3%**
- **Exemplo**: R$ 100 × 3% = R$ 3,00

#### **IRPJ (Imposto de Renda Pessoa Jurídica)**
- **Simples Nacional**: 6% a 15% sobre faturamento (depende da receita)
- **Presumido**: 8% sobre faturamento
- **Real**: 15% sobre lucro

#### **CSLL (Contribuição Social)**
- **Simples Nacional**: Incluído
- **Presumido**: 12% sobre lucro
- **Real**: 9% sobre lucro

#### **PIS/COFINS**
- **Simples Nacional**: Incluído
- **Presumido/Real**: ~9,25% sobre faturamento

**Para simplificar (Simples Nacional - Faixa 1):**
- **Alíquota total**: ~6% sobre faturamento
- **Exemplo**: R$ 100 × 6% = R$ 6,00

---

## 💵 Modelo de Precificação Proposto

### Estratégia: **Precificação por Tenant (Conta)**

**Por quê por tenant e não por usuário?**
- Cada prefeitura = 1 tenant
- Custo de infraestrutura é por tenant (schema isolado)
- Mais simples de gerenciar
- Escalável (pode ter planos diferentes)

---

### 📋 Planos Propostos

#### **PLANO BÁSICO** - Para Prefeituras Pequenas
- **Preço**: R$ 299/mês por tenant
- **Inclui**:
  - Até 10 usuários
  - Até 1.000 registros (pessoas/produtos)
  - 5 GB de armazenamento
  - Suporte por email
  - Funcionalidades básicas

#### **PLANO PROFISSIONAL** - Para Prefeituras Médias
- **Preço**: R$ 599/mês por tenant
- **Inclui**:
  - Até 50 usuários
  - Até 10.000 registros
  - 20 GB de armazenamento
  - Suporte prioritário
  - Todas as funcionalidades
  - Backup diário

#### **PLANO ENTERPRISE** - Para Prefeituras Grandes
- **Preço**: R$ 1.299/mês por tenant
- **Inclui**:
  - Usuários ilimitados
  - Registros ilimitados
  - 100 GB de armazenamento
  - Suporte 24/7
  - SLA garantido
  - Backup em tempo real
  - Treinamento personalizado

---

## 🧮 Cálculo Detalhado de Custos e Lucro

### Cenário 1: Início (1 Cliente - Plano Básico)

**Receita:**
- Mensalidade: R$ 299/mês

**Custos:**
- **Infraestrutura AWS**: R$ 56/mês
- **Taxa Stripe** (3,99% + R$ 0,39): R$ 11,93
- **Impostos** (6% Simples Nacional): R$ 17,94
- **Total Custos**: R$ 85,87

**Lucro Bruto:**
- R$ 299 - R$ 85,87 = **R$ 213,13/mês**
- **Margem**: 71,3%

**Observação**: No início, com 1 cliente, você ainda não cobre totalmente os custos fixos. Precisa de pelo menos 2-3 clientes para ter lucro real.

---

### Cenário 2: Crescimento (5 Clientes - Mix de Planos)

**Receita Mensal:**
- 3 × Plano Básico (R$ 299): R$ 897
- 2 × Plano Profissional (R$ 599): R$ 1.198
- **Total Receita**: R$ 2.095/mês

**Custos:**
- **Infraestrutura AWS**: R$ 112/mês (upgrade para plano médio)
- **Taxa Stripe** (5 transações):
  - 3 × R$ 11,93 = R$ 35,79
  - 2 × R$ 23,88 = R$ 47,76
  - **Total Stripe**: R$ 83,55
- **Impostos** (6%): R$ 125,70
- **Total Custos**: R$ 321,25

**Lucro Bruto:**
- R$ 2.095 - R$ 321,25 = **R$ 1.773,75/mês**
- **Margem**: 84,7%

---

### Cenário 3: Escala (10 Clientes - Mix de Planos)

**Receita Mensal:**
- 5 × Plano Básico: R$ 1.495
- 3 × Plano Profissional: R$ 1.797
- 2 × Plano Enterprise: R$ 2.598
- **Total Receita**: R$ 5.890/mês

**Custos:**
- **Infraestrutura AWS** (EC2 + RDS): R$ 250/mês
- **Taxa Stripe** (10 transações): ~R$ 200/mês
- **Impostos** (6%): R$ 353,40
- **Total Custos**: R$ 803,40

**Lucro Bruto:**
- R$ 5.890 - R$ 803,40 = **R$ 5.086,60/mês**
- **Margem**: 86,4%

---

## 📈 Tabela de Break-Even (Ponto de Equilíbrio)

### Com Plano Básico (R$ 299/mês):

| Clientes | Receita | Custos | Lucro | Margem |
|----------|---------|--------|-------|--------|
| 1 | R$ 299 | R$ 86 | R$ 213 | 71% |
| 2 | R$ 598 | R$ 112 | R$ 486 | 81% |
| 3 | R$ 897 | R$ 112 | R$ 785 | 87% |
| 5 | R$ 1.495 | R$ 112 | R$ 1.383 | 92% |
| 10 | R$ 2.990 | R$ 250 | R$ 2.740 | 92% |

**Ponto de Equilíbrio**: **1 cliente** já dá lucro, mas com margem baixa. Ideal ter **3+ clientes** para margem confortável.

---

## 🎯 Estratégia de Precificação para Escalabilidade

### 1. **Modelo de Precificação Escalonado**

**Abordagem**: Preço base + custos variáveis por uso

**Exemplo:**
- **Base**: R$ 199/mês (cobre custos fixos)
- **Por usuário adicional**: R$ 10/mês (após 5 usuários)
- **Por GB de armazenamento**: R$ 5/mês (após 10 GB)

**Vantagens:**
- ✅ Cobre custos fixos garantidamente
- ✅ Escala com o uso do cliente
- ✅ Mais justo para clientes pequenos

**Desvantagens:**
- ⚠️ Mais complexo de explicar
- ⚠️ Cliente pode não saber quanto vai pagar

---

### 2. **Modelo de Precificação por Tiers (Recomendado)**

**Abordagem**: Planos fixos com limites claros

**Vantagens:**
- ✅ Simples de entender
- ✅ Previsível para o cliente
- ✅ Fácil de vender
- ✅ Escalável (cliente pode fazer upgrade)

**Desvantagens:**
- ⚠️ Pode deixar dinheiro na mesa (cliente usa pouco)
- ⚠️ Pode ter custos altos (cliente usa muito)

---

### 3. **Modelo Híbrido (Melhor dos Dois Mundos)**

**Abordagem**: Plano base + overage (uso além do limite)

**Exemplo - Plano Profissional:**
- **Base**: R$ 599/mês
  - Inclui: 50 usuários, 10.000 registros, 20 GB
- **Overage**:
  - Usuário adicional: R$ 15/mês
  - 1.000 registros adicionais: R$ 10/mês
  - 1 GB adicional: R$ 3/mês

**Vantagens:**
- ✅ Cliente paga pelo que usa
- ✅ Você não perde dinheiro
- ✅ Cliente pode começar pequeno

---

## 💡 Recomendações Finais

### Precificação Inicial (1-3 Clientes)

**Sugestão: Plano Único Simplificado**
- **Preço**: R$ 399/mês
- **Inclui**: Tudo (sem limites rígidos no início)
- **Justificativa**:
  - Cobre custos com folga
  - Simples de vender
  - Pode ajustar depois

**Cálculo:**
- Receita: R$ 399
- Custos: R$ 86
- **Lucro: R$ 313/mês (78% margem)**

---

### Precificação para Escala (5+ Clientes)

**Sugestão: 3 Planos (Básico, Pro, Enterprise)**

**Estratégia de Upsell:**
- Começar com Plano Básico
- Oferecer upgrade quando cliente crescer
- Desconto anual (10-15% off)

**Preços Sugeridos:**
- **Básico**: R$ 299/mês (anual: R$ 2.990 = 2 meses grátis)
- **Pro**: R$ 599/mês (anual: R$ 5.990 = 2 meses grátis)
- **Enterprise**: R$ 1.299/mês (anual: R$ 12.990 = 2 meses grátis)

---

### Estratégia de Desconto

**Desconto Anual:**
- Pagamento anual: **15% de desconto**
- **Exemplo**: R$ 299/mês → R$ 254/mês anual
- **Benefício**: Cash flow melhor, menos churn

**Desconto por Volume:**
- 3+ prefeituras: **10% de desconto**
- 5+ prefeituras: **15% de desconto**
- 10+ prefeituras: **20% de desconto**

---

## 📊 Planilha de Cálculo Automático

### Fórmulas para Excel/Google Sheets:

```excel
// Células de entrada
A1: Preço Mensalidade (R$)
A2: Número de Clientes
A3: Taxa Stripe (%)
A4: Taxa Fixa Stripe (R$)
A5: Impostos (%)
A6: Custo Infraestrutura (R$)

// Cálculos
B1: Receita Total = A1 * A2
B2: Taxa Stripe Total = (B1 * A3/100) + (A4 * A2)
B3: Impostos Total = B1 * A5/100
B4: Custo Total = B2 + B3 + A6
B5: Lucro Bruto = B1 - B4
B6: Margem % = (B5 / B1) * 100
```

---

## 🎓 Considerações Importantes

### 1. **Custos Ocultos**
- Desenvolvimento contínuo
- Suporte ao cliente
- Marketing e vendas
- Contabilidade e jurídico
- **Recomendação**: Adicionar 20-30% de margem de segurança

### 2. **Crescimento Gradual**
- Não precisa cobrir todos os custos no primeiro cliente
- Foque em validar o produto primeiro
- Ajuste preços conforme feedback

### 3. **Concorrência**
- Pesquise preços de concorrentes
- Posicione-se no mercado (premium ou acessível)
- Diferencie pelo valor, não só pelo preço

### 4. **Valor Percebido**
- Prefeituras pagam por **resultado**, não por tecnologia
- Destaque economia de tempo, redução de erros, compliance
- Preço pode ser maior se o valor for claro

---

## 📋 Checklist de Implementação

### Fase 1: Validação (1-3 Clientes)
- [ ] Definir preço inicial (sugestão: R$ 399/mês)
- [ ] Criar página de preços
- [ ] Configurar Stripe
- [ ] Testar fluxo de pagamento
- [ ] Acompanhar custos reais

### Fase 2: Estruturação (5-10 Clientes)
- [ ] Criar 3 planos (Básico, Pro, Enterprise)
- [ ] Implementar sistema de quotas
- [ ] Configurar upgrade/downgrade
- [ ] Oferecer desconto anual
- [ ] Dashboard de métricas financeiras

### Fase 3: Otimização (10+ Clientes)
- [ ] Analisar custos por cliente
- [ ] Ajustar preços se necessário
- [ ] Implementar precificação dinâmica
- [ ] Criar planos customizados (Enterprise)

---

## 💰 Resumo Executivo

### Precificação Recomendada:

**INÍCIO (1-3 clientes):**
- **Plano Único**: R$ 399/mês
- **Margem**: ~78%
- **Objetivo**: Validar produto, cobrir custos

**CRESCIMENTO (5-10 clientes):**
- **Básico**: R$ 299/mês
- **Pro**: R$ 599/mês
- **Enterprise**: R$ 1.299/mês
- **Margem**: ~85%
- **Objetivo**: Escalar receita, otimizar custos

**ESCALA (10+ clientes):**
- **Mesmos planos** com ajustes finos
- **Margem**: ~86%
- **Objetivo**: Maximizar lucro, investir em crescimento

---

**Última atualização**: 2024
**Status**: Modelo proposto - aguardando validação

