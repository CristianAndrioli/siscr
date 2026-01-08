# 📋 Plano de Evolução - SISCR para SaaS Multi-Tenant

> ⚠️ **ATENÇÃO**: Este plano foi atualizado. Para decisões de arquitetura de produção, consulte `ARQUITETURA_PRODUCAO.md`

## 🎯 Resumo dos Requisitos

### Objetivos Principais:
1. **Sistema Modular**: Módulos independentes (NF Saída, NF Entrada, Cadastro Produto, Gestão Importação, etc.)
2. **SaaS Multi-Tenant**: Sistema para múltiplos clientes (prefeituras, empresas) isolados
3. **Controle de Usuários e Permissões**: Sistema robusto de autenticação e autorização
4. **Backup e Recuperação**: Estratégia completa de backup automatizado
5. **ORM e Migrações**: Estrutura organizada para evolução do banco de dados

---

## 📚 Bibliotecas Django Recomendadas

### Multi-Tenancy
- **django-tenants** ⭐⭐⭐ (ESCOLHIDO - Produção)
  - Suporte a schema isolation (PostgreSQL)
  - Middleware automático
  - Migrations por tenant
  - Muito maduro e documentado
  - **DECISÃO**: Schema Isolation (máxima segurança)
  - GitHub: https://github.com/django-tenants/django-tenants

### Permissões Avançadas
- **django-guardian** ⭐⭐⭐ (ESCOLHIDO - Produção)
  - Permissões por objeto (não apenas por modelo)
  - Permissões customizadas por tenant
  - GitHub: https://github.com/django-guardian/django-guardian

### Backup
- **django-dbbackup**
  - Backup automatizado do banco
  - Suporte a PostgreSQL, MySQL, SQLite
  - Integração com S3, Google Cloud, etc.
  - GitHub: https://github.com/django-dbbackup/django-dbbackup

### Outras Úteis
- **django-extensions**: Comandos úteis e ferramentas
- **django-cors-headers**: Para APIs futuras
- **django-rest-framework**: Se precisar de API REST
- **celery**: Para tarefas assíncronas (backups, emails, etc.)

---

## 🗂️ Estratégia de Arquitetura Modular

### Estrutura de Apps Django Propostas:

```
siscr/
├── tenants/              # App de multi-tenancy
│   ├── models.py        # Tenant, Domain
│   └── middleware.py    # TenantMiddleware
│
├── accounts/            # App de usuários e autenticação
│   ├── models.py       # User (estender), Profile, Role
│   ├── permissions.py  # Permissões customizadas
│   └── views.py        # Login, registro, perfil
│
├── core/               # App base (mantém)
│   └── (models existentes)
│
├── cadastro/           # Módulo de Cadastros
│   ├── models.py       # Produto, Servico, Pessoa
│   ├── views.py
│   └── urls.py
│
├── nf_saida/           # Módulo Nota Fiscal de Saída
│   ├── models.py
│   ├── views.py
│   └── urls.py
│
├── nf_entrada/          # Módulo Nota Fiscal de Entrada
│   ├── models.py
│   ├── views.py
│   └── urls.py
│
├── importacao/          # Módulo Gestão de Importação
│   ├── models.py
│   ├── views.py
│   └── urls.py
│
└── backup/              # App para gerenciar backups
    ├── management/
    │   └── commands/
    │       └── backup_db.py
    └── tasks.py         # Tarefas Celery para backup
```

---

## 📅 Plano de Execução por Etapas

### **ETAPA 1: Fundação Multi-Tenant** 🔴 Prioridade Alta
**Objetivo**: Implementar isolamento de dados por tenant

**Tarefas**:
1. Instalar `django-tenants`
2. Criar app `tenants` com modelo Tenant
3. Configurar database router
4. Configurar middleware de tenant
5. Migrar estrutura existente para schema público
6. Criar primeiro tenant (prefeitura exemplo)
7. Testar isolamento de dados

**Critérios de Sucesso**:
- ✅ Dados isolados por tenant
- ✅ URL routing por subdomínio ou domínio
- ✅ Migrations funcionando por tenant

**Estimativa**: 1-2 semanas

---

