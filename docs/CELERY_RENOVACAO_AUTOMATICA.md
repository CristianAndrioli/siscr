# 🔄 Sistema de Renovação Automática e Notificações

## 📋 Visão Geral

Este sistema implementa:
1. **Sincronização periódica** com Stripe (backup caso webhooks falhem)
2. **Notificações por email** para eventos importantes
3. **Suspensão/reativação automática** de tenants baseado no status da assinatura

---

## 🏗️ Arquitetura

### Componentes

1. **Celery Worker** (`celery_worker`): Executa tarefas assíncronas
2. **Celery Beat** (`celery_beat`): Agenda tarefas periódicas
3. **Redis**: Broker de mensagens e backend de resultados
4. **Tarefas Periódicas**: Executadas automaticamente pelo Beat

---

## 📅 Tarefas Periódicas

### 1. `sync_subscriptions_with_stripe`
**Frequência**: A cada 1 hora  
**Função**: Sincroniza assinaturas locais com o Stripe como backup caso webhooks falhem

**O que faz**:
- Busca todas as assinaturas com `payment_gateway_id`
- Consulta status no Stripe
- Atualiza status, períodos e `cancel_at_period_end` localmente
- Loga mudanças de status

### 2. `check_expiring_subscriptions`
**Frequência**: A cada 24 horas (1 dia)  
**Função**: Verifica assinaturas expirando e envia notificações

**O que faz**:
- Identifica assinaturas expirando em 7, 3 e 1 dia
- Envia emails de notificação para cada caso
- Loga envios e erros

### 3. `suspend_expired_tenants`
**Frequência**: A cada 1 hora  
**Função**: Suspende tenants com assinaturas expiradas

**O que faz**:
- Busca assinaturas expiradas (`current_period_end < now`)
- Suspende tenant (`is_active = False`)
- Atualiza status da assinatura para `expired`
- Envia email de suspensão

### 4. `reactivate_tenant` (Tarefa sob demanda)
**Frequência**: Chamada quando webhook de pagamento bem-sucedido é recebido  
**Função**: Reativa tenant após pagamento

**O que faz**:
- Reativa tenant (`is_active = True`)
- Atualiza status da assinatura para `active` se estava `expired`
- Envia email de reativação

---

## 📧 Notificações por Email

### Tipos de Notificação

1. **Pagamento Bem-Sucedido** (`send_payment_succeeded_notification`)
   - Enviado quando `invoice.payment_succeeded` é recebido
   - Confirma pagamento e mostra detalhes da assinatura

2. **Pagamento Falhado** (`send_payment_failed_notification`)
   - Enviado quando `invoice.payment_failed` é recebido
   - Alerta sobre falha e pede atualização do método de pagamento

3. **Assinatura Expirando** (`send_expiring_notification`)
   - Enviado 7, 3 e 1 dia antes da expiração
   - Lembra sobre renovação automática

4. **Suspensão** (`send_suspension_notification`)
   - Enviado quando tenant é suspenso
   - Informa sobre suspensão e como reativar

5. **Reativação** (`send_reactivation_notification`)
   - Enviado quando tenant é reativado
   - Confirma reativação e mostra detalhes

---

## 🚀 Como Usar

### 1. Iniciar Serviços

```bash
# Iniciar todos os serviços (web, worker, beat, redis, db)
docker-compose up -d

# Ou iniciar apenas Celery
docker-compose up celery_worker celery_beat
```

### 2. Verificar Logs

```bash
# Logs do worker
docker-compose logs -f celery_worker

# Logs do beat
docker-compose logs -f celery_beat

# Logs de todas as tarefas
docker-compose logs -f celery_worker celery_beat
```

### 3. Executar Tarefas Manualmente (Desenvolvimento)

```bash
# Entrar no container
docker-compose exec web bash

# Executar tarefa manualmente
python manage.py shell
>>> from subscriptions.tasks import sync_subscriptions_with_stripe
>>> sync_subscriptions_with_stripe.delay()
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

No `docker-compose.yml` ou `.env`:

```bash
# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Email (para notificações)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@siscr.com.br
EMAIL_HOST_PASSWORD=sua_senha
DEFAULT_FROM_EMAIL=SISCR <noreply@siscr.com.br>

# Frontend URL (para links nos emails)
FRONTEND_URL=https://siscr.com.br
```

### Ajustar Frequência das Tarefas

No `siscr/settings.py`, em `CELERY_BEAT_SCHEDULE`:

```python
CELERY_BEAT_SCHEDULE = {
    'sync-subscriptions': {
        'task': 'subscriptions.tasks.sync_subscriptions_with_stripe',
        'schedule': 3600.0,  # A cada 1 hora (em segundos)
    },
    'check-expiring-subscriptions': {
        'task': 'subscriptions.tasks.check_expiring_subscriptions',
        'schedule': 86400.0,  # A cada 24 horas (em segundos)
    },
    'suspend-expired-tenants': {
        'task': 'subscriptions.tasks.suspend_expired_tenants',
        'schedule': 3600.0,  # A cada 1 hora (em segundos)
    },
}
```

---

## 🔍 Monitoramento

### Verificar Status das Tarefas

```bash
# Ver tarefas agendadas
docker-compose exec celery_beat celery -A siscr inspect scheduled

# Ver workers ativos
docker-compose exec celery_worker celery -A siscr inspect active

# Ver estatísticas
docker-compose exec celery_worker celery -A siscr inspect stats
```

### Logs Importantes

Os logs incluem:
- `[CELERY]` - Tarefas do Celery
- `[WEBHOOK]` - Webhooks do Stripe
- Notificações de email enviadas/falhadas

---

## 🐛 Troubleshooting

### Worker não está executando tarefas

1. Verificar se Redis está rodando:
   ```bash
   docker-compose ps redis
   ```

2. Verificar logs do worker:
   ```bash
   docker-compose logs celery_worker
   ```

3. Verificar conexão com Redis:
   ```bash
   docker-compose exec celery_worker celery -A siscr inspect ping
   ```

### Beat não está agendando tarefas

1. Verificar logs do beat:
   ```bash
   docker-compose logs celery_beat
   ```

2. Verificar se há erros no schedule:
   ```bash
   docker-compose exec celery_beat celery -A siscr inspect scheduled
   ```

### Emails não estão sendo enviados

1. Verificar configuração de email no `settings.py`
2. Verificar logs do Django:
   ```bash
   docker-compose logs web | grep -i email
   ```
3. Testar envio manual:
   ```python
   python manage.py shell
   >>> from subscriptions.notifications import SubscriptionNotificationService
   >>> from subscriptions.models import Subscription
   >>> sub = Subscription.objects.first()
   >>> service = SubscriptionNotificationService()
   >>> service.send_payment_succeeded_notification(sub)
   ```

---

## 📝 Notas Importantes

1. **Webhooks são a fonte primária**: As tarefas periódicas são apenas backup. Os webhooks do Stripe são processados em tempo real.

2. **Modo Simulado**: Em `STRIPE_MODE=simulated`, a sincronização é pulada.

3. **Multi-tenancy**: Todas as tarefas usam `schema_context('public')` para acessar dados compartilhados.

4. **Idempotência**: As tarefas são idempotentes - podem ser executadas múltiplas vezes sem causar problemas.

---

**Última atualização**: 2025-12-20

