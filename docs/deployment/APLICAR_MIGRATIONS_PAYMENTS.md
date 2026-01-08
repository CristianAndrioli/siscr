# 🗄️ Como Aplicar Migrations do App Payments

## 📋 Pré-requisitos

1. Docker Compose rodando
2. Container `web` ativo
3. Banco de dados acessível

---

## 🚀 Método 1: Script Automatizado (Recomendado)

### Windows
```bash
scripts\apply_payments_migrations.bat
```

### Linux/Mac
```bash
chmod +x scripts/apply_payments_migrations.sh
./scripts/apply_payments_migrations.sh
```

---

## 🔧 Método 2: Manual

### 1. Criar Migrations
```bash
docker-compose exec web python manage.py makemigrations payments
```

### 2. Aplicar no Schema Público
```bash
docker-compose exec web python manage.py migrate_schemas --shared
```

### 3. Verificar
```bash
docker-compose exec web python manage.py showmigrations payments
```

---

## ✅ Verificação

### 1. Verificar no Admin
Acesse: `http://localhost:8000/admin/payments/`

Você deve ver:
- Payment Methods
- Payments
- Invoices

### 2. Verificar no Banco
```bash
docker-compose exec db psql -U postgres -d siscr_db -c "\dt payments_*"
```

Deve listar:
- `payments_paymentmethod`
- `payments_payment`
- `payments_invoice`

### 3. Testar API
```bash
curl http://localhost:8000/api/payments/payment-methods/
```

---

## 🐛 Problemas Comuns

### Erro: "Container 'web' não está rodando"
**Solução**: Inicie o Docker Compose
```bash
docker-compose up -d
```

### Erro: "No changes detected"
**Causa**: Migrations já foram criadas
**Solução**: Pule a etapa de criação e aplique diretamente

### Erro: "relation already exists"
**Causa**: Tabelas já existem
**Solução**: 
```bash
# Verificar migrations aplicadas
docker-compose exec web python manage.py showmigrations payments

# Se necessário, marcar como aplicadas
docker-compose exec db psql -U postgres -d siscr_db -c "INSERT INTO django_migrations (app, name, applied) VALUES ('payments', '0001_initial', NOW());"
```

---

## 📝 Próximos Passos

Após aplicar as migrations:

1. ✅ Verificar no admin
2. ✅ Testar criação de payment method
3. ✅ Testar criação de subscription
4. ✅ Configurar webhook no Stripe (se em produção/test)

---

**Última atualização**: 2025-11-14

