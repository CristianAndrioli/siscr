# 🚀 Próximos Passos - Melhorias do Dashboard

## ✅ O que JÁ está implementado

- ✅ Logging estruturado
- ✅ Dashboard visual básico
- ✅ Health check melhorado
- ✅ Estatísticas do banco de dados
- ✅ Estatísticas de tenants
- ✅ Gráfico simples de erros
- ✅ Auto-refresh
- ✅ Middleware de métricas

---

## 🎯 Próximos Passos (Priorizados)

### **FASE 1: Métricas de Performance** (1-2 dias) ⚡

#### 1.1 Gráfico de Tempo de Resposta
**O que fazer:**
- Armazenar tempo de resposta das últimas 100 requisições no Redis
- Criar gráfico de linha mostrando tendência
- Mostrar tempo médio, mínimo e máximo

**Como implementar:**
```python
# No middleware_metrics.py
# Após calcular duration, salvar no Redis:
cache.lpush('metrics:response_times', duration)
cache.ltrim('metrics:response_times', 0, 99)  # Manter apenas 100

# No dashboard, recuperar e plotar:
response_times = cache.lrange('metrics:response_times', 0, -1)
```

**Benefício:** Ver performance em tempo real

---

#### 1.2 Top 10 Requisições Mais Lentas
**O que fazer:**
- Armazenar requisições lentas (>500ms) no Redis
- Mostrar lista ordenada por tempo
- Incluir endpoint, método, tenant, usuário

**Como implementar:**
```python
# No middleware, se duration > 0.5:
slow_request = {
    'path': path,
    'method': method,
    'duration': duration,
    'timestamp': timezone.now().isoformat(),
    'tenant': tenant_name,
}
cache.lpush('metrics:slow_requests', json.dumps(slow_request))
cache.ltrim('metrics:slow_requests', 0, 9)  # Top 10
```

**Benefício:** Identificar endpoints problemáticos rapidamente

---

#### 1.3 Endpoints Mais Acessados
**O que fazer:**
- Contar requisições por endpoint
- Mostrar top 10 endpoints
- Incluir número de requisições e tempo médio

**Como implementar:**
```python
# No middleware:
endpoint_key = f'metrics:endpoint:{path}'
cache.incr(endpoint_key)
cache.expire(endpoint_key, 86400)  # 24 horas

# No dashboard, buscar top 10:
# Usar SCAN ou armazenar em sorted set do Redis
```

**Benefício:** Entender quais APIs são mais usadas

---

### **FASE 2: Análise de Erros Avançada** (1 dia) 📉

#### 2.1 Gráfico de Erros por Hora
**O que fazer:**
- Analisar logs das últimas 24 horas
- Agrupar erros por hora
- Criar gráfico de linha mostrando tendência

**Como implementar:**
```python
# Analisar logs/errors.log
# Extrair timestamp de cada erro
# Agrupar por hora
# Retornar dados para Chart.js
```

**Benefício:** Ver padrões temporais de erros

---

#### 2.2 Tipos de Erros Mais Comuns
**O que fazer:**
- Extrair tipo de exceção dos logs
- Contar ocorrências de cada tipo
- Mostrar top 5 tipos de erro

**Como implementar:**
```python
# Analisar logs/errors.log
# Extrair Exception type (ex: "ValueError", "KeyError")
# Contar ocorrências
# Retornar para gráfico de barras
```

**Benefício:** Identificar problemas recorrentes

---

### **FASE 3: Métricas de Sistema** (1 dia) 💻

#### 3.1 Uso de Recursos (CPU, Memória, Disco)
**O que fazer:**
- Usar biblioteca `psutil` para coletar métricas
- Mostrar uso atual e gráfico de tendência
- Alertas visuais quando uso > 80%

**Como implementar:**
```python
# Adicionar ao requirements.txt:
# psutil>=5.9.0

# No dashboard:
import psutil
stats = {
    'cpu_percent': psutil.cpu_percent(interval=1),
    'memory_mb': psutil.virtual_memory().used / 1024 / 1024,
    'disk_percent': psutil.disk_usage('/').percent,
}
```

**Benefício:** Detectar problemas de infraestrutura antes que afetem usuários

---

#### 3.2 Métricas de Redis/Cache
**O que fazer:**
- Taxa de hit/miss do cache
- Tamanho do cache usado
- Performance do Redis

**Como implementar:**
```python
# Usar comandos Redis:
import redis
r = redis.from_url(settings.REDIS_URL)
info = r.info('stats')
cache_hits = info.get('keyspace_hits', 0)
cache_misses = info.get('keyspace_misses', 0)
hit_rate = cache_hits / (cache_hits + cache_misses) * 100
```

**Benefício:** Otimizar uso de cache

---

### **FASE 4: Métricas de Celery** (1 dia) ⚙️

#### 4.1 Status de Tarefas
**O que fazer:**
- Tarefas em fila
- Tarefas processadas (última hora)
- Tarefas falhadas
- Tempo médio de processamento

**Como implementar:**
```python
from celery import current_app
inspect = current_app.control.inspect()

# Tarefas ativas
active = inspect.active()

# Tarefas reservadas (em fila)
reserved = inspect.reserved()

# Estatísticas
stats = inspect.stats()
```

**Benefício:** Monitorar tarefas assíncronas

---

