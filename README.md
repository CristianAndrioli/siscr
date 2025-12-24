# SISCR - Sistema de Gestão Empresarial

Sistema de gestão para empresas de logística e comércio exterior desenvolvido em Django com frontend React.

## 📋 Pré-requisitos

- **Docker Desktop** instalado e rodando
- **Node.js** (versão 16 ou superior) - para o frontend React
- **Git** (opcional, apenas para clonar o repositório)

---

## 🚀 Iniciando a Aplicação

### ⚡ Início Rápido (Windows)

Para facilitar, você pode usar o script batch que automatiza todo o processo:

**Simplesmente execute:**
```bash
start.bat
```

Este script irá:
- ✅ Verificar se Docker e Node.js estão instalados
- ✅ Instalar dependências do frontend se necessário
- ✅ Iniciar o backend (Docker Compose)
- ✅ Iniciar o frontend React
- ✅ Abrir automaticamente os navegadores com:
  - Frontend React: http://localhost:5173
  - Backend Django API: http://127.0.0.1:8000/api/
  - Django Admin: http://127.0.0.1:8000/admin/

**Nota:** Na primeira execução, o script pode demorar alguns minutos para baixar imagens Docker e instalar dependências.

---

### 📝 Início Manual

Se preferir iniciar manualmente ou estiver em Linux/Mac:

#### Passo 1: Iniciar Backend (Django + PostgreSQL)

O backend utiliza Docker Compose para gerenciar o banco de dados PostgreSQL e a aplicação Django.

**Windows:**
```bash
docker-compose up -d --build
```

**Linux/Mac:**
```bash
docker compose up -d --build
```

Este comando irá:
- ✅ Baixar as imagens necessárias (PostgreSQL 15 e Python 3.11)
- ✅ Construir a imagem da aplicação Django
- ✅ Criar e configurar o banco de dados PostgreSQL
- ✅ Aplicar as migrações automaticamente
- ✅ Criar um usuário administrador (admin/admin123)
- ✅ Iniciar os containers em background

**Aguarde alguns segundos** para os containers iniciarem completamente.

#### Passo 2: Iniciar Frontend React

Em um novo terminal, navegue até a pasta do frontend e inicie o servidor de desenvolvimento:

```bash
cd frontend
npm install  # Apenas na primeira vez ou após atualizar dependências
npm run dev
```

O frontend React estará disponível em: **http://localhost:5173**

---

## 🌐 Acessos e Credenciais

### 1. **Frontend React (Recomendado)** - Porta 5173

- **URL**: http://localhost:5173
- **Credenciais**:
  - Usuário: `admin`
  - Senha: `admin123`
- **Descrição**: Interface moderna em React com melhor experiência do usuário. Esta é a versão que está sendo desenvolvida atualmente.

### 2. **Backend Django (API REST)** - Porta 8000

- **URL API**: http://127.0.0.1:8000/api/
- **Descrição**: Backend Django fornece apenas APIs REST. Todas as páginas foram migradas para React (porta 5173).

**Endpoints principais:**
- `/api/auth/token/` - Autenticação JWT
- `/api/cadastros/` - APIs de cadastros (Pessoas, Produtos, Serviços)
- `/api/` - Outras APIs do sistema

### 3. **Django Admin** - Porta 8000

- **URL**: http://127.0.0.1:8000/admin/
- **Credenciais**:
  - Usuário: `admin`
  - Senha: `admin123`
- **Descrição**: Painel administrativo nativo do Django. Permite gerenciar todos os modelos do sistema através de uma interface administrativa completa.

**Funcionalidades do Django Admin:**
- ✅ Gerenciar usuários e permissões
- ✅ Visualizar e editar Pessoas, Produtos e Serviços
- ✅ Acessar histórico de mudanças
- ✅ Filtrar e buscar registros
- ✅ Exportar dados
- ✅ Interface completa para administração do sistema

---

## 🗄️ Banco de Dados

### Configuração

O banco de dados PostgreSQL é gerenciado automaticamente pelo Docker Compose.

**Configurações padrão:**
- **Host**: `localhost` (ou `db` dentro do container)
- **Porta**: `5432`
- **Nome do banco**: `siscr_db`
- **Usuário**: `postgres`
- **Senha**: `postgres`

**Variáveis de ambiente** (definidas no `docker-compose.yml`):
- `DB_NAME`: Nome do banco de dados
- `DB_USER`: Usuário do PostgreSQL
- `DB_PASSWORD`: Senha do PostgreSQL
- `DB_HOST`: Host do banco
- `DB_PORT`: Porta do banco

### Acessar o Banco de Dados

