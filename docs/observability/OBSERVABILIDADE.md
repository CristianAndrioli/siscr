# 📊 Observabilidade no SISCR

## O que é Observabilidade?

**Observabilidade** é a capacidade de entender o estado interno de um sistema através de suas saídas externas. É composta por três pilares principais:

### 1. **Logs (Registros)**
- **O que são**: Registros de eventos que acontecem no sistema
- **Para que serve**: 
  - Rastrear o que aconteceu (ex: "Usuário X fez login", "Erro ao processar pagamento")
  - Debug de problemas
  - Auditoria e compliance
- **Exemplo**: Logs de webhooks do Stripe, logs de login, logs de erros

### 2. **Métricas (Metrics)**
- **O que são**: Medições numéricas coletadas ao longo do tempo
- **Para que serve**:
  - Monitorar performance (tempo de resposta, throughput)
  - Identificar tendências (crescimento de usuários, uso de recursos)
  - Alertas baseados em limites (ex: "CPU > 80%", "Erros > 100/min")
- **Exemplo**: Número de requisições por segundo, tempo médio de resposta, uso de CPU/memória

### 3. **Tracing (Rastreamento)**
- **O que são**: Rastreamento de requisições através de múltiplos serviços
- **Para que serve**:
  - Entender o fluxo completo de uma requisição
  - Identificar gargalos em sistemas distribuídos
  - Ver onde uma requisição está "travada"
- **Exemplo**: Rastrear uma requisição desde o frontend → API → Banco de dados → Serviço externo

---

## 🔍 Estado Atual do SISCR

### ✅ O que JÁ TEMOS:

1. **Logging Básico**
   - Uso de `logging.getLogger(__name__)` em vários módulos
   - Logs de webhooks do Stripe
   - Logs de autenticação/login
   - Logs de erros em alguns pontos

2. **Health Check Endpoint**
   - `/api/health/` verifica:
     - Conexão com banco de dados
     - Conexão com Redis/Cache
     - Configurações básicas
   - Usado em CI/CD para verificar deploy

3. **Métricas de Negócio**
   - `/api/metrics/` retorna:
     - Quotas de uso (usuários, empresas, filiais, storage)
     - Status da assinatura
     - Percentuais de uso

4. **Sentry SDK Instalado**
   - `sentry-sdk` está no `requirements.txt`
   - Mas está **comentado** no `settings.py` (não está ativo)

### ❌ O que FALTA:

1. **Logging Estruturado**
   - Logs não estão em formato JSON (difícil de processar)
   - Não há rotação de logs
   - Não há níveis de log configurados adequadamente
   - Logs não são centralizados

2. **Sentry Não Configurado**
   - SDK instalado mas não inicializado
   - Sem captura automática de erros
   - Sem alertas de erros críticos

3. **Métricas de Performance**
   - Não medimos tempo de resposta das APIs
   - Não rastreamos queries lentas do banco
   - Não monitoramos uso de recursos (CPU, memória)
   - Não temos métricas por tenant

4. **Tracing**
   - Não rastreamos requisições através do sistema
   - Não identificamos gargalos facilmente

5. **Alertas**
   - Não há alertas automáticos para:
     - Erros críticos
     - Performance degradada
     - Serviços indisponíveis
     - Quotas próximas do limite

6. **Dashboards**
   - Não há dashboards visuais de monitoramento
   - Não há visualização de métricas em tempo real

---

## 🎯 Por que Observabilidade é Importante?

### Para Desenvolvimento:
- **Debug mais rápido**: Encontrar problemas em minutos, não horas
- **Entender comportamento**: Ver como o sistema se comporta em produção
- **Melhorar código**: Identificar código lento ou problemático

### Para Operações:
- **Detectar problemas antes dos usuários**: Alertas proativos
- **Monitorar saúde do sistema**: Saber se está tudo funcionando
- **Planejamento de capacidade**: Ver quando precisar escalar

### Para Negócio:
- **Satisfação do cliente**: Problemas resolvidos rapidamente
- **Compliance**: Logs de auditoria para LGPD
- **Otimização de custos**: Identificar uso desnecessário de recursos

---

## 🚀 Como Implementar Observabilidade

### Fase 1: Básico (1-2 dias) ⭐ RECOMENDADO COMEÇAR AQUI

1. **Configurar Logging Estruturado**
   - Logs em formato JSON
   - Rotação de arquivos
   - Níveis de log apropriados

2. **Ativar Sentry**
   - Configurar DSN
   - Captura automática de erros
   - Alertas básicos

3. **Melhorar Health Check**
   - Adicionar mais verificações (Celery, Stripe)
   - Métricas básicas de performance

### Fase 2: Intermediário (3-5 dias)

4. **Métricas de Performance**
   - Middleware para medir tempo de resposta
   - Métricas de queries do banco
   - Métricas por tenant

5. **Logging Avançado**
   - Contexto adicional (tenant, user, request_id)
   - Logs de auditoria estruturados
   - Integração com serviços externos

6. **Alertas Básicos**
   - Alertas de erro crítico (Sentry)
   - Alertas de health check falhando
   - Alertas de quotas

### Fase 3: Avançado (1-2 semanas)

7. **Tracing Distribuído**
   - OpenTelemetry
   - Rastreamento de requisições
   - Visualização de traces

8. **Dashboards**
   - Grafana ou similar
   - Visualização de métricas
   - Dashboards por tenant

9. **Métricas de Negócio**
   - Eventos de negócio (signups, pagamentos, etc.)
   - Analytics avançado
   - Relatórios automatizados

---

## 📋 Próximos Passos Recomendados

### Prioridade ALTA 🔴
1. ✅ Configurar logging estruturado
2. ✅ Ativar Sentry
3. ✅ Melhorar health check

### Prioridade MÉDIA 🟡
4. Métricas de performance
5. Alertas básicos
6. Logging com contexto

### Prioridade BAIXA 🟢
7. Tracing distribuído
8. Dashboards avançados
9. Métricas de negócio detalhadas

---

## 🔗 Ferramentas Recomendadas

### Gratuitas/Open Source:
- **Sentry**: Captura de erros (plano gratuito disponível)
- **Prometheus**: Coleta de métricas
- **Grafana**: Visualização de métricas
- **OpenTelemetry**: Tracing distribuído
- **ELK Stack** (Elasticsearch, Logstash, Kibana): Logs centralizados

### Pagas (mas com planos gratuitos):
- **Sentry**: Plano gratuito até 5k eventos/mês
- **Datadog**: Plano gratuito limitado
- **New Relic**: Plano gratuito limitado

### Para Começar:
- **Sentry** é a mais fácil e importante para começar
- Depois adicionar **Prometheus + Grafana** para métricas
- Por último, **OpenTelemetry** para tracing

---

## 📚 Referências

- [Sentry Django Integration](https://docs.sentry.io/platforms/python/guides/django/)
- [Django Logging Best Practices](https://docs.djangoproject.com/en/4.2/topics/logging/)
- [OpenTelemetry Python](https://opentelemetry.io/docs/instrumentation/python/)
- [Prometheus + Django](https://github.com/korfuri/django-prometheus)

