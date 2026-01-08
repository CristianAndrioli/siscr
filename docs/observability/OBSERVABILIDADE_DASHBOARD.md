# 📊 Dashboard de Observabilidade - Como Usar

## 🎯 Acessar o Dashboard

### Versão HTML (Recomendada - Visual Bonito)
```
http://localhost:8000/api/observability/
```
ou
```
http://localhost:8000/api/observability/?format=html
```

**O que você verá:**
- ✅ Interface visual bonita com cards coloridos
- ✅ Status de todos os serviços (Database, Redis, Celery, Stripe)
- ✅ Informações de logs (tamanho, últimos erros)
- ✅ Status do Sentry
- ✅ Links úteis para outras páginas

### Versão JSON (Para APIs/Integração)
```
http://localhost:8000/api/observability/?format=json
```
ou
```
curl -H "Accept: application/json" http://localhost:8000/api/observability/
```

**O que você receberá:**
- JSON com todas as métricas
- Útil para integração com outras ferramentas
- Mesmos dados da versão HTML, mas em formato JSON

---

## 📋 O que o Dashboard Mostra

### 1. **Status Geral do Sistema** 🏥
- Indica se o sistema está saudável ou com problemas
- Tempo de execução do health check

### 2. **Status dos Serviços** 🔧
Mostra o status de cada serviço:
- **Database** - Conexão com PostgreSQL
- **Cache** - Conexão com Redis
- **Celery** - Workers de tarefas assíncronas
- **Stripe** - Configuração do gateway de pagamento
- **Configuration** - Configurações básicas
- **Sentry** - Status do error tracking

Cada serviço mostra:
- Status (Healthy, Unhealthy, Degraded, etc.)
- Mensagem descritiva
- Tempo de resposta (se aplicável)
- Número de workers (para Celery)

### 3. **Sistema de Logs** 📝
- Status do sistema de logging (Ativo/Desativado)
- Tamanho dos arquivos de log:
  - `django.log` - Todos os logs
  - `errors.log` - Apenas erros
- Últimos erros registrados (se houver)

### 4. **Sentry (Error Tracking)** 🔔
- Se está configurado ou não
- Instruções de como ativar (se não estiver configurado)

### 5. **Links Úteis** 🔗
- Health Check
- JSON API
- Django Admin
- API Root

---

## 🎨 Cores e Status

O dashboard usa cores para indicar status:

- 🟢 **Verde (Healthy)** - Serviço funcionando perfeitamente
- 🔴 **Vermelho (Unhealthy)** - Serviço com problemas
- 🟡 **Amarelo (Degraded)** - Serviço funcionando mas com limitações
- 🔵 **Azul (Configured)** - Serviço configurado e ativo
- ⚪ **Cinza (Not Configured)** - Serviço não configurado (normal se opcional)

---

## 🔄 Atualização Automática

O dashboard mostra os dados no momento em que você acessa.

**Para atualizar:**
- Recarregue a página (F5 ou Ctrl+R)
- Ou descomente o auto-refresh no código (atualiza a cada 30 segundos)

---

## 💡 Dicas

### Ver JSON no Navegador
Se você tem uma extensão como "JSON Formatter" instalada, o JSON será formatado automaticamente.

### Integrar com Outras Ferramentas
Use a versão JSON para integrar com:
- Monitoramento externo (Prometheus, Grafana)
- Alertas automáticos
- Dashboards customizados

### Ver Logs em Tempo Real
Enquanto o dashboard mostra informações gerais, para ver logs em tempo real:
```bash
# Docker
docker-compose logs -f web

# Arquivo local
tail -f logs/django.log
```

---

## ❓ Problemas Comuns

### Dashboard mostra apenas JSON
**Solução:** Acesse sem o parâmetro `format=json` ou adicione `?format=html`

### Template não encontrado
**Solução:** Verifique se o arquivo existe em `core/templates/observability_dashboard.html`

### Erros não aparecem
**Solução:** Verifique se o arquivo `logs/errors.log` existe e tem conteúdo

---

## 🚀 Próximos Passos

1. **Acesse o dashboard** e veja todas as métricas
2. **Monitore regularmente** para detectar problemas
3. **Configure Sentry** (opcional) se quiser alertas automáticos
4. **Integre com ferramentas externas** usando a versão JSON

---

## 📚 Referências

- [Guia Simples de Observabilidade](./OBSERVABILIDADE_SIMPLES.md)
- [Guia Rápido Completo](./OBSERVABILIDADE_GUIA_RAPIDO.md)
- [Documentação Completa](./OBSERVABILIDADE.md)

