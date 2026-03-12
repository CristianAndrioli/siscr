# 🔌 Como Conectar o DBeaver ao Banco de Dados Docker

Este guia explica como conectar o DBeaver ao banco de dados PostgreSQL que está rodando em Docker no Windows.

## 📋 Pré-requisitos

1. **Docker Desktop** instalado e rodando no Windows
2. **DBeaver** instalado no Windows
3. **Containers Docker** do projeto rodando (especialmente o container `db`)

## ✅ Passo 1: Verificar se o Container está Rodando

Antes de conectar, certifique-se de que o container do banco de dados está em execução:

```bash
docker-compose ps
```

Você deve ver o container `db` com status `Up`. Se não estiver rodando, execute:

```bash
docker-compose up -d db
```

## ✅ Passo 2: Verificar se a Porta está Exposta

O `docker-compose.yml` já está configurado para expor a porta `5432` do container para o host:

```yaml
ports:
  - "5432:5432"
```

Isso significa que você pode acessar o banco de dados usando `localhost:5432` do seu Windows.

## ✅ Passo 3: Configurar Conexão no DBeaver

### 3.1. Abrir o DBeaver

Abra o DBeaver no Windows.

### 3.2. Criar Nova Conexão

1. Clique no botão **"Nova Conexão"** (ícone de plug) na barra de ferramentas
   - Ou vá em: **Database** → **New Database Connection**
   - Ou use o atalho: `Ctrl+Shift+N`

2. Selecione **PostgreSQL** na lista de bancos de dados
   - Se não aparecer, você pode procurar por "PostgreSQL" na busca

3. Clique em **Next**

### 3.3. Configurar Parâmetros de Conexão

Preencha os seguintes campos na tela de configuração:

| Campo | Valor |
|-------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `siscr_db` |
| **Username** | `postgres` |
| **Password** | `postgres` |

**Observações:**
- O campo **Host** deve ser `localhost` (não `db`, que é o nome do serviço dentro do Docker)
- A porta `5432` já deve estar preenchida automaticamente
- Marque a opção **"Save password"** se quiser que o DBeaver salve a senha

### 3.4. Testar a Conexão

1. Clique no botão **"Test Connection"** (Testar Conexão)
   - Se for a primeira vez usando PostgreSQL no DBeaver, ele pode pedir para baixar o driver JDBC do PostgreSQL. Clique em **"Download"** e aguarde.

2. Se tudo estiver correto, você verá uma mensagem de sucesso:
   ```
   Connected
   PostgreSQL 15.x
   Driver: PostgreSQL JDBC Driver
   ```

3. Clique em **"Finish"** para salvar a conexão

## ✅ Passo 4: Conectar ao Banco de Dados

1. No painel esquerdo do DBeaver, você verá sua nova conexão listada
2. Clique com o botão direito na conexão e selecione **"Connect"**
   - Ou simplesmente dê um duplo clique na conexão

3. O DBeaver irá conectar e mostrar a estrutura do banco de dados:
   - **Databases** → `siscr_db`
   - **Schemas** → `public` (e outros schemas se existirem)
   - **Tables**, **Views**, **Functions**, etc.

## 🔍 Explorando o Banco de Dados

### Ver Schemas

Como este projeto usa `django-tenants`, você pode ter múltiplos schemas:
- **`public`**: Schema compartilhado (comum a todos os tenants)
- Outros schemas: Um para cada tenant criado

### Executar Queries

1. Clique com o botão direito na conexão ou no banco de dados
2. Selecione **"SQL Editor"** → **"New SQL Script"**
3. Digite suas queries SQL e execute com `Ctrl+Enter` ou clicando no botão de execução

### Exemplo de Query

```sql
-- Listar todos os schemas
SELECT schema_name 
FROM information_schema.schemata 
ORDER BY schema_name;

-- Listar tabelas do schema public
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

## 🐛 Solução de Problemas

### Erro: "Connection refused" ou "Connection timed out"

**Causa:** O container do banco de dados não está rodando ou a porta não está exposta.

**Solução:**
1. Verifique se o container está rodando:
   ```bash
   docker-compose ps
   ```

2. Se não estiver, inicie o container:
   ```bash
   docker-compose up -d db
   ```

3. Aguarde alguns segundos para o PostgreSQL inicializar completamente

4. Verifique se a porta está sendo usada:
   ```powershell
   netstat -ano | findstr :5432
   ```

### Erro: "FATAL: password authentication failed"

**Causa:** Usuário ou senha incorretos.

**Solução:**
- Verifique se está usando:
  - Usuário: `postgres`
  - Senha: `postgres`
- Esses valores estão definidos no `docker-compose.yml` nas variáveis `POSTGRES_USER` e `POSTGRES_PASSWORD`

### Erro: "Database does not exist"

**Causa:** O nome do banco de dados está incorreto.

**Solução:**
- Verifique se está usando: `siscr_db`
- Este valor está definido no `docker-compose.yml` na variável `POSTGRES_DB`

### Erro: "Driver not found" ou "Download driver"

**Causa:** O driver JDBC do PostgreSQL não está instalado no DBeaver.

**Solução:**
1. Quando o DBeaver pedir para baixar o driver, clique em **"Download"**
2. Aguarde o download e instalação automática
3. Tente conectar novamente

### DBeaver não consegue encontrar o PostgreSQL

**Causa:** O driver PostgreSQL pode não estar instalado.

**Solução:**
1. Vá em **Database** → **Driver Manager**
2. Procure por "PostgreSQL"
3. Se não encontrar, clique em **"New Driver"**
4. Selecione "PostgreSQL" e baixe o driver

## 📝 Notas Importantes

1. **Host vs Container Name:**
   - Dentro do Docker, os containers se comunicam usando o nome do serviço (`db`)
   - Do Windows (DBeaver), você deve usar `localhost` ou `127.0.0.1`

2. **Porta:**
   - A porta `5432` já está mapeada no `docker-compose.yml`
   - Se você tiver outro PostgreSQL rodando na porta 5432, pode haver conflito

3. **Segurança:**
   - As credenciais padrão (`postgres/postgres`) são apenas para desenvolvimento
   - Em produção, altere essas credenciais no `docker-compose.yml` ou use variáveis de ambiente

4. **Schemas do django-tenants:**
   - O projeto usa `django-tenants`, que cria schemas separados para cada tenant
   - O schema `public` contém dados compartilhados
   - Cada tenant tem seu próprio schema com nome específico

## 🎯 Resumo Rápido

Para conectar rapidamente, use estas configurações no DBeaver:

```
Tipo: PostgreSQL
Host: localhost
Porta: 5432
Database: siscr_db
Usuário: postgres
Senha: postgres
```

---

**Pronto!** Agora você pode usar o DBeaver para explorar e gerenciar seu banco de dados PostgreSQL que está rodando no Docker! 🎉

