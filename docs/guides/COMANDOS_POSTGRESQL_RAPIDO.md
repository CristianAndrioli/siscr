# 🚀 Comandos PostgreSQL Rápidos (Windows)

## 📋 Verificar Dados no Schema do Tenant

### 1. Ver pessoas cadastradas
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_cadastro, COALESCE(nome_completo, razao_social) as nome, cpf_cnpj, tipo, cidade, estado FROM teste.cadastros_pessoa ORDER BY codigo_cadastro DESC LIMIT 10;"
```

### 2. Contar total de pessoas
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT COUNT(*) as total FROM teste.cadastros_pessoa;"
```

### 3. Ver todas as pessoas (completo)
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT * FROM teste.cadastros_pessoa;"
```

### 4. Ver produtos
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_produto, nome, valor_venda, codigo_ncm FROM teste.cadastros_produto ORDER BY codigo_produto DESC;"
```

### 5. Ver serviços
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_servico, nome, valor_base, tipo_contrato FROM teste.cadastros_servico ORDER BY codigo_servico DESC;"
```

---

## 🔍 Modo Interativo (Recomendado)

### Entrar no PostgreSQL
```powershell
docker exec siscr_db psql -U postgres -d siscr_db
```

### Dentro do psql, executar:
```sql
-- Definir schema padrão
SET search_path TO teste, public;

-- Ver pessoas
SELECT codigo_cadastro, COALESCE(nome_completo, razao_social) as nome, cpf_cnpj, tipo FROM cadastros_pessoa ORDER BY codigo_cadastro DESC;

-- Ver todas as colunas
SELECT * FROM cadastros_pessoa;

-- Contar
SELECT COUNT(*) FROM cadastros_pessoa;

-- Sair
\q
```

---

## 📊 Comandos Úteis

### Ver estrutura da tabela
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "\d teste.cadastros_pessoa"
```

### Ver todas as tabelas do schema teste
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "\dt teste.*"
```

### Listar todos os schemas
```powershell
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT schema_name FROM information_schema.schemata;"
```

