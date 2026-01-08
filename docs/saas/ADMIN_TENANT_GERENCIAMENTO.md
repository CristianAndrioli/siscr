# 🏢 Gerenciamento de Tenants no Painel Administrativo

## 📋 Visão Geral

Este documento explica como funciona o sistema multitenant e como gerenciar tenants através do painel administrativo do Django.

## 🔄 Como Funciona o Sistema Multitenant

### 1. Criação de Tenant

Quando um novo usuário adquire o sistema através do endpoint de signup (`/api/public/signup/`), o seguinte processo acontece automaticamente:

1. **Criação do Tenant** - Um novo registro `Tenant` é criado no schema público
2. **Criação do Schema** - Um novo schema PostgreSQL é criado no banco de dados
3. **Criação do Domínio** - Um registro `Domain` é criado vinculando o tenant ao domínio/subdomínio
4. **Aplicação de Migrations** - As migrations são executadas no schema do tenant para criar todas as tabelas
5. **Criação do Usuário Admin** - Um usuário administrador é criado no schema público e no schema do tenant
6. **Criação da Empresa** - Uma empresa inicial é criada no schema do tenant
7. **Criação da Assinatura** - Uma assinatura é criada vinculando o tenant ao plano escolhido

**Arquivo:** `public/views.py` - Função `signup()`

### 2. Estrutura de Dados

Cada tenant possui:
- **Schema próprio** no PostgreSQL (isolamento completo de dados)
- **Domínios/Subdomínios** para acesso (ex: `empresa1.siscr.com.br`)
- **Usuários** vinculados através de `TenantMembership`
- **Empresas e Filiais** dentro do schema do tenant
- **Assinatura** vinculada a um plano
- **Quotas** de uso (usuários, empresas, filiais, storage)

### 3. Visualização no Painel Admin

O painel administrativo do Django (`/admin/`) permite visualizar e gerenciar todos os tenants. Apenas **superusuários** têm acesso ao painel admin global.

**Acesso:** `/admin/tenants/tenant/`

## 🎨 Personalização do Painel Admin

O painel administrativo é **totalmente personalizável** através do Django Admin. O arquivo `tenants/admin.py` contém todas as configurações.

### Funcionalidades Implementadas

#### 1. Lista de Tenants Melhorada

A lista de tenants agora exibe:
- Nome do tenant
- Schema name
- Domínios associados (com destaque para o principal)
- Status (ativo/inativo)
- Data de criação
- Botão de ações

#### 2. Detalhes do Tenant

Na página de detalhes de um tenant, você pode ver:

**Informações Básicas:**
- Nome
- Schema name (somente leitura)
- Descrição
- Status

**Domínios:**
- Lista completa de domínios vinculados
- Indicação do domínio principal

**Assinatura:**
- Plano atual
- Status da assinatura (com cores)
- Ciclo de cobrança
- Data de validade

**Estatísticas:**
- Número de usuários
- Número de empresas
- Número de filiais

**Datas:**
- Data de criação
- Data de última atualização

## 🗑️ Exclusão de Tenant

### ⚠️ ATENÇÃO: Operação Irreversível

A exclusão de um tenant remove **TODOS** os dados relacionados:
- ✅ Schema do banco de dados (com todas as tabelas)
- ✅ Domínios vinculados
- ✅ Assinaturas e quotas
- ✅ Membroships de usuários
- ✅ Empresas e filiais (removidas automaticamente com o schema)
- ✅ Todos os dados cadastrais (pessoas, produtos, serviços, etc.)

### Como Excluir um Tenant

#### Método 1: Action em Massa (Recomendado)

1. Acesse `/admin/tenants/tenant/`
2. Selecione um ou mais tenants marcando as caixas de seleção
3. No menu "Ação" no topo, selecione **"🗑️ Excluir tenant completamente (irreversível)"**
4. Clique em "Ir"
5. Confirme a exclusão

#### Método 2: Exclusão Individual

