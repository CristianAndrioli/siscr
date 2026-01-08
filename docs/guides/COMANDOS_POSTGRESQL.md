# 📊 Comandos PostgreSQL para Verificar Dados

## 🚀 Acessar o PostgreSQL via Docker

### 1. Entrar no terminal interativo do PostgreSQL

**Windows PowerShell:**
```powershell
docker exec -it siscr_db psql -U postgres -d siscr_db
```

**Se der erro de TTY no Windows, use:**
```powershell
docker exec siscr_db psql -U postgres -d siscr_db
```

**Linux/Mac:**
```bash
docker exec -it siscr_db psql -U postgres -d siscr_db
```

### 2. Ou executar comandos diretos (sem entrar no terminal)
```bash
# Windows PowerShell
docker exec siscr_db psql -U postgres -d siscr_db -c "SEU_COMANDO_SQL_AQUI"

# Linux/Mac
docker exec -it siscr_db psql -U postgres -d siscr_db -c "SEU_COMANDO_SQL_AQUI"
```

---

## 📋 Comandos Úteis

### Listar todas as tabelas do schema público
```bash
# Windows (remover -it)
docker exec siscr_db psql -U postgres -d siscr_db -c "\dt"

# Linux/Mac
docker exec -it siscr_db psql -U postgres -d siscr_db -c "\dt"
```

### Listar tabelas do app cadastros
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "\dt cadastros.*"
```

### Ver estrutura de uma tabela
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "\d cadastros_pessoa"
```

---

## 🔍 Consultas SQL - Pessoas

### Ver todas as pessoas cadastradas
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT * FROM cadastros_pessoa;"
```

### Ver pessoas com informações principais
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_cadastro, nome_completo, razao_social, cpf_cnpj, tipo, cidade, estado, email FROM cadastros_pessoa ORDER BY codigo_cadastro DESC;"
```

### Contar total de pessoas
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT COUNT(*) as total_pessoas FROM cadastros_pessoa;"
```

### Ver últimas 5 pessoas cadastradas
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_cadastro, nome_completo, razao_social, cpf_cnpj FROM cadastros_pessoa ORDER BY codigo_cadastro DESC LIMIT 5;"
```

---

## 🔍 Consultas SQL - Produtos

### Ver todos os produtos
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_produto, nome, valor_custo, valor_venda, codigo_ncm, ativo FROM cadastros_produto ORDER BY codigo_produto DESC;"
```

### Contar produtos ativos
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT COUNT(*) as produtos_ativos FROM cadastros_produto WHERE ativo = true;"
```

---

## 🔍 Consultas SQL - Serviços

### Ver todos os serviços
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT codigo_servico, nome, valor_base, tipo_contrato, ativo FROM cadastros_servico ORDER BY codigo_servico DESC;"
```

---

## 💡 Modo Interativo (Mais Prático)

### 1. Entrar no PostgreSQL
```bash
# Windows PowerShell
docker exec siscr_db psql -U postgres -d siscr_db

# Linux/Mac (com -it)
docker exec -it siscr_db psql -U postgres -d siscr_db
```

### 2. Dentro do terminal, você pode executar:
```sql
-- Ver todas as tabelas
\dt

-- Ver estrutura da tabela
\d cadastros_pessoa

-- Consultas SQL normais
SELECT * FROM cadastros_pessoa;
SELECT COUNT(*) FROM cadastros_pessoa;

-- Sair
\q
```

---

## 🔧 Comandos Úteis do psql (dentro do terminal)

- `\l` - Listar todos os bancos de dados
- `\dt` - Listar todas as tabelas
- `\d tabela` - Descrever estrutura de uma tabela
- `\du` - Listar usuários
- `\q` - Sair do psql
- `\c nome_banco` - Conectar a outro banco
- `\?` - Ajuda com comandos psql

---

## 📝 Exemplo Completo

```bash
# 1. Entrar no PostgreSQL
docker exec -it siscr_db psql -U postgres -d siscr_db

# 2. Dentro do psql, executar:
SELECT 
    codigo_cadastro,
    COALESCE(nome_completo, razao_social) as nome,
    cpf_cnpj,
    tipo,
    cidade || '/' || estado as localizacao
FROM cadastros_pessoa
ORDER BY codigo_cadastro DESC
LIMIT 10;

# 3. Sair
\q
```

---

## ⚠️ Nota sobre Multi-Tenancy

Se você estiver usando `django-tenants`, os dados podem estar em schemas diferentes. 

### Verificar schemas existentes
```bash
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;"
```

### Verificar tabelas em schemas específicos
```bash
# Ver tabelas no schema public
docker exec siscr_db psql -U postgres -d siscr_db -c "\dt public.*"

# Ver tabelas no schema do tenant (ex: teste)
docker exec siscr_db psql -U postgres -d siscr_db -c "\dt teste.*"
```

### Consultar dados no schema do tenant
```bash
# Pessoas no schema teste
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT * FROM teste.cadastros_pessoa;"

# Produtos no schema teste
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT * FROM teste.cadastros_produto;"

# Serviços no schema teste
docker exec siscr_db psql -U postgres -d siscr_db -c "SELECT * FROM teste.cadastros_servico;"
```

### Definir schema padrão (dentro do psql)
```sql
-- Entrar no psql
docker exec siscr_db psql -U postgres -d siscr_db

-- Definir search_path para o schema do tenant
SET search_path TO teste, public;

-- Agora você pode consultar sem especificar o schema
SELECT * FROM cadastros_pessoa;
```

**⚠️ IMPORTANTE:** No seu caso, os dados estão no schema `teste` (tenant), não no `public`. 
Use `teste.cadastros_pessoa` ou defina o `search_path` antes de consultar.

