# 🗄️ Guia Completo: DBeaver para PostgreSQL

## 📥 Passo 1: Baixar o DBeaver

### 1.1 Acessar o site oficial
- Abra seu navegador e acesse: **https://dbeaver.io/download/**

### 1.2 Escolher a versão
- **Para Windows**: Clique em **"Windows 64-bit (installer)"** ou **"Windows 64-bit (zip)"**
- O instalador (.exe) é mais fácil para iniciantes
- A versão Community Edition é gratuita e suficiente

### 1.3 Baixar
- Clique no botão de download
- Aguarde o download terminar (arquivo de aproximadamente 80-100 MB)

---

## 📦 Passo 2: Instalar o DBeaver

### 2.1 Executar o instalador
- Localize o arquivo baixado (normalmente na pasta `Downloads`)
- Dê duplo clique no arquivo `.exe`

### 2.2 Seguir o assistente de instalação
1. **Selecione o idioma**: Português (se disponível) ou English
2. **Clique em "Next"** na tela de boas-vindas
3. **Aceite os termos de licença** e clique em "Next"
4. **Escolha o diretório de instalação** (pode deixar o padrão) e clique em "Next"
5. **Selecione os componentes** (deixe tudo marcado) e clique em "Next"
6. **Escolha o local do menu Iniciar** (pode deixar padrão) e clique em "Next"
7. **Clique em "Install"** para iniciar a instalação
8. Aguarde a instalação terminar
9. **Clique em "Finish"** (pode marcar "Launch DBeaver" para abrir automaticamente)

---

## 🔌 Passo 3: Conectar ao PostgreSQL do Docker

### 3.1 Abrir o DBeaver
- Se não abriu automaticamente, procure "DBeaver" no menu Iniciar
- Na primeira vez, pode pedir para criar um workspace (pode deixar o padrão)

### 3.2 Criar nova conexão
1. **Clique no ícone "New Database Connection"** (ícone de plug/soquete) na barra de ferramentas
   - Ou vá em: **Database → New Database Connection**
   - Ou pressione: **Ctrl+Shift+N**

2. **Selecionar PostgreSQL**
   - Na lista de bancos de dados, procure por **"PostgreSQL"**
   - Clique em **"PostgreSQL"** e depois em **"Next"**

### 3.3 Configurar a conexão

Preencha os campos com as seguintes informações:

#### **Configurações Básicas:**
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `siscr_db`
- **Username**: `postgres`
- **Password**: `postgres`
- **Show all databases**: Pode deixar desmarcado

#### **Configurações Avançadas (opcional):**
- Clique na aba **"PostgreSQL"** (no lado esquerdo)
- Se quiser, pode marcar **"Show all databases"** para ver todos os bancos

### 3.4 Testar a conexão
1. **Clique no botão "Test Connection"** (no canto inferior direito)
2. Se aparecer um aviso sobre **"driver não encontrado"**:
   - Clique em **"Download"** para baixar o driver PostgreSQL automaticamente
   - Aguarde o download terminar
   - Clique em **"Test Connection"** novamente
3. Se tudo estiver correto, aparecerá: **"Connected"** em verde
4. Clique em **"OK"**

### 3.5 Finalizar a conexão
- Clique em **"Finish"** para salvar a conexão

---

## 🔍 Passo 4: Explorar o Banco de Dados

### 4.1 Visualizar a estrutura
- No painel esquerdo (Database Navigator), você verá:
  - **Databases** → **siscr_db**
  - Expanda **siscr_db** → **Schemas** → **teste** (ou **public**)
  - Expanda **teste** → **Tables**

### 4.2 Ver as tabelas
- Você verá tabelas como:
  - `cadastros_pessoa`
  - `cadastros_produto`
  - `cadastros_servico`
  - E outras tabelas do sistema

### 4.3 Ver dados de uma tabela
1. **Clique com botão direito** na tabela `cadastros_pessoa`
2. Selecione **"View Data"** ou **"Read Data"**
3. Os dados aparecerão em uma aba no centro da tela

---

## 📝 Passo 5: Executar Queries SQL

### 5.1 Abrir o SQL Editor
- **Clique com botão direito** na conexão `siscr_db` (ou na database)
- Selecione **"SQL Editor"** → **"New SQL Script"**
- Ou pressione: **Ctrl+`** (Ctrl + crase)

### 5.2 Escrever uma query
Digite no editor SQL:

```sql
-- Ver todas as pessoas cadastradas
SELECT 
    codigo_cadastro,
    COALESCE(nome_completo, razao_social) as nome,
    cpf_cnpj,
    tipo,
    cidade || '/' || estado as localizacao
