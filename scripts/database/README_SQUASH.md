# 🔄 Squash de Migrações

Este documento explica como consolidar todas as migrações em uma única migração inicial por app.

## 📋 O que é Squash de Migrações?

O squash de migrações é o processo de consolidar múltiplas migrações em uma única migração inicial. Isso é útil quando:

- Você tem muitas migrações pequenas que podem ser consolidadas
- Você quer simplificar o histórico de migrações
- Você está preparando para produção e quer uma migração limpa

## ⚠️ ATENÇÃO

**Este processo é IRREVERSÍVEL** (mas faz backup automático). Use apenas em:

- Ambiente de desenvolvimento
- Antes de fazer deploy para produção pela primeira vez
- Quando você tem certeza de que não precisa do histórico de migrações

## 🚀 Como Usar

### Windows

```bash
scripts\database\squash_migrations.bat
```

### Linux/Mac

```bash
python scripts/database/squash_migrations.py
```

## 📝 O que o Script Faz

1. **Faz backup** de todas as migrações atuais em `database/migrations_backup/`
2. **Remove** todas as migrações (exceto `__init__.py`)
3. **Gera** novas migrações iniciais usando `makemigrations`
4. **Verifica** se as novas migrações foram criadas

## 📦 Apps Processados

O script processa os seguintes apps:

- `accounts`
- `cadastros`
- `estoque`
- `faturamento`
- `financeiro`
- `payments`
- `public`
- `reports`
- `subscriptions`
- `tenants`
- `vendas`

## ✅ Verificação

Após executar o script, verifique:

1. **Migrações criadas**: Cada app deve ter apenas `0001_initial.py`
2. **Backup**: Verifique se o backup foi criado em `database/migrations_backup/`
3. **Teste**: Execute `reset_database_windows.bat` e `start_dev_windows.bat` para testar

## 🔄 Restaurar Backup

Se algo der errado, você pode restaurar o backup:

```bash
# Windows
xcopy database\migrations_backup\* .\ /E /I /Y

# Linux/Mac
cp -r database/migrations_backup/* .
```

## 📋 Próximos Passos

Após o squash:

1. **Teste em banco limpo**: Use `reset_database_windows.bat`
2. **Aplique migrações**: Execute `start_dev_windows.bat`
3. **Verifique dados**: Confirme que tudo está funcionando
4. **Remova backup**: Se tudo estiver OK, delete `database/migrations_backup/`

## 🐛 Problemas Comuns

### Erro: "No changes detected"

**Causa**: As migrações já foram geradas ou não há mudanças nos modelos.

**Solução**: 
- Verifique se os modelos estão corretos
- Tente `makemigrations --empty` para criar migração vazia

### Erro: "Container não está rodando"

**Causa**: Docker não está iniciado.

**Solução**: Execute `docker-compose up -d` antes de rodar o script.

### Migrações não foram criadas

**Causa**: Pode haver problemas com os modelos ou dependências.

**Solução**:
1. Verifique os logs: `docker-compose logs web`
2. Tente gerar manualmente: `docker-compose exec web python manage.py makemigrations`
3. Verifique se há erros de sintaxe nos modelos