### **ETAPA 2: Sistema de Usuários e Permissões** 🔴 Prioridade Alta
**Objetivo**: Autenticação robusta e controle granular de permissões

**Tarefas**:
1. Estender modelo User do Django (AbstractUser)
2. Criar app `accounts` com Profile, Role, Permission
3. Instalar `django-guardian` (opcional, se precisar permissões por objeto)
4. Criar grupos de permissões padrão:
   - Super Admin
   - Admin Tenant
   - Gestor
   - Operador
   - Visualizador
5. Implementar decoradores e mixins de permissão
6. Criar interface de gerenciamento de usuários
7. Implementar convite de usuários por email
8. Sistema de recuperação de senha

**Critérios de Sucesso**:
- ✅ Usuários vinculados a tenants
- ✅ Permissões funcionando por módulo
- ✅ Interface de gerenciamento de usuários

**Estimativa**: 2-3 semanas

---

### **ETAPA 3: Refatoração para Módulos** 🟡 Prioridade Média
**Objetivo**: Organizar código em módulos independentes

**Tarefas**:
1. Criar estrutura de apps modulares:
   - `cadastro/` (mover Produto, Servico, Pessoa do core)
   - `nf_saida/`
   - `nf_entrada/`
   - `importacao/`
2. Migrar models existentes para módulos apropriados
3. Criar sistema de registro de módulos (para ativar/desativar por tenant)
4. Implementar menu dinâmico baseado em módulos ativos
5. Criar migrations de dados (preservar dados existentes)
6. Testes de regressão

**Critérios de Sucesso**:
- ✅ Cada módulo independente
- ✅ Módulos podem ser ativados/desativados por tenant
- ✅ Dados existentes preservados

**Estimativa**: 2-3 semanas

---

### **ETAPA 4: Estratégia de Backup** 🟡 Prioridade Média
**Objetivo**: Backup automatizado e recuperação

**Tarefas**:
1. Instalar `django-dbbackup` ou criar sistema custom
2. Configurar backup do PostgreSQL:
   - Backup completo diário
   - Backup incremental por hora (opcional)
   - Backup por tenant (opcional)
3. Configurar backup de arquivos estáticos e media
4. Integrar com serviço de cloud (S3, Google Cloud Storage)
5. Criar comandos de management:
   - `backup_db` - Backup do banco
   - `restore_db` - Restaurar backup
   - `list_backups` - Listar backups disponíveis
6. Configurar Celery para backups agendados
7. Criar interface web para gerenciar backups
8. Documentar procedimentos de restauração
9. Testar processo de restauração completo

**Estratégia de Backup Detalhada**:

```
Backup Diário Completo:
- Horário: 02:00 AM
- Retenção: 30 dias
- Local: S3 bucket ou servidor dedicado
- Compressão: gzip

Backup Incremental (opcional):
- Horário: A cada 6 horas
- Retenção: 7 dias
- Método: pg_dump com --incremental

Backup por Tenant (opcional):
- Permite restaurar apenas um tenant específico
- Útil para rollback de mudanças específicas

Backup de Arquivos:
- Media files: diário
- Static files: semanal (raramente mudam)
```

**Critérios de Sucesso**:
- ✅ Backups automáticos funcionando
- ✅ Restauração testada e documentada
- ✅ Interface de gerenciamento de backups

**Estimativa**: 1-2 semanas

---

### **ETAPA 5: Migrações e ORM** 🟢 Prioridade Baixa (Ongoing)
**Objetivo**: Estrutura organizada para evolução do banco

**Tarefas**:
1. Criar convenções de nomenclatura de migrations
2. Documentar processo de criação de migrations
3. Implementar data migrations quando necessário
4. Criar fixtures para dados iniciais
5. Configurar CI/CD para testar migrations
6. Criar rollback scripts para migrations críticas

**Boas Práticas**:
- Migrations sempre reversíveis quando possível
- Testar migrations em ambiente de staging primeiro
- Documentar migrations complexas
- Usar `RunPython` para migrations de dados críticos

**Critérios de Sucesso**:
- ✅ Processo documentado
- ✅ Migrations testadas
- ✅ Rollback funcionando

**Estimativa**: 1 semana (ongoing)

---

### **ETAPA 6: Módulo de Gestão de Importação** 🟡 Prioridade Média
**Objetivo**: Primeiro módulo funcional completo

