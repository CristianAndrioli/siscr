# 🚀 Guia Rápido: Observabilidade no SISCR

## ✅ O que foi implementado

### 1. **Logging Estruturado** ✅
- Logs em formato JSON (em produção) ou texto (em desenvolvimento)
- Rotação automática de arquivos (10MB, 5 backups)
- Logs separados por tipo:
  - `logs/django.log` - Todos os logs
  - `logs/errors.log` - Apenas erros
- **Funciona automaticamente, sem configuração!**

### 2. **Dashboard de Observabilidade** ✅ **NOVO!**
- Endpoint: `http://localhost:8000/api/observability/`
- Mostra status de todos os serviços
- Mostra informações de logs
- Mostra últimos erros
- **Acessível sem autenticação!**

### 3. **Sentry (Opcional - NÃO OBRIGATÓRIO)** ⚠️
- **Você NÃO precisa criar conta no Sentry!**
- Funciona perfeitamente sem ele
- Sentry é apenas um "extra" se quiser alertas automáticos
- Configurado para ativar automaticamente se `SENTRY_DSN` estiver definido
- Captura automática de erros
- Integração com Django, Celery e Redis
- Performance monitoring (10% das transações por padrão)

### 4. **Métricas de Performance** ✅
- Middleware que coleta:
  - Tempo de resposta das requisições
  - Número de queries do banco de dados
  - Status HTTP das respostas
- Logs automáticos para requisições lentas (>1s) ou com muitas queries (>10)

### 5. **Health Check Melhorado** ✅
- Verifica: Database, Redis, Celery, Stripe, Configurações, Sentry
- Retorna tempo de resposta de cada serviço
- Informações de ambiente e versão

---

## 📋 Como Usar (Muito Simples!)

### 1. Instalar Dependências

```bash
pip install -r requirements.txt
```

Isso instalará:
- `sentry-sdk` - Para captura de erros (opcional)
- `python-json-logger` - Para logs em formato JSON

**Nota:** Se você não quiser usar Sentry, pode ignorar a parte de configuração dele. Tudo funciona sem ele!

### 2. Rodar o Sistema

Após rodar `start_dev_windows.bat`, tudo já está configurado automaticamente!

### 3. Ver Observabilidade

**Acesse no navegador:**
```
http://localhost:8000/api/observability/
```

Isso mostra TUDO: status, logs, erros, configurações!

### 4. Configurar Variáveis de Ambiente (Opcional - Apenas para Sentry)

#### Para Sentry (Totalmente Opcional - NÃO é necessário):

```bash
# .env ou variáveis de ambiente
SENTRY_DSN=https://seu-dsn@sentry.io/projeto-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% das transações (opcional)
SENTRY_RELEASE=1.0.0  # Versão da aplicação (opcional)
ENVIRONMENT=production  # development, homologation, preprod, production
```