**Via Docker:**
```bash
# Windows
docker-compose exec db psql -U postgres -d siscr_db

# Linux/Mac
docker compose exec db psql -U postgres -d siscr_db
```

**Via Cliente Externo:**
- Host: `localhost`
- Porta: `5432`
- Database: `siscr_db`
- Usuário: `postgres`
- Senha: `postgres`

---

## 🌱 Seed de Dados para Teste

Para popular o banco de dados com dados de exemplo para testes, utilize o comando `seed_data`:

### Comando Básico

```bash
# Windows
docker-compose exec web python manage.py seed_data

# Linux/Mac
docker compose exec web python manage.py seed_data
```

### Opções Disponíveis

**Aplicar migrações antes de popular:**
```bash
docker-compose exec web python manage.py seed_data --migrate
```

**Limpar dados existentes e popular novamente:**
```bash
docker-compose exec web python manage.py seed_data --clear
```

### Dados Criados pelo Seed

O comando cria os seguintes dados de exemplo:

**Pessoas (9 registros):**
- 3 Pessoas Físicas (Clientes)
- 2 Pessoas Jurídicas (Clientes)
- 2 Fornecedores
- 2 Funcionários

**Produtos (5 registros):**
- Notebook Dell Inspiron 15 (Código: 1001)
- Mouse Logitech MX Master 3 (Código: 1002)
- Teclado Mecânico RGB (Código: 1003)
- Aço Inox 304 - Chapa (Código: 2001)
- Produto Importado - Componente Eletrônico (Código: 2002)

**Serviços (5 registros):**
- Consultoria em Comércio Exterior (Código: 3001)
- Despacho Aduaneiro (Código: 3002)
- Gestão de Documentação (Código: 3003)
- Análise de Viabilidade de Importação (Código: 3004)
- Suporte Técnico Especializado (Código: 3005)

**Nota:** Se um registro já existir, ele será ignorado (não duplica dados).

---

## 🛠️ Comandos Úteis

### Verificar Status dos Containers

```bash
# Windows
docker-compose ps

# Linux/Mac
docker compose ps
```

### Ver Logs da Aplicação

```bash
# Windows - logs em tempo real
docker-compose logs -f web

# Windows - últimas 50 linhas
docker-compose logs --tail 50 web

# Linux/Mac - logs em tempo real
docker compose logs -f web

# Linux/Mac - últimas 50 linhas
docker compose logs --tail 50 web
```

### Parar os Containers

```bash
# Windows
docker-compose down

# Linux/Mac
docker compose down
```

### Parar e Remover Volumes (apaga o banco de dados)

```bash
# Windows
docker-compose down -v

# Linux/Mac
docker compose down -v
```

### Reiniciar os Containers

```bash
# Windows
docker-compose restart

# Linux/Mac
docker compose restart
```

### Reconstruir após Mudanças no Código

```bash
# Windows
docker-compose up -d --build

# Linux/Mac
docker compose up -d --build
```

### Acessar o Shell do Container

```bash
# Windows
docker-compose exec web bash

# Linux/Mac
docker compose exec web bash
```

### Criar um Novo Superusuário

```bash
# Windows
docker-compose exec web python manage.py createsuperuser

# Linux/Mac
docker compose exec web python manage.py createsuperuser
```

### Aplicar Migrations Manualmente

```bash
# Windows
docker-compose exec web python manage.py migrate

# Linux/Mac
docker compose exec web python manage.py migrate
```

### Coletar Arquivos Estáticos

```bash
# Windows
docker-compose exec web python manage.py collectstatic --noinput

# Linux/Mac
docker compose exec web python manage.py collectstatic --noinput
```

---

## 📁 Estrutura do Projeto

```
siscr/
├── accounts/              # App de autenticação
├── cadastros/             # App de cadastros (Pessoas, Produtos, Serviços)
│   ├── api/              # API REST (serializers, viewsets)
│   └── management/       # Comandos Django (seed_data, create_tables)
├── core/                 # App principal do Django
│   ├── models.py         # Modelos principais
│   ├── views.py          # Views/controllers
│   ├── forms.py          # Formulários Django
│   ├── urls.py           # Rotas do app
│   ├── templates/        # Templates HTML (Frontend Legado)
│   └── migrations/       # Migrações do banco
├── frontend/             # Frontend React
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── services/     # Serviços de API
│   │   └── hooks/        # Custom hooks
│   └── package.json
├── siscr/                # Configurações do projeto
│   ├── settings.py      # Configurações Django
│   ├── urls.py          # URLs raiz
│   └── wsgi.py          # WSGI para deploy
├── static/               # Arquivos estáticos
├── Dockerfile            # Imagem Docker da aplicação
├── docker-compose.yml    # Orquestração dos containers
├── requirements.txt      # Dependências Python
├── manage.py            # Script de gerenciamento Django
└── README.md            # Este arquivo
```

