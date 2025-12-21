# 🔄 Sincronização Automática de Preços com Stripe

## ✅ Implementado

O sistema agora **sincroniza automaticamente** os preços dos planos com o Stripe quando você altera um preço no Stripe Dashboard.

---

## 🎯 Como Funciona

### **Sincronização Automática**

1. **Quando lista planos** (`/api/public/plans/`):
   - Sistema verifica se precisa sincronizar (cache de 5 minutos)
   - Se necessário, busca preços do Stripe e atualiza o banco local
   - Retorna planos com preços atualizados

2. **Quando acessa gerenciamento de assinatura** (`/subscription-management`):
   - Sistema sincroniza preços antes de exibir
   - Mostra preços atualizados do Stripe

3. **Cache Inteligente**:
   - Sincroniza no máximo a cada 5 minutos
   - Evita muitas chamadas ao Stripe
   - Mantém performance boa

---

## 📋 Onde os Preços são Atualizados

### **1. Tela de Planos** (`/plans`)
- ✅ Preços sincronizados automaticamente
- ✅ Mostra valores atualizados do Stripe

### **2. Tela de Configurações** (`/subscription-management`)
- ✅ Preços sincronizados automaticamente
- ✅ Mostra valores atualizados do Stripe

---

## 🔧 Como Usar

### **Alterar Preço no Stripe**

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Vá em **Products** → Seu Produto
3. Edite o **Price** (ou crie um novo)
4. Salve

### **Sistema Atualiza Automaticamente**

- ⏱️ **Até 5 minutos**: Preços serão atualizados na próxima listagem de planos
- 🔄 **Imediato**: Se você acessar `/plans` ou `/subscription-management`, sincroniza na hora

---

## 🛠️ Comandos Úteis

### **Sincronização Manual**

Se quiser forçar sincronização imediata:

```bash
python manage.py sync_plan_prices
```

Para forçar mesmo com cache válido:

```bash
python manage.py sync_plan_prices --force
```

---

## 📊 Detalhes Técnicos

### **Método `sync_prices_from_stripe()`**

Cada plano tem um método que:
1. Busca preço mensal do Stripe (se `stripe_price_id_monthly` configurado)
2. Busca preço anual do Stripe (se `stripe_price_id_yearly` configurado)
3. Compara com preços no banco
4. Atualiza apenas se houver diferença
5. Salva no banco

### **Função `sync_all_plans_from_stripe()`**

Sincroniza todos os planos ativos:
- Verifica cache (5 minutos)
- Itera sobre todos os planos
- Atualiza preços quando necessário
- Retorna estatísticas

### **Cache**

- **Chave**: `plans_sync_last_run`
- **Duração**: 5 minutos
- **Backend**: Redis (já configurado)

---

## ⚠️ Limitações

1. **Modo Simulado**: Não sincroniza se `STRIPE_MODE=simulated`
2. **Cache**: Pode levar até 5 minutos para refletir mudanças
3. **Stripe API**: Depende da API do Stripe estar disponível
4. **Price IDs**: Planos precisam ter `stripe_price_id_monthly` ou `stripe_price_id_yearly` configurados

---

## 🐛 Troubleshooting

### **Preços não atualizam**

1. Verifique se `STRIPE_MODE` está configurado (não pode ser `simulated`)
2. Verifique se os planos têm `stripe_price_id_monthly` configurado
3. Execute manualmente: `python manage.py sync_plan_prices --force`
4. Verifique logs do Django para erros

### **Erro ao sincronizar**

- Verifique se as chaves do Stripe estão configuradas
- Verifique se os Price IDs estão corretos
- Verifique logs: `docker-compose logs web | grep -i stripe`

---

## 📝 Exemplo de Uso

### **Cenário**: Você altera preço do plano "Pro" no Stripe

1. **Stripe Dashboard**: Altera de R$ 99 para R$ 149
2. **Sistema**: Na próxima listagem de planos (ou após 5 minutos), sincroniza automaticamente
3. **Resultado**: 
   - Banco local atualizado: `price_monthly = 149.00`
   - Tela de planos mostra: R$ 149,00
   - Tela de configurações mostra: R$ 149,00

---

## 🔍 Logs

A sincronização gera logs informativos:

```
INFO: Preço mensal do plano Pro atualizado: R$ 99.00 -> R$ 149.00
INFO: Sincronização de planos concluída: 1/4 planos atualizados
```

---

**Última atualização**: 2025-12-20

