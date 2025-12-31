# 📊 Observabilidade - Guia Simples

## ✅ O que você TEM (sem precisar de conta no Sentry)

### 1. **Logs Automáticos** 📝
Os logs são salvos automaticamente na pasta `logs/`:
- `logs/django.log` - Todos os logs do sistema
- `logs/errors.log` - Apenas erros

**Como ver:**
```bash
# Ver todos os logs
tail -f logs/django.log

# Ver apenas erros
tail -f logs/errors.log

# Ver últimas 50 linhas
tail -n 50 logs/django.log
```

### 2. **Health Check** 🏥
Endpoint que verifica se tudo está funcionando:
```
http://localhost:8000/api/health/
```

**O que mostra:**
- Status do banco de dados
- Status do Redis
- Status do Celery
- Status do Stripe
- Tempo de resposta de cada serviço

### 3. **Dashboard de Observabilidade** 📊
**NOVO!** Página que mostra todas as métricas:
```
http://localhost:8000/api/observability/
```

**O que mostra:**
- Status de todos os serviços
- Informações de logging
- Status do Sentry (se configurado)
- Últimos erros do sistema
- Versão e ambiente

### 4. **Métricas de Performance** ⚡
O sistema registra automaticamente:
- Requisições lentas (>1 segundo)
- Requisições com muitas queries (>10)
- Erros HTTP (status >= 400)
- Exceções

**Onde ver:** Nos logs (`logs/django.log`)

---

## ❓ Por que Sentry é Opcional?

**Sentry é uma ferramenta EXTERNA** que ajuda a:
- Ver erros em tempo real em um dashboard web
- Receber alertas por email/Slack quando há erros
- Ver stack traces completos com contexto

**MAS você NÃO PRECISA dele!** 

Você pode ver tudo nos logs locais:
- ✅ Erros → `logs/errors.log`
- ✅ Logs gerais → `logs/django.log`
- ✅ Status do sistema → `/api/health/`
- ✅ Dashboard completo → `/api/observability/`

**Sentry é útil se:**
- Você quer alertas automáticos
- Você quer ver erros em um dashboard web bonito
- Você tem múltiplos servidores e quer centralizar logs

**Sentry NÃO é necessário se:**
- Você está em desenvolvimento local
- Você prefere ver logs nos arquivos
- Você não quer criar conta externa

---

## 🎯 Onde Ver Observabilidade (Sem Sentry)

### 1. **Dashboard de Observabilidade** (Recomendado)
```
http://localhost:8000/api/observability/
```

Esta página mostra TUDO em formato JSON:
- Status de serviços
- Informações de logs
- Últimos erros
- Configurações

### 2. **Health Check**
```
http://localhost:8000/api/health/
```

Verifica se todos os serviços estão funcionando.

### 3. **Arquivos de Log**
```
logs/django.log    - Todos os logs
logs/errors.log    - Apenas erros
```

### 4. **No Terminal (Docker)**
```bash
# Ver logs em tempo real
docker-compose logs -f web

# Ver apenas erros
docker-compose logs -f web | grep ERROR

# Ver últimas 100 linhas
docker-compose logs --tail=100 web
```

---

## 🚀 Como Usar (Passo a Passo)

### 1. Após rodar `start_dev_windows.bat`:

Os logs já estão configurados automaticamente! A pasta `logs/` será criada automaticamente.

### 2. Acesse o Dashboard:

Abra no navegador:
```
http://localhost:8000/api/observability/
```

Você verá algo como:
```json
{
  "system": {
    "version": "1.0.0",
    "environment": "development",
    "debug": true
  },
  "health": {
    "status": "healthy",
    "services": {
      "database": { "status": "healthy" },
      "cache": { "status": "healthy" }
    }
  },
  "logging": {
    "enabled": true,
    "django_log": { "size_mb": 0.5 },
    "errors_log": { "size_mb": 0.1 }
  },
  "sentry": {
    "enabled": false,
    "message": "Sentry não está configurado (opcional)"
  }
}
```

### 3. Ver Logs:

```bash
# No terminal do Windows
type logs\django.log

# Ou use um editor de texto
notepad logs\errors.log
```

### 4. Ver Health Check:

```
http://localhost:8000/api/health/
```

---

## 📋 Resumo: O que Funciona SEM Sentry

| Funcionalidade | Onde Ver | Status |
|---------------|----------|--------|
| **Logs** | `logs/django.log` | ✅ Automático |
| **Erros** | `logs/errors.log` | ✅ Automático |
| **Health Check** | `/api/health/` | ✅ Funciona |
| **Dashboard** | `/api/observability/` | ✅ Funciona |
| **Métricas de Performance** | `logs/django.log` | ✅ Automático |
| **Alertas** | ❌ Não tem (precisa Sentry) | ⚠️ Opcional |
| **Dashboard Web** | ❌ Não tem (precisa Sentry) | ⚠️ Opcional |

---

## 💡 Dica: Melhorar Visualização

Se quiser ver o JSON do dashboard de forma mais bonita:

1. **Instale uma extensão do navegador:**
   - Chrome: "JSON Formatter"
   - Firefox: "JSONView"

2. **Ou use curl:**
```bash
curl http://localhost:8000/api/observability/ | python -m json.tool
```

3. **Ou crie uma página HTML simples** (futuro):
   - Podemos criar uma página HTML que formata o JSON de forma bonita
   - Acessível em `/observability/` (sem `/api/`)

---

## ❓ FAQ

**P: Preciso criar conta no Sentry?**
R: **NÃO!** É totalmente opcional. Tudo funciona sem ele.

**P: Onde vejo os erros então?**
R: Em `logs/errors.log` ou no dashboard `/api/observability/`

**P: Os logs são criados automaticamente?**
R: **SIM!** A pasta `logs/` é criada automaticamente quando o sistema inicia.

**P: Posso ver métricas em tempo real?**
R: Sim! Use `tail -f logs/django.log` (Linux/Mac) ou `Get-Content logs\django.log -Wait` (PowerShell)

**P: O dashboard mostra tudo?**
R: Sim! Acesse `/api/observability/` para ver status completo do sistema.

---

## 🎯 Conclusão

**Você NÃO precisa de Sentry!** 

Tudo funciona perfeitamente com:
- ✅ Logs em arquivos
- ✅ Health check endpoint
- ✅ Dashboard de observabilidade
- ✅ Métricas automáticas

Sentry é apenas um "extra" se você quiser alertas e dashboard web externo.