### **FASE 5: Histórico e Tendências** (1-2 dias) 📊

#### 5.1 Histórico de Health Checks
**O que fazer:**
- Salvar últimos 50 health checks no Redis
- Gráfico de disponibilidade (úptime)
- Tempo de resposta histórico

**Como implementar:**
```python
# Após health check:
health_data = {
    'timestamp': timezone.now().isoformat(),
    'status': 'healthy',
    'duration': duration,
}
cache.lpush('metrics:health_history', json.dumps(health_data))
cache.ltrim('metrics:health_history', 0, 49)
```

**Benefício:** Ver tendências de saúde do sistema

---

#### 5.2 Comparação Temporal
**O que fazer:**
- Comparar métricas de hoje vs ontem
- Indicadores de tendência (↑ ↓)
- Percentual de mudança

**Como implementar:**
```python
# Armazenar métricas diárias
today_key = f'metrics:daily:{date.today()}'
yesterday_key = f'metrics:daily:{date.today() - timedelta(days=1)}'

# Calcular diferença percentual
change = ((today_value - yesterday_value) / yesterday_value) * 100
```

**Benefício:** Entender crescimento/mudanças

---

## 📋 Plano de Implementação Recomendado

### **Semana 1: Performance**
1. ✅ Gráfico de tempo de resposta (2h)
2. ✅ Top 10 requisições lentas (2h)
3. ✅ Endpoints mais acessados (2h)

### **Semana 2: Erros e Sistema**
4. ✅ Gráfico de erros por hora (2h)
5. ✅ Tipos de erros mais comuns (1h)
6. ✅ Uso de recursos do sistema (2h)

### **Semana 3: Avançado**
7. ✅ Métricas de Redis (1h)
8. ✅ Métricas de Celery (2h)
9. ✅ Histórico de health checks (2h)

---

## 🛠️ Ferramentas Necessárias

### Bibliotecas Python:
```bash
pip install psutil>=5.9.0  # Para métricas de sistema
```

### Redis:
- Já está configurado ✅
- Usar para armazenar métricas temporárias

### Chart.js:
- Já está incluído no template ✅
- Usar para criar gráficos

---

## 💡 Dicas de Implementação

### 1. **Armazenar Métricas no Redis**
```python
# Estrutura recomendada:
# metrics:response_times - Lista de tempos
# metrics:slow_requests - Lista de requisições lentas
# metrics:endpoint:{path} - Contador por endpoint
# metrics:health_history - Histórico de health checks
# metrics:daily:{date} - Métricas diárias
```

### 2. **Limpar Dados Antigos**
```python
# No middleware ou task periódica:
# Remover dados com mais de 7 dias
# Usar TTL do Redis ou limpeza manual
```

### 3. **Performance**
- Não armazenar todas as requisições (apenas amostras)
- Usar agregações (média, min, max)
- Limitar tamanho das listas no Redis

---

## 🎯 Quick Wins (Implementar Primeiro)

### 1. **Gráfico de Tempo de Resposta** (Mais Fácil)
- ✅ Middleware já coleta dados
- ✅ Só precisa armazenar e plotar
- ✅ Impacto alto (ver performance)

### 2. **Top 10 Requisições Lentas** (Muito Útil)
- ✅ Middleware já identifica requisições lentas
- ✅ Só precisa armazenar e exibir
- ✅ Impacto alto (debug rápido)

### 3. **Uso de Recursos** (Importante)
- ✅ Biblioteca psutil é simples
- ✅ Dados úteis para monitoramento
- ✅ Impacto médio-alto

---

## 📚 Exemplos de Código

### Exemplo: Armazenar Métricas no Redis
```python
# core/middleware_metrics.py
import json
from django.core.cache import cache
from django.utils import timezone

def store_metrics(path, method, duration, status_code):
    # Tempo de resposta
    cache.lpush('metrics:response_times', duration)
    cache.ltrim('metrics:response_times', 0, 99)
    
    # Requisições lentas
    if duration > 0.5:
        slow_req = {
            'path': path,
            'method': method,
            'duration': round(duration * 1000, 2),
            'status': status_code,
            'timestamp': timezone.now().isoformat(),
        }
        cache.lpush('metrics:slow_requests', json.dumps(slow_req))
        cache.ltrim('metrics:slow_requests', 0, 9)
    
    # Contador por endpoint
    endpoint_key = f'metrics:endpoint_count:{path}'
    cache.incr(endpoint_key)
    cache.expire(endpoint_key, 86400)  # 24h
```

### Exemplo: Recuperar Métricas no Dashboard
```python
# core/api/views.py
import json
from django.core.cache import cache

def get_performance_metrics():
    # Tempos de resposta
    response_times = [
        float(t) * 1000  # Converter para ms
        for t in cache.lrange('metrics:response_times', 0, -1)
    ]
    
    # Requisições lentas
    slow_requests = [
        json.loads(r)
        for r in cache.lrange('metrics:slow_requests', 0, -1)
    ]
    
    return {
        'response_times': response_times,
        'slow_requests': slow_requests,
        'avg_response_time': sum(response_times) / len(response_times) if response_times else 0,
    }
```

---

## 🚀 Começar Agora

**Recomendação:** Comece com o **Gráfico de Tempo de Resposta** - é simples, útil e já temos os dados coletados!

Quer que eu implemente alguma dessas melhorias agora? 🎯