1. Acesse `/admin/tenants/tenant/`
2. Clique no tenant que deseja excluir
3. Clique no botão **"Excluir"** no topo da página
4. Confirme a exclusão

### Requisitos

- Apenas **superusuários** podem excluir tenants
- A operação é **irreversível** - não há como recuperar os dados

### Processo de Exclusão

Quando um tenant é excluído, o sistema executa os seguintes passos:

1. **Remoção de Domínios** - Remove todos os domínios vinculados ao tenant
2. **Remoção do Schema** - Executa `DROP SCHEMA CASCADE` no PostgreSQL, removendo todas as tabelas e dados
3. **Remoção de Assinaturas** - Remove assinaturas e quotas no schema público
4. **Limpeza de Memberships** - Remove `TenantMembership` e atualiza `UserProfile` para remover referências
5. **Remoção do Tenant** - Remove o registro do tenant do schema público

**Arquivo:** `tenants/admin.py` - Métodos `delete_tenant_completely()` e `delete_model()`

## 🔧 Personalização Adicional

### Adicionar Novos Campos

Para adicionar novos campos à visualização do tenant:

1. Edite `tenants/models.py` para adicionar campos ao modelo `Tenant`
2. Crie e execute uma migration: `python manage.py makemigrations tenants && python manage.py migrate`
3. Adicione os campos em `list_display` ou `readonly_fields` em `tenants/admin.py`

### Adicionar Novas Actions

Para adicionar novas ações em massa:

```python
def minha_acao(self, request, queryset):
    """Descrição da ação"""
    # Sua lógica aqui
    self.message_user(request, 'Ação executada!', level='success')

minha_acao.short_description = "Minha Ação"

# Adicione à lista de actions
actions = ['delete_tenant_completely', 'minha_acao']
```

### Adicionar Filtros

Para adicionar novos filtros:

```python
list_filter = ('is_active', 'created_at', 'meu_campo')
```

### Adicionar Campos de Busca

Para adicionar campos pesquisáveis:

```python
search_fields = ('name', 'schema_name', 'meu_campo')
```

## 📊 Exemplo de Uso

### Visualizar Todos os Tenants

1. Acesse `/admin/tenants/tenant/`
2. Você verá uma lista com todos os tenants cadastrados
3. Use os filtros para encontrar tenants específicos
4. Use a busca para encontrar por nome ou schema

### Ver Detalhes de um Tenant

1. Clique no nome de um tenant na lista
2. Veja todas as informações detalhadas
3. Expanda as seções colapsáveis para ver mais informações

### Excluir um Tenant

1. Selecione o tenant na lista
2. Escolha a ação "Excluir tenant completamente"
3. Confirme a exclusão
4. O sistema removerá todos os dados relacionados

## 🔐 Segurança

- Apenas superusuários podem acessar o painel admin
- A exclusão de tenants requer privilégios de superusuário
- Todas as operações são registradas nos logs do Django
- Recomenda-se fazer backup antes de excluir tenants em produção

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup antes de excluir tenants em produção
2. **Testes**: Teste a exclusão em ambiente de desenvolvimento primeiro
3. **Dependências**: Verifique se não há dependências críticas antes de excluir
4. **Notificação**: Considere notificar o cliente antes de excluir o tenant dele

## 🐛 Troubleshooting

### Erro ao Excluir Schema

Se houver erro ao excluir o schema:
- Verifique se há conexões ativas no schema
- Verifique permissões do banco de dados
- Tente excluir manualmente via SQL se necessário

### Dados Órfãos

Se após exclusão houver dados órfãos:
- Limpe manualmente `TenantMembership` e `UserProfile`
- Verifique logs para identificar problemas

## 📚 Referências

- [Django Admin Documentation](https://docs.djangoproject.com/en/stable/ref/contrib/admin/)
- [django-tenants Documentation](https://django-tenants.readthedocs.io/)
- Arquivo: `tenants/admin.py` - Configuração do admin
- Arquivo: `tenants/models.py` - Modelos de tenant
- Arquivo: `public/views.py` - Criação de tenants

