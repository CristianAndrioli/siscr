# ✅ Implementação: Separação de Dados por Filial

## 📋 Resumo

Implementação completa da separação de dados por empresa/filial dentro do mesmo tenant.

## ✅ O que foi implementado

### 1. **Modelos Atualizados**
- ✅ Adicionados campos `empresa` e `filial` (opcionais) em:
  - `Pessoa`
  - `Produto`
  - `Servico`
  - `ContaReceber`
  - `ContaPagar`
- ✅ Índices criados para performance nas queries

### 2. **Migrations**
- ✅ Migration criada: `0003_alter_produto_options_alter_servico_options_and_more.py`
- ✅ Campos adicionados como `null=True` para compatibilidade com dados existentes

### 3. **Utilitários**
- ✅ `cadastros/utils.py` criado com:
  - `filter_by_empresa_filial()`: Filtra queries por empresa/filial
  - `get_current_empresa_filial()`: Obtém empresa/filial atual do usuário

### 4. **APIs Atualizadas**
- ✅ Todos os ViewSets agora filtram automaticamente por empresa/filial:
  - `PessoaViewSet`
  - `ProdutoViewSet`
  - `ServicoViewSet`
  - `ContaReceberViewSet`
  - `ContaPagarViewSet`

### 5. **Serializers Atualizados**
- ✅ Todos os serializers definem automaticamente `empresa`/`filial` na criação se não fornecidos
- ✅ Usa `current_empresa`/`current_filial` do `UserProfile`

### 6. **Admin Django**
- ✅ Filtros por empresa/filial adicionados em todos os modelos
- ✅ Colunas empresa/filial exibidas nas listagens

### 7. **Script de Migração**
- ✅ Comando `migrate_empresa_filial` criado para migrar dados existentes
- ✅ Opção para associar à primeira empresa/filial ou manter como compartilhados

## 🚀 Como usar

### Aplicar Migrations

```bash
# Aplicar no schema compartilhado (se necessário)
docker-compose exec web python manage.py migrate_schemas --shared

# Aplicar em um tenant específico
docker-compose exec web python manage.py migrate_schemas --schema=teste_tenant
```

### Migrar Dados Existentes

```bash
# Opção 1: Manter dados como compartilhados (padrão)
docker-compose exec web python manage.py migrate_empresa_filial --schema=teste_tenant

# Opção 2: Associar à primeira empresa/filial
docker-compose exec web python manage.py migrate_empresa_filial --schema=teste_tenant --associate-to-first

# Migrar todos os tenants
docker-compose exec web python manage.py migrate_empresa_filial
```

## 📊 Lógica de Filtragem

### Com Filial Selecionada:
- Mostra dados da filial específica
- Mostra dados compartilhados da empresa (filial=None, empresa=filial.empresa)
- Mostra dados totalmente compartilhados (empresa=None, filial=None)

### Com Apenas Empresa Selecionada:
- Mostra dados da empresa (todas as filiais)
- Mostra dados compartilhados (empresa=None)

### Sem Empresa/Filial:
- Mostra apenas dados compartilhados (empresa=None, filial=None)

## 🔍 Exemplo Prático

```
Tenant: "Grupo ABC"
├── Empresa: "ABC Comércio"
│   ├── Filial: "Matriz"
│   │   └── Pessoa: "João Silva" (empresa=ABC, filial=Matriz)
│   ├── Filial: "Loja Norte"
│   │   └── Pessoa: "Maria Santos" (empresa=ABC, filial=Loja Norte)
│   └── Produto: "Notebook Dell" (empresa=ABC, filial=None) ← COMPARTILHADO
```

**Usuário na Filial "Matriz" vê:**
- João Silva (filial específica)
- Notebook Dell (compartilhado da empresa)

**Usuário na Filial "Loja Norte" vê:**
- Maria Santos (filial específica)
- Notebook Dell (compartilhado da empresa)

## ⚠️ Importante

1. **Dados existentes**: Serão mantidos como compartilhados (empresa=None, filial=None) até migração
2. **Novos dados**: Automaticamente associados à empresa/filial atual do usuário
3. **Compatibilidade**: Campos são opcionais, então dados antigos continuam funcionando

## 📝 Próximos Passos (Opcional)

- [ ] Adicionar validação para garantir que filial pertence à empresa
- [ ] Criar interface no frontend para selecionar empresa/filial ao criar registros
- [ ] Adicionar relatórios consolidados por empresa/filial
- [ ] Implementar permissões por empresa/filial