**Como obter o SENTRY_DSN (se quiser usar):**
1. Acesse [sentry.io](https://sentry.io)
2. Crie uma conta gratuita (plano gratuito até 5k eventos/mês)
3. Crie um novo projeto (Django)
4. Copie o DSN fornecido

**⚠️ IMPORTANTE:** Você NÃO precisa fazer isso! Tudo funciona sem Sentry. Os logs estão em `logs/django.log` e `logs/errors.log`.

#### Para Logging:

O logging funciona automaticamente. Em produção, os logs serão em formato JSON.

### 3. Verificar Logs

#### Durante Desenvolvimento:

```bash
# Ver logs no console (saída padrão)
python manage.py runserver

# Ver logs do Docker
docker-compose logs -f web

# Ver apenas erros
docker-compose logs -f web | grep ERROR
```

#### Em Produção:

```bash
# Ver logs do Django
tail -f logs/django.log

# Ver apenas erros
tail -f logs/errors.log

# Ver logs em formato JSON (útil para processamento)
cat logs/django.log | jq .
```

### 4. Verificar Dashboard de Observabilidade

**Acesse no navegador:**
```
http://localhost:8000/api/observability/
```

Isso mostra:
- Status de todos os serviços
- Informações de logs (tamanho, última atualização)
- Últimos erros do sistema
- Status do Sentry (se configurado)
- Versão e ambiente

**Formato:** JSON (use uma extensão do navegador como "JSON Formatter" para ver bonito)

### 5. Verificar Health Check

```bash
# Verificar saúde do sistema
curl http://localhost:8000/api/health/

# Com autenticação (retorna headers de métricas para staff)
curl -H "Authorization: Bearer SEU_TOKEN" http://localhost:8000/api/health/
```

**Resposta exemplo:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00Z",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful",
      "response_time_ms": 2.5
    },
    "cache": {
      "status": "healthy",
      "message": "Cache (Redis) connection successful",
      "response_time_ms": 1.2
    },
    "celery": {
      "status": "healthy",
      "message": "Celery is running with 1 worker(s)",
      "workers": 1,
      "response_time_ms": 5.0
    },
    "stripe": {
      "status": "configured",
      "message": "Stripe is configured",
      "mode": "test"
    },
    "sentry": {
      "status": "configured",
      "message": "Sentry error tracking is configured"
    }
  },
  "health_check_duration_ms": 15.3
}
```

### 6. Ver Métricas de Performance

O middleware de métricas registra automaticamente:

- **Requisições lentas** (>1 segundo) → Log WARNING
- **Muitas queries** (>10 queries) → Log WARNING
- **Erros HTTP** (status >= 400) → Log WARNING
- **Exceções** → Log ERROR com stack trace

**Exemplo de log:**
```json
{
  "levelname": "WARNING",
  "asctime": "2024-01-20T10:30:00Z",
  "name": "core.middleware_metrics",
  "message": "[METRICS] Requisição lenta ou com muitas queries",
  "method": "GET",
  "path": "/api/cadastros/pessoas/",
  "status_code": 200,
  "duration_ms": 1250.5,
  "query_count": 15,
  "tenant": "teste_tenant",
  "user_id": 1,
  "username": "admin"
}
```

### 7. Usar Sentry (Opcional)

Após configurar o `SENTRY_DSN`, o Sentry captura automaticamente:

- **Erros não tratados** (exceções)
- **Erros 500** do Django
- **Performance** de requisições (se habilitado)

**Acesse o dashboard do Sentry** para ver:
- Lista de erros
- Stack traces completos
- Contexto da requisição (tenant, usuário, etc.)
- Frequência de erros
- Alertas configurados

---

## 🔍 Exemplos de Uso

### Logging Manual

```python
import logging

logger = logging.getLogger(__name__)

# Log de informação
logger.info("Usuário fez login", extra={
    'user_id': user.id,
    'tenant': tenant.schema_name
})

# Log de erro
logger.error("Erro ao processar pagamento", extra={
    'payment_id': payment.id,
    'error': str(e)
}, exc_info=True)  # Inclui stack trace
```

### Verificar Métricas em Código

```python
from django.core.cache import cache

# Armazenar métrica customizada
cache.set(f'metrics:signups:{date}', count, timeout=86400)

# Recuperar métrica
signups_today = cache.get(f'metrics:signups:{date}', 0)
```

---

## 🎯 Próximos Passos (Opcional)

### 1. Configurar Alertas no Sentry
- Acesse Sentry → Settings → Alerts
- Configure alertas para:
  - Erros críticos
  - Aumento súbito de erros
  - Performance degradada

### 2. Adicionar Métricas Customizadas
- Use o middleware como base
- Adicione métricas de negócio (signups, pagamentos, etc.)
- Integre com Prometheus (futuro)

### 3. Dashboards
- Use Grafana para visualizar métricas
- Configure dashboards por tenant
- Monitore tendências

---

## ❓ Troubleshooting

### Logs não aparecem
- Verifique se a pasta `logs/` existe e tem permissão de escrita
- Verifique o nível de log no `settings.py`
- Em produção, verifique se `ENVIRONMENT=production`

### Sentry não captura erros
- Verifique se `SENTRY_DSN` está configurado corretamente
- Verifique se `sentry-sdk` está instalado
- Veja os logs do Django para erros de inicialização do Sentry

### Health check falha
- Verifique se todos os serviços estão rodando (DB, Redis)
- Verifique as configurações no `settings.py`
- Veja os logs para detalhes do erro

---

## 📚 Referências

- [Documentação Completa de Observabilidade](./OBSERVABILIDADE.md)
- [Sentry Django Docs](https://docs.sentry.io/platforms/python/guides/django/)
- [Django Logging](https://docs.djangoproject.com/en/4.2/topics/logging/)