FROM teste.cadastros_pessoa
ORDER BY codigo_cadastro DESC;
```

### 5.3 Executar a query
- **Pressione F5** ou clique no botão **"Execute SQL Script"** (botão ▶️)
- Ou pressione **Ctrl+Enter** para executar apenas a query selecionada

### 5.4 Ver os resultados
- Os resultados aparecerão em uma aba abaixo do editor SQL
- Você pode:
  - **Ordenar** clicando nos cabeçalhos das colunas
  - **Filtrar** usando a barra de filtro
  - **Exportar** os dados (botão direito → Export Data)

---

## 🎯 Queries Úteis para Testar

### Ver todas as pessoas
```sql
SELECT * FROM teste.cadastros_pessoa;
```

### Ver pessoas com informações principais
```sql
SELECT 
    codigo_cadastro,
    COALESCE(nome_completo, razao_social) as nome,
    cpf_cnpj,
    tipo,
    cidade,
    estado,
    email
FROM teste.cadastros_pessoa
ORDER BY codigo_cadastro DESC;
```

### Contar total de pessoas
```sql
SELECT COUNT(*) as total_pessoas FROM teste.cadastros_pessoa;
```

### Ver produtos
```sql
SELECT 
    codigo_produto,
    nome,
    valor_custo,
    valor_venda,
    codigo_ncm,
    ativo
FROM teste.cadastros_produto
ORDER BY codigo_produto DESC;
```

### Ver serviços
```sql
SELECT 
    codigo_servico,
    nome,
    valor_base,
    tipo_contrato,
    ativo
FROM teste.cadastros_servico
ORDER BY codigo_servico DESC;
```

### Ver estrutura de uma tabela
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'teste' 
  AND table_name = 'cadastros_pessoa'
ORDER BY ordinal_position;
```

---

## 🔧 Dicas e Truques

### Definir schema padrão
Se você sempre usa o schema `teste`, pode definir o search_path:

1. Abra o **SQL Editor**
2. Execute:
```sql
SET search_path TO teste, public;
```
3. Agora você pode consultar sem especificar o schema:
```sql
SELECT * FROM cadastros_pessoa;  -- Sem precisar de teste.cadastros_pessoa
```

### Ver todas as tabelas de um schema
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'teste'
ORDER BY table_name;
```

### Ver todos os schemas
```sql
SELECT schema_name 
FROM information_schema.schemata 
ORDER BY schema_name;
```

### Auto-completar
- O DBeaver tem auto-completar (Ctrl+Space)
- Ele sugere nomes de tabelas, colunas, etc.

### Formatação de código
- **Ctrl+Shift+F** - Formata o código SQL

### Salvar queries
- Você pode salvar suas queries favoritas
- **File → Save** ou **Ctrl+S** no SQL Editor

---

## ⚠️ Solução de Problemas

### Erro: "Connection refused" ou "Connection timeout"
- **Verifique se o Docker está rodando**:
  ```powershell
  docker ps
  ```
- **Verifique se o container do banco está ativo**:
  ```powershell
  docker ps | findstr siscr_db
  ```

### Erro: "Password authentication failed"
- Verifique se a senha está correta: `postgres`
- Verifique as credenciais no `docker-compose.yml`

### Erro: "Database does not exist"
- Verifique se o nome do banco está correto: `siscr_db`
- Verifique no Docker:
  ```powershell
  docker exec siscr_db psql -U postgres -l
  ```

### Não consegue ver as tabelas
- Verifique se está expandindo o schema correto (`teste` ou `public`)
- Tente atualizar a conexão (botão direito → Refresh)

### Driver não baixa automaticamente
1. Vá em **Window → Preferences** (ou **Edit → Preferences**)
2. **Drivers → PostgreSQL**
3. Clique em **"Download/Update"**
4. Aguarde e clique em **"OK"**

---

## 📊 Interface do DBeaver

### Painéis principais:
- **Database Navigator** (esquerda): Lista de conexões e bancos
- **SQL Editor** (centro): Onde você escreve queries
- **Results** (abaixo): Resultados das queries
- **Properties** (direita): Propriedades de objetos selecionados

### Atalhos úteis:
- **Ctrl+Shift+N**: Nova conexão
- **Ctrl+`**: Novo SQL Script
- **F5**: Executar query
- **Ctrl+Enter**: Executar query selecionada
- **Ctrl+Shift+F**: Formatar SQL
- **Ctrl+S**: Salvar

---

## ✅ Checklist Final

- [ ] DBeaver instalado
- [ ] Conexão criada com `localhost:5432`
- [ ] Conexão testada com sucesso
- [ ] Schema `teste` visível
- [ ] Tabelas `cadastros_pessoa`, `cadastros_produto`, `cadastros_servico` visíveis
- [ ] Query de teste executada com sucesso

---

## 🎉 Pronto!

Agora você pode usar o DBeaver para:
- ✅ Ver dados de forma visual
- ✅ Executar queries SQL facilmente
- ✅ Exportar dados para Excel/CSV
- ✅ Editar dados diretamente (com cuidado!)
- ✅ Ver estrutura das tabelas
- ✅ Criar backups visuais

Qualquer dúvida, me avise!