---

## 🔧 Configuração

### Variáveis de Ambiente

O projeto usa variáveis de ambiente para configuração. No `docker-compose.yml` estão definidas:

- `DB_NAME`: Nome do banco de dados (padrão: `siscr_db`)
- `DB_USER`: Usuário do PostgreSQL (padrão: `postgres`)
- `DB_PASSWORD`: Senha do PostgreSQL (padrão: `postgres`)
- `DB_HOST`: Host do banco (padrão: `db`)
- `DB_PORT`: Porta do banco (padrão: `5432`)
- `SECRET_KEY`: Chave secreta do Django (altere em produção!)

### Portas

- **8000**: Backend Django (API REST + Templates Legados + Admin)
- **5173**: Frontend React (Vite Dev Server)
- **5432**: PostgreSQL (exposta para acesso externo se necessário)

---

## 🐛 Solução de Problemas

### Containers não iniciam

```bash
# Verificar logs
docker-compose logs web
docker-compose logs db

# Verificar se as portas estão livres
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :5432

# Linux/Mac
sudo lsof -i :8000
sudo lsof -i :5432
```

### Erro ao conectar no banco de dados

1. Verifique se o container `db` está rodando: `docker-compose ps`
2. Aguarde alguns segundos após iniciar os containers (o PostgreSQL precisa de tempo para inicializar)
3. Verifique os logs: `docker-compose logs db`

### Frontend React não inicia

1. Verifique se o Node.js está instalado: `node --version`
2. Instale as dependências: `cd frontend && npm install`
3. Verifique se a porta 5173 está livre
4. Verifique os logs no terminal onde executou `npm run dev`

### Erro 404 nas imagens do login

As imagens estáticas (`logoConectaPrime.jpg`, `fundologin.jpg`) não estão incluídas no repositório. Isso é normal e não impede o funcionamento da aplicação.

### Reiniciar tudo do zero

```bash
# Parar e remover tudo
docker-compose down -v

# Remover imagens (opcional)
docker-compose down --rmi all

# Subir novamente
docker-compose up -d --build
```

---

## 📝 Notas Importantes

- **Desenvolvimento**: Este setup é para desenvolvimento local. Para produção, configure adequadamente as variáveis de ambiente e segurança.
- **Banco de Dados**: Os dados são persistidos em um volume Docker. Ao fazer `docker-compose down -v`, todos os dados serão perdidos.
- **Superusuário**: O superusuário padrão (admin/admin123) é criado automaticamente na primeira execução.
- **Migrations**: As migrations são aplicadas automaticamente ao subir os containers.
- **Frontend Legado**: O frontend em Django Templates está sendo gradualmente migrado para React. Ambos coexistem durante a transição.

---

## 🔐 Segurança

⚠️ **IMPORTANTE PARA PRODUÇÃO:**

- Altere a `SECRET_KEY` no `docker-compose.yml` ou use variáveis de ambiente
- Altere as credenciais padrão do banco de dados
- Altere a senha do superusuário padrão
- Configure `DEBUG=False` no `settings.py`
- Configure `ALLOWED_HOSTS` adequadamente
- Use HTTPS em produção
- Não exponha a porta 5432 do PostgreSQL em produção

---

## 📚 Tecnologias Utilizadas

### Backend
- **Django 4.2+**: Framework web Python
- **Django REST Framework**: API REST
- **PostgreSQL 15**: Banco de dados relacional
- **Docker**: Containerização
- **Docker Compose**: Orquestração de containers

### Frontend
- **React 19**: Biblioteca JavaScript para interfaces
- **TypeScript**: Tipagem estática
- **Vite**: Build tool e dev server
- **Tailwind CSS**: Framework CSS
- **Axios**: Cliente HTTP

---

## 📚 Documentação

Documentação completa disponível na pasta `docs/`:

- **[Documentação da API](./docs/API_DOCUMENTATION.md)** - Guia completo de todos os endpoints da API
- **[Guia de Setup para Desenvolvimento](./docs/SETUP_DEVELOPMENT.md)** - Como configurar o ambiente de desenvolvimento
- **[Guia de Testes](./docs/TESTES.md)** - Como executar e escrever testes
- **[Roadmap CI/CD](./docs/CI_CD_ROADMAP.md)** - Estratégia de CI/CD e deploy

## 📞 Suporte

Para problemas ou dúvidas:
- Consulte os logs dos containers: `docker-compose logs`
- Verifique a documentação em `docs/`
- Abra uma issue no repositório

---

## 📄 Licença

[Adicione informações de licença aqui]
