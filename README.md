# SISCR - Sistema de Gestão Empresarial

Sistema de gestão para empresas de logística e comércio exterior desenvolvido em Django.

## 📋 Pré-requisitos

- Docker Desktop instalado e rodando
- Git (opcional, apenas para clonar o repositório)

## 🚀 Instalação e Execução

### Windows

#### 1. Instalar Docker Desktop

1. Baixe o Docker Desktop para Windows: https://www.docker.com/products/docker-desktop/
2. Execute o instalador e siga as instruções
3. Reinicie o computador se solicitado
4. Abra o Docker Desktop e aguarde até que ele esteja rodando (ícone na bandeja do sistema)

#### 2. Clonar o Repositório (se aplicável)

```bash
git clone <url-do-repositorio>
cd siscr
```

#### 3. Subir a Aplicação

```bash
docker-compose up -d --build
```

Este comando irá:
- Baixar as imagens necessárias (PostgreSQL e Python)
- Construir a imagem da aplicação Django
- Criar e configurar o banco de dados PostgreSQL
- Aplicar as migrações automaticamente
- Criar um usuário administrador (admin/admin123)
- Iniciar os containers em background

#### 4. Acessar a Aplicação

Aguarde alguns segundos para os containers iniciarem completamente, depois acesse:

- **Interface Principal**: http://127.0.0.1:8000/login/
- **Admin Django**: http://127.0.0.1:8000/admin/

**Credenciais de Login:**
- Usuário: `admin`
- Senha: `admin123`

---

### Linux

#### 1. Instalar Docker e Docker Compose

**Ubuntu/Debian:**

```bash
# Atualizar sistema
sudo apt update

# Instalar dependências
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Adicionar chave GPG do Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Adicionar repositório Docker
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adicionar usuário ao grupo docker (para não usar sudo)
sudo usermod -aG docker $USER

# Reiniciar sessão ou executar:
newgrp docker

# Verificar instalação
docker --version
docker compose version
```

**Outras distribuições Linux:**
Consulte a documentação oficial: https://docs.docker.com/engine/install/

#### 2. Clonar o Repositório (se aplicável)

```bash
git clone <url-do-repositorio>
cd siscr
```

#### 3. Subir a Aplicação

```bash
docker compose up -d --build
```

Este comando irá:
- Baixar as imagens necessárias (PostgreSQL e Python)
- Construir a imagem da aplicação Django
- Criar e configurar o banco de dados PostgreSQL
- Aplicar as migrações automaticamente
- Criar um usuário administrador (admin/admin123)
- Iniciar os containers em background

#### 4. Acessar a Aplicação

Aguarde alguns segundos para os containers iniciarem completamente, depois acesse:

- **Interface Principal**: http://127.0.0.1:8000/login/
- **Admin Django**: http://127.0.0.1:8000/admin/

**Credenciais de Login:**
- Usuário: `admin`
- Senha: `admin123`

---

## 🛠️ Comandos Úteis

### Verificar Status dos Containers

```bash
# Windows
docker-compose ps

# Linux
docker compose ps
```

### Ver Logs da Aplicação

```bash
# Windows - logs em tempo real
docker-compose logs -f web

# Windows - últimas 50 linhas
docker-compose logs --tail 50 web

# Linux - logs em tempo real
docker compose logs -f web

# Linux - últimas 50 linhas
docker compose logs --tail 50 web
```

### Parar os Containers

```bash
# Windows
docker-compose down

# Linux
docker compose down
```

### Parar e Remover Volumes (apaga o banco de dados)

```bash
# Windows
docker-compose down -v

# Linux
docker compose down -v
```

### Reiniciar os Containers

```bash
# Windows
docker-compose restart

# Linux
docker compose restart
```

### Reconstruir após Mudanças no Código

```bash
# Windows
docker-compose up -d --build

# Linux
docker compose up -d --build
```

### Acessar o Shell do Container

```bash
# Windows
docker-compose exec web bash

# Linux
docker compose exec web bash
```

### Criar um Novo Superusuário

```bash
# Windows
docker-compose exec web python manage.py createsuperuser

# Linux
docker compose exec web python manage.py createsuperuser
```

### Aplicar Migrations Manualmente

```bash
# Windows
docker-compose exec web python manage.py migrate

# Linux
docker compose exec web python manage.py migrate
```

### Coletar Arquivos Estáticos

```bash
# Windows
docker-compose exec web python manage.py collectstatic --noinput

# Linux
docker compose exec web python manage.py collectstatic --noinput
```

---

## 📁 Estrutura do Projeto

```
siscr/
├── core/                    # App principal do Django
│   ├── models.py           # Modelos: Pessoa, Produto, Servico
│   ├── views.py            # Views/controllers
│   ├── forms.py            # Formulários Django
│   ├── urls.py             # Rotas do app
│   ├── templates/          # Templates HTML
│   └── migrations/         # Migrações do banco
├── siscr/                  # Configurações do projeto
│   ├── settings.py        # Configurações Django
│   ├── urls.py            # URLs raiz
│   └── wsgi.py            # WSGI para deploy
├── static/                 # Arquivos estáticos
├── Dockerfile              # Imagem Docker da aplicação
├── docker-compose.yml      # Orquestração dos containers
├── requirements.txt        # Dependências Python
├── manage.py              # Script de gerenciamento Django
└── README.md              # Este arquivo
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

- **8000**: Aplicação Django
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

# Linux
sudo lsof -i :8000
sudo lsof -i :5432
```

### Erro ao conectar no banco de dados

1. Verifique se o container `db` está rodando: `docker-compose ps`
2. Aguarde alguns segundos após iniciar os containers (o PostgreSQL precisa de tempo para inicializar)
3. Verifique os logs: `docker-compose logs db`

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

---

## 🔐 Segurança

⚠️ **IMPORTANTE PARA PRODUÇÃO:**

- Altere a `SECRET_KEY` no `docker-compose.yml` ou use variáveis de ambiente
- Altere as credenciais padrão do banco de dados
- Altere a senha do superusuário padrão
- Configure `DEBUG=False` no `settings.py`
- Configure `ALLOWED_HOSTS` adequadamente
- Use HTTPS em produção

---

## 📚 Tecnologias Utilizadas

- **Django 4.2+**: Framework web Python
- **PostgreSQL 15**: Banco de dados relacional
- **Docker**: Containerização
- **Docker Compose**: Orquestração de containers
- **Tailwind CSS**: Framework CSS (via CDN)

---

## 📞 Suporte

Para problemas ou dúvidas, consulte os logs dos containers ou abra uma issue no repositório.

---

## 📄 Licença

[Adicione informações de licença aqui]
