# 📋 Scripts de Gerenciamento - SISCR

Este documento descreve os scripts disponíveis para gerenciar o ambiente de desenvolvimento.

## 🚀 Scripts Principais

### `start_dev_windows.bat`
Inicia o ambiente de desenvolvimento completo.

**O que faz:**
- Verifica se Docker está instalado e rodando
- Verifica e resolve conflitos de portas (PostgreSQL, Redis, Django)
- Inicia containers Docker
- Aplica migrações
- (Opcional) Executa seed de dados se `--seed-dev` for passado

**Uso normal (sem seed):**
```batch
start_dev_windows.bat
```

**Uso com seed de desenvolvimento:**
```batch
start_dev_windows.bat --seed-dev
```
ou
```batch
start_dev_windows.bat -s
```

**O que o seed inclui (quando `--seed-dev` é usado):**
- Cria dados compartilhados (planos, features, subscriptions)
- Cria 3 tenants completos com dados realistas:
  - Comércio Simples (1 empresa, 1 filial)
  - Grupo Expansão (1 empresa, 2 filiais)
  - Holding Diversificada (2 empresas, 2 filiais cada)
- Cria locations de estoque para os tenants

**⚠️ Nota:** O seed só é executado se o parâmetro `--seed-dev` for passado. Isso permite iniciar o ambiente sem criar dados de teste.

**Futuro:** Será adicionado `--seed-prod` para seed de produção.

---

### `stop_dev_windows.bat`
Para a aplicação e containers Docker.

**O que faz:**
- Para todos os containers Docker do projeto
- Informa sobre processos do frontend

**Uso normal:**
```batch
stop_dev_windows.bat
```

**Uso com reset do banco:**
```batch
stop_dev_windows.bat --reset
```
ou
```batch
stop_dev_windows.bat -r
```
ou
```batch
stop_dev_windows.bat reset
```

**⚠️ ATENÇÃO:** A opção `--reset` irá:
- Parar todos os containers
- **APAGAR COMPLETAMENTE o banco de dados** (volume `postgres_data`)
- Pedir confirmação antes de executar
- Esta ação é **IRREVERSÍVEL**

**Garantias de segurança:**
- Apenas afeta o banco `siscr_db`
- Apenas afeta containers Docker do projeto SISCR
- Não afeta outros bancos PostgreSQL no sistema
- Não afeta outros containers Docker

---

---

---

## 🔄 Fluxo de Trabalho Recomendado

### Primeira vez / Reset completo:
```batch
# 1. Parar e resetar banco
stop_dev_windows.bat --reset

# 2. Iniciar ambiente com seed (cria tudo do zero)
start_dev_windows.bat --seed-dev
```

### Desenvolvimento normal:
```batch
# 1. Iniciar ambiente (sem seed - mais rápido)
start_dev_windows.bat

# 2. Se precisar criar dados de teste
start_dev_windows.bat --seed-dev

# 3. Parar ambiente
stop_dev_windows.bat
```

### Apenas iniciar (sem seed):
```batch
start_dev_windows.bat
```

### Apenas parar (sem apagar dados):
```batch
stop_dev_windows.bat
```

---

## 📝 Notas Importantes

1. **Senha padrão:** Todos os usuários criados pelo seed usam a senha `admin123`

2. **Portas:** O script `start_dev_windows.bat` verifica automaticamente portas disponíveis:
   - PostgreSQL: 5432 (ou próxima disponível)
   - Redis: 6379 (ou próxima disponível)
   - Django: 8000 (ou próxima disponível)

3. **Volumes Docker:** O volume `postgres_data` contém todos os dados do banco. Quando removido, todos os dados são perdidos permanentemente.

4. **Frontend:** O frontend deve ser iniciado manualmente em uma janela separada. O script de stop apenas informa sobre processos Node.js.

---

## 🆘 Troubleshooting

### Containers não iniciam:
```batch
# Verificar se Docker está rodando
docker ps

# Verificar logs
docker-compose logs

# Recriar containers
docker-compose down
docker-compose up -d --build
```

### Erro de portas:
O script `start_dev_windows.bat` detecta e resolve automaticamente conflitos de portas.

### Banco de dados corrompido:
```batch
# Resetar completamente
stop_dev_windows.bat --reset
start_dev_windows.bat
```

### Migrações com problemas:
```batch
# Aplicar migrações manualmente
docker-compose exec web python manage.py migrate_schemas --shared
docker-compose exec web python manage.py migrate_schemas
```

---

## 🔐 Segurança

Todos os scripts incluem verificações de segurança:
- Verificam se estão no diretório correto do projeto
- Confirmam que apenas afetam recursos do projeto SISCR
- Pedem confirmação antes de ações destrutivas (reset)
- Validam ambiente antes de executar