**Tarefas**:
1. Criar app `importacao/`
2. Modelos:
   - ProcessoImportacao
   - DocumentoImportacao
   - EtapaProcesso
   - ChecklistImportacao
3. Views e templates
4. Integração com outros módulos (cadastro, NF)
5. Permissões específicas do módulo
6. Testes unitários e integração

**Critérios de Sucesso**:
- ✅ Módulo funcional e isolado
- ✅ Integração com outros módulos
- ✅ Testes passando

**Estimativa**: 3-4 semanas

---

### **ETAPA 7: Módulos de Nota Fiscal** 🟡 Prioridade Média
**Objetivo**: Módulos NF Saída e Entrada

**Tarefas**:
1. Criar apps `nf_saida/` e `nf_entrada/`
2. Modelos de NF (NFe, NFSe)
3. Integração com APIs da Receita Federal (se necessário)
4. Geração de XML
5. Validações fiscais
6. Dashboard de notas fiscais

**Critérios de Sucesso**:
- ✅ Módulos funcionais
- ✅ Integração com APIs
- ✅ Validações funcionando

**Estimativa**: 4-6 semanas

---

### **ETAPA 8: Interface e UX** 🟢 Prioridade Baixa
**Objetivo**: Melhorar experiência do usuário

**Tarefas**:
1. Dashboard por tenant
2. Menu dinâmico baseado em permissões
3. Notificações em tempo real
4. Melhorias de UI/UX
5. Responsividade mobile

**Estimativa**: 2-3 semanas

---

### **ETAPA 9: Otimizações e Performance** 🟢 Prioridade Baixa
**Objetivo**: Otimizar performance para múltiplos tenants

**Tarefas**:
1. Cache por tenant (Redis)
2. Otimização de queries
3. Indexação de banco de dados
4. CDN para arquivos estáticos
5. Monitoring e logging

**Estimativa**: 2 semanas

---

### **ETAPA 10: Deploy e Produção** 🔴 Prioridade Alta (Final)
**Objetivo**: Preparar para produção

**Tarefas**:
1. Configurar ambiente de produção
2. SSL/HTTPS
3. Variáveis de ambiente seguras
4. Monitoring (Sentry, etc.)
5. Documentação de deploy
6. Treinamento de equipe

**Estimativa**: 2 semanas

---

## 🔄 Ordem Recomendada de Execução

```
FASE 1 - FUNDAÇÃO (Semanas 1-5)
├── Etapa 1: Multi-Tenant (Semanas 1-2)
└── Etapa 2: Usuários e Permissões (Semanas 3-5)

FASE 2 - REFATORAÇÃO (Semanas 6-8)
├── Etapa 3: Módulos (Semanas 6-8)
└── Etapa 4: Backup (Semanas 7-8, paralelo)

FASE 3 - DESENVOLVIMENTO (Semanas 9-16)
├── Etapa 6: Gestão Importação (Semanas 9-12)
└── Etapa 7: Notas Fiscais (Semanas 13-16)

FASE 4 - POLIMENTO (Semanas 17-20)
├── Etapa 5: Migrações (Ongoing)
├── Etapa 8: Interface (Semanas 17-19)
└── Etapa 9: Performance (Semanas 19-20)

FASE 5 - PRODUÇÃO (Semanas 21-22)
└── Etapa 10: Deploy (Semanas 21-22)
```

---

## 📦 Dependências a Adicionar

```txt
# requirements.txt (atualizado - PRODUÇÃO)

# Django Core
Django>=4.2.0,<5.0.0
psycopg2-binary>=2.9.0

# Multi-Tenancy
django-tenants>=3.5.0

# API REST
djangorestframework>=3.14.0
djangorestframework-simplejwt>=5.2.0  # Autenticação JWT

# Permissões
django-guardian>=2.4.0

# Backup
django-dbbackup>=4.2.0
boto3>=1.28.0  # Para S3

# Tarefas Assíncronas
celery>=5.3.0
redis>=5.0.0

# CORS (para frontend separado)
django-cors-headers>=4.2.0

# Utilitários
django-extensions>=3.2.0

# Monitoring (produção)
sentry-sdk>=1.32.0
```

