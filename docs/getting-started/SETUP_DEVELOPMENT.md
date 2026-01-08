# 🚀 Guia de Setup para Desenvolvimento

Este guia explica como configurar o ambiente de desenvolvimento local do SISCR.

## 📋 Pré-requisitos

- **Python** 3.11 ou superior
- **Node.js** 18 ou superior
- **PostgreSQL** 12 ou superior
- **Redis** 6 ou superior
- **Git**

## 🔧 Configuração do Backend (Django)

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/siscr.git
cd siscr
```

### 2. Crie um Ambiente Virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Instale as Dependências

```bash
pip install -r requirements.txt
```

### 4. Configure o PostgreSQL

Crie um banco de dados PostgreSQL:

```sql
CREATE DATABASE siscr;
CREATE USER siscr_user WITH PASSWORD 'sua_senha';
GRANT ALL PRIVILEGES ON DATABASE siscr TO siscr_user;
```

### 5. Configure Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Django
SECRET_KEY=sua-chave-secreta-aqui
DEBUG=True
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://siscr_user:sua_senha@localhost:5432/siscr

# Redis
REDIS_URL=redis://127.0.0.1:6379/1

# Stripe (opcional para desenvolvimento)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=seu-email@gmail.com
EMAIL_HOST_PASSWORD=sua-senha
EMAIL_USE_TLS=True
```

### 6. Execute as Migrações

```bash
python manage.py migrate_schemas --shared
```

### 7. Crie um Superusuário

```bash
python manage.py createsuperuser
```

### 8. Execute o Servidor

```bash
python manage.py runserver
```

O servidor estará disponível em `http://localhost:8000`

## 🎨 Configuração do Frontend (React)

### 1. Navegue para a Pasta do Frontend

```bash
cd frontend
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure Variáveis de Ambiente

Crie um arquivo `.env` na pasta `frontend`:

```env
VITE_API_URL=http://localhost:8000
```

### 4. Execute o Servidor de Desenvolvimento

```bash
npm run dev
```

O frontend estará disponível em `http://localhost:5173`

## 🐳 Usando Docker (Opcional)

Se preferir usar Docker:

### 1. Inicie os Serviços

```bash
docker-compose up -d
```

Isso iniciará:
- PostgreSQL na porta 5432
- Redis na porta 6379
- Backend Django na porta 8000
- Frontend React na porta 5173

### 2. Execute as Migrações

```bash
docker-compose exec backend python manage.py migrate_schemas --shared
```

### 3. Crie um Superusuário

```bash
docker-compose exec backend python manage.py createsuperuser
```

## 🧪 Executando Testes

### Backend

```bash
# Todos os testes
python manage.py test

# Testes específicos
python manage.py test accounts.tests
python manage.py test core.api.tests
```

### Frontend

```bash
cd frontend
npm test
```

## 🔍 Linting e Formatação

### Backend

```bash
# Flake8 (linting)
flake8 .

# Black (formatação)
black .

# Isort (imports)
isort .
```

### Frontend

```bash
cd frontend
npm run lint
```

## 📚 Estrutura do Projeto

```
siscr/
├── accounts/          # Autenticação e usuários
├── cadastros/        # Cadastros (pessoas, produtos, serviços)
├── core/             # Funcionalidades core
├── payments/          # Integração com Stripe
├── public/            # APIs públicas (signup, planos)
├── subscriptions/     # Assinaturas e planos
├── tenants/           # Modelos de tenant
├── frontend/          # Aplicação React
├── docs/              # Documentação
├── terraform/         # Infraestrutura como código
└── siscr/             # Configurações Django
```

## 🔐 Autenticação Multi-Tenant

O SISCR usa **django-tenants** para multi-tenancy. Cada tenant tem seu próprio schema no banco de dados.

### Como Funciona

1. **Schema Público**: Armazena dados compartilhados (tenants, planos, etc.)
2. **Schemas de Tenant**: Cada tenant tem seu próprio schema isolado

### Criar um Tenant Manualmente

```python
from tenants.models import Tenant, Domain

tenant = Tenant.objects.create(
    name="Minha Empresa",
    schema_name="minha_empresa"
)

Domain.objects.create(
    domain="minha-empresa",
    tenant=tenant,
    is_primary=True
)
```

## 🗄️ Banco de Dados

### Schemas

- `public`: Schema público (tenants, planos, etc.)
- `tenant_*`: Schemas de cada tenant

### Migrações

```bash
# Migrar schema público
python manage.py migrate_schemas --shared

# Migrar todos os tenants
python manage.py migrate_schemas

# Migrar tenant específico
python manage.py migrate_schemas --schema=minha_empresa
```

## 🔄 Fluxo de Desenvolvimento

1. **Criar Branch**
   ```bash
   git checkout -b feature/minha-feature
   ```

2. **Fazer Alterações**
   - Código
   - Testes
   - Documentação

3. **Commit**
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade"
   ```

4. **Push e Pull Request**
   ```bash
   git push origin feature/minha-feature
   ```

## 🐛 Debugging

### Backend

```python
# Adicione breakpoints
import pdb; pdb.set_trace()

# Ou use o debugger do VS Code
```

### Frontend

```javascript
// Use o React DevTools
// Ou console.log
console.log('Debug:', data);
```

## 📝 Variáveis de Ambiente Importantes

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SECRET_KEY` | Chave secreta do Django | (obrigatório) |
| `DEBUG` | Modo debug | `False` |
| `ENVIRONMENT` | Ambiente (development/production) | `development` |
| `DATABASE_URL` | URL do banco de dados | (obrigatório) |
| `REDIS_URL` | URL do Redis | `redis://127.0.0.1:6379/1` |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe | (opcional) |

## 🚨 Problemas Comuns

### Erro: "No module named 'psycopg2'"

```bash
pip install psycopg2-binary
```

### Erro: "Connection refused" (Redis)

Verifique se o Redis está rodando:
```bash
redis-cli ping
```

### Erro: "Schema does not exist"

Execute as migrações:
```bash
python manage.py migrate_schemas --shared
```

### Erro: "CORS" no frontend

Configure `CORS_ALLOWED_ORIGINS` no `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
```

## 📖 Documentação Adicional

- [Documentação da API](./API_DOCUMENTATION.md)
- [Guia de Testes](./TESTES.md)
- [Roadmap CI/CD](./CI_CD_ROADMAP.md)

## 💡 Dicas

1. **Use Docker** para desenvolvimento se possível (mais fácil de configurar)
2. **Ative o modo DEBUG** apenas em desenvolvimento
3. **Use variáveis de ambiente** para configurações sensíveis
4. **Execute testes** antes de fazer commit
5. **Documente** suas mudanças

---

**Última atualização:** 2025-01-15