---

## 🗄️ Estrutura de Banco de Dados Multi-Tenant

### Schema Público (Compartilhado)
- `public.tenants_tenant` - Tabela de tenants
- `public.tenants_domain` - Domínios associados
- `public.django_*` - Tabelas do Django (sessões, etc.)

### Schema por Tenant
Cada tenant terá seu próprio schema:
- `tenant1.core_*` - Models do core
- `tenant1.cadastro_*` - Models de cadastro
- `tenant1.nf_saida_*` - Models de NF saída
- etc.

**Vantagens**:
- Isolamento total de dados
- Migrations por tenant
- Backups por tenant
- Performance (queries isoladas)

---

## 🔐 Estratégia de Permissões

### Níveis de Permissão

1. **Super Admin** (Sistema)
   - Acesso a tudo
   - Gerenciar tenants
   - Configurações globais

2. **Admin Tenant** (Por Tenant)
   - Gerenciar usuários do tenant
   - Configurar módulos do tenant
   - Acesso a todos os módulos do tenant

3. **Gestor** (Por Tenant)
   - Acesso a módulos específicos
   - Pode criar/editar
   - Não pode excluir dados críticos

4. **Operador** (Por Tenant)
   - Acesso limitado a módulos
   - Pode criar/editar
   - Não pode configurar

5. **Visualizador** (Por Tenant)
   - Apenas leitura
   - Relatórios

### Implementação
- Django Groups para roles
- Permissões por módulo (Model permissions)
- Permissões por objeto (django-guardian) quando necessário
- Decoradores customizados para verificar permissões

---

## 📊 Estratégia de Backup Detalhada

### Opção 1: django-dbbackup (Recomendado)

**Vantagens**:
- Integrado com Django
- Suporte a múltiplos backends
- Fácil integração com S3
- Comandos de management prontos

**Configuração**:
```python
# settings.py
DBBACKUP_STORAGE = 'dbbackup.storage.s3_storage'
DBBACKUP_STORAGE_OPTIONS = {
    'access_key': os.environ.get('AWS_ACCESS_KEY_ID'),
    'secret_key': os.environ.get('AWS_SECRET_ACCESS_KEY'),
    'bucket_name': 'siscr-backups',
}
```

### Opção 2: Scripts Customizados (Mais Controle)

**Vantagens**:
- Controle total
- Backup por tenant
- Backup incremental
- Customização completa

**Implementação**:
- Scripts Python usando `pg_dump`
- Agendamento via Celery
- Upload para S3 via boto3

### Recomendação Final
**Usar django-dbbackup + scripts customizados para backup por tenant**

---

## ✅ Checklist de Implementação

### Antes de Começar
- [ ] Revisar e aprovar este plano
- [ ] Criar branch `feature/multi-tenant`
- [ ] Configurar ambiente de desenvolvimento
- [ ] Backup completo do banco atual

### Etapa 1 - Multi-Tenant
- [ ] Instalar django-tenants
- [ ] Criar app tenants
- [ ] Configurar database router
- [ ] Testar isolamento

### Etapa 2 - Usuários
- [ ] Estender User model
- [ ] Criar app accounts
- [ ] Implementar permissões
- [ ] Testar autenticação

### Etapa 3 - Módulos
- [ ] Criar estrutura de apps
- [ ] Migrar models
- [ ] Sistema de ativação de módulos
- [ ] Testes de regressão

### Etapa 4 - Backup
- [ ] Instalar django-dbbackup
- [ ] Configurar S3
- [ ] Criar comandos customizados
- [ ] Testar restauração

---

## 📝 Notas Importantes

1. **Migrações**: Sempre fazer backup antes de migrations complexas
2. **Testes**: Escrever testes para cada nova funcionalidade
3. **Documentação**: Documentar decisões importantes
4. **Code Review**: Revisar código antes de merge
5. **Staging**: Testar em ambiente de staging antes de produção

---

## 🎯 Próximos Passos Imediatos

1. **Revisar e aprovar este plano**
2. **Criar branch de desenvolvimento**
3. **Iniciar Etapa 1: Multi-Tenant**
4. **Configurar ambiente de teste**

---

**Última atualização**: 2025-11-05
**Versão do Plano**: 1.0

