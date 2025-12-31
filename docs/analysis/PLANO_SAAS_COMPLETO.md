# 🚀 Plano Completo: Transformando SISCR em SaaS

## 📊 Análise: O que JÁ EXISTE vs O que FALTA

### ✅ O QUE JÁ ESTÁ IMPLEMENTADO

1. **Multi-Tenancy (django-tenants)**
   - ✅ Schema isolation por tenant
   - ✅ Modelos Tenant, Domain, Empresa, Filial
   - ✅ Middleware de tenant configurado
   - ✅ Estrutura hierárquica: Tenant → Empresa → Filial

2. **Autenticação Básica**
   - ✅ JWT configurado (SimpleJWT)
   - ✅ Endpoints de token (obtain, refresh, verify)
   - ✅ Frontend React com login funcional
   - ✅ Proteção de rotas no frontend

3. **Estrutura de Dados**
   - ✅ Modelos de cadastros (Pessoa, Produto, Servico)
   - ✅ Modelos financeiros (ContaReceber, ContaPagar)
   - ✅ API REST funcional

4. **Frontend Moderno**
   - ✅ React + TypeScript + Vite
   - ✅ Páginas principais migradas
   - ✅ Componentes reutilizáveis

---

## ❌ O QUE FALTA PARA SER UM SaaS COMPLETO

### 🔴 CRÍTICO - Fase 1 (Essencial para SaaS)

#### 1. **Sistema de Assinaturas e Planos**
- ❌ Modelos: Plan, Subscription, Feature, Quota
- ❌ Integração com gateway de pagamento
- ❌ Webhooks de pagamento
- ❌ Renovação automática
- ❌ Controle de limites por plano

#### 2. **Cadastro Público de Usuários**
- ❌ Página pública de signup (`/signup/`)
- ❌ Formulário de registro de novos clientes
- ❌ Criação automática de tenant e schema
- ❌ Validação de domínio/subdomínio disponível
- ❌ Email de boas-vindas

#### 3. **Recuperação de Senha**
- ❌ Endpoint de reset de senha
- ❌ Email de recuperação
- ❌ Página de redefinição de senha
- ❌ Tokens temporários seguros

#### 4. **Vinculação Usuário-Tenant**
- ❌ Modelo UserProfile vinculado a tenants
- ❌ Suporte a usuários com múltiplos tenants
- ❌ Seleção de tenant/empresa/filial no login
- ❌ Middleware de isolamento de dados

#### 5. **Página Central de Login Multi-Tenant**
- ❌ Identificação de tenant pela URL/subdomínio
- ❌ Seleção de empresa/filial após login
- ❌ Redirecionamento para tenant correto

#### 6. **Gerenciamento de Assinaturas (Admin)**
- ❌ Interface no Django Admin para gerenciar assinaturas
- ❌ Dashboard de assinaturas ativas/inativas
- ❌ Controle de planos e limites

#### 7. **Segurança Avançada**
- ❌ Rate limiting
- ❌ Validação de senha forte
- ❌ Auditoria de ações (audit log)
- ❌ 2FA (opcional, mas recomendado)

---

## 🎯 RESPOSTAS ÀS SUAS PERGUNTAS

### 1. **Precisa criar cadastro de usuário?**

**SIM, mas de duas formas:**

#### A) **Cadastro Público (Novos Clientes)**
- Página pública `/signup/` para novos clientes se registrarem
- Cria automaticamente:
  - Novo Tenant
  - Schema no banco
  - Usuário administrador
  - Domínio/subdomínio
  - Assinatura (trial ou paga)

#### B) **Cadastro Interno (Usuários do Tenant)**
- Usuários adicionais são criados pelo admin do tenant
- Vinculados ao tenant específico
- Não criam novos tenants

**Implementação:**
```python
# accounts/models.py
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    empresa = models.ForeignKey(Empresa, null=True, blank=True)
    filial = models.ForeignKey(Filial, null=True, blank=True)
    role = models.CharField(max_length=50)  # admin, manager, user
```

---

### 2. **Recuperação de Senha e Segurança?**

**SIM, precisa implementar:**

#### Recuperação de Senha:
- ✅ Endpoint: `POST /api/auth/password-reset/`
- ✅ Endpoint: `POST /api/auth/password-reset-confirm/`
- ✅ Email com token temporário
- ✅ Página no frontend para redefinir senha

#### Segurança:
- ✅ Validação de senha forte (já configurado no Django)
- ✅ Rate limiting (prevenir brute force)
- ✅ CSRF protection (já configurado)
- ✅ JWT com expiração (já configurado)
- ⚠️ 2FA (opcional, mas recomendado para planos Enterprise)

**Bibliotecas necessárias:**
```bash
pip install django-ratelimit  # Rate limiting
pip install django-otp  # 2FA (opcional)
```

---

### 3. **Gerenciamento de Assinaturas pela Página de Admin?**

**SIM, é possível e recomendado!**

#### Estrutura Proposta:

**No Django Admin (Schema Público):**
- Gerenciar Planos (Plan)
- Gerenciar Assinaturas (Subscription)
- Ver status de pagamentos
- Ativar/desativar tenants
- Ver métricas de uso

**No Frontend (Dashboard do Dono):**
- Dashboard administrativo separado
- Acesso apenas para superusuário
- Visualização de todas as assinaturas
- Relatórios de receita

**Implementação:**
```python
# subscriptions/admin.py
@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'plan', 'status', 'current_period_end']
    list_filter = ['status', 'plan']
    search_fields = ['tenant__name']
    actions = ['activate_subscription', 'cancel_subscription']
```

---

### 4. **Página Central de Login e Identificação de Tenant/Empresa/Filial?**

**SIM, precisa de uma página central inteligente!**

#### Fluxo Proposto:

**Opção A: Subdomínio (Recomendado para Produção)**
```
https://tenant1.siscr.com.br/login  → Identifica tenant pelo subdomínio
https://tenant2.siscr.com.br/login  → Identifica tenant pelo subdomínio
```

**Opção B: Path-based (Para Desenvolvimento)**
```
https://siscr.com.br/login?tenant=tenant1  → Identifica pelo parâmetro
```

**Fluxo de Login:**
1. Usuário acessa página de login
2. Sistema identifica tenant pela URL/subdomínio
3. Usuário faz login
4. Se usuário tem acesso a múltiplas empresas/filiais:
   - Mostra seletor de empresa/filial
   - Redireciona para dashboard da empresa/filial selecionada
5. Se usuário tem acesso a apenas uma empresa/filial:
   - Redireciona diretamente para dashboard

**Implementação:**
```python
# accounts/views.py
class TenantAwareLoginView(APIView):
    def post(self, request):
        # Identificar tenant pela URL
        tenant = get_tenant_from_request(request)
        
        # Autenticar usuário
        user = authenticate(...)
        
        # Verificar se usuário tem acesso ao tenant
        if not user_has_access_to_tenant(user, tenant):
            return Response({'error': 'Acesso negado'}, 403)
        
        # Se múltiplas empresas, retornar lista
        empresas = get_user_empresas(user, tenant)
        if len(empresas) > 1:
            return Response({
                'token': token,
                'empresas': empresas,  # Cliente escolhe no frontend
            })
        
        # Se apenas uma, redirecionar direto
        return Response({
            'token': token,
            'redirect': f'/dashboard?empresa={empresas[0].id}'
        })
```

---

### 5. **URLs Multitenant - Como Fica?**

**Estratégia Recomendada: Subdomínios**

#### Estrutura de URLs:

**Schema Público (Sem Tenant):**
- `https://siscr.com.br/` - Landing page
- `https://siscr.com.br/signup/` - Cadastro público
- `https://siscr.com.br/login/` - Login público (redireciona)

**Por Tenant (Subdomínio):**
- `https://tenant1.siscr.com.br/` - Dashboard do tenant1
- `https://tenant1.siscr.com.br/login/` - Login do tenant1
- `https://tenant1.siscr.com.br/dashboard/` - Dashboard
- `https://tenant1.siscr.com.br/cadastros/` - Cadastros

**Configuração no Django:**
```python
# settings.py
PUBLIC_SCHEMA_URLCONF = 'siscr.public_urls'  # URLs públicas
TENANT_SCHEMA_URLCONF = 'siscr.tenant_urls'  # URLs por tenant
```

**DNS e Nginx:**
```nginx
# Nginx configuração
server {
    server_name *.siscr.com.br;
    location / {
        proxy_pass http://localhost:8000;
    }
}
```

**Para Desenvolvimento (localhost):**
- Usar path-based: `/tenant1/...` ou `/tenant2/...`
- Ou configurar hosts locais: `tenant1.localhost`, `tenant2.localhost`

---

## 📋 PLANO DE IMPLEMENTAÇÃO DETALHADO

### FASE 1: Fundação SaaS (4-6 semanas)

#### Semana 1-2: Sistema de Assinaturas
- [ ] Criar app `subscriptions`
- [ ] Modelos: Plan, Subscription, Feature, Quota
- [ ] Admin para gerenciar planos
- [ ] Middleware de verificação de quotas
- [ ] Decoradores para verificar limites

#### Semana 2-3: Cadastro Público
- [ ] Página pública `/signup/`
- [ ] API de cadastro público
- [ ] Criação automática de tenant
- [ ] Validação de domínio disponível
- [ ] Email de boas-vindas

#### Semana 3-4: Autenticação Multi-Tenant
- [ ] Modelo UserProfile vinculado a tenant
- [ ] Login com identificação de tenant
- [ ] Seleção de empresa/filial
- [ ] Middleware de isolamento
- [ ] API de troca de tenant

#### Semana 4-5: Recuperação de Senha
- [ ] Endpoints de reset de senha
- [ ] Email de recuperação
- [ ] Página frontend de reset
- [ ] Tokens temporários seguros

#### Semana 5-6: Integração de Pagamento
- [ ] Escolher gateway (Stripe ou Mercado Pago)
- [ ] Integração com gateway
- [ ] Webhooks de pagamento
- [ ] Renovação automática
- [ ] Testes de pagamento

---

### FASE 2: Operações e Segurança (3-4 semanas)

#### Semana 7-8: Segurança
- [ ] Rate limiting
- [ ] Audit log
- [ ] Validação de senha forte
- [ ] 2FA (opcional)

#### Semana 8-9: Métricas e Analytics
- [ ] Dashboard de uso por tenant
- [ ] Tracking de recursos
- [ ] Relatórios exportáveis

#### Semana 9-10: Backup e Monitoramento
- [ ] Backup automatizado
- [ ] Configurar Sentry
- [ ] Health checks
- [ ] Alertas

---

### FASE 3: Experiência (2-3 semanas)

#### Semana 11-12: Portal de Suporte
- [ ] Sistema de tickets
- [ ] Base de conhecimento
- [ ] Notificações

#### Semana 12-13: Compliance LGPD
- [ ] Exportação de dados
- [ ] Exclusão de dados
- [ ] Logs de acesso

---

## 🏗️ ESTRUTURA DE ARQUIVOS PROPOSTA

```
siscr/
├── subscriptions/          # 🆕 App de assinaturas
│   ├── models.py          # Plan, Subscription, Feature, Quota
│   ├── admin.py           # Admin para gerenciar assinaturas
│   ├── middleware.py      # Verificação de quotas
│   ├── decorators.py      # Decoradores de limite
│   ├── views.py           # Views de assinatura
│   └── api/               # API de assinaturas
│
├── accounts/              # 🔄 Expandir app de autenticação
│   ├── models.py          # UserProfile, TenantMembership
│   ├── views.py           # Login multi-tenant, reset senha
│   ├── serializers.py     # Serializers de autenticação
│   └── api/               # API de autenticação
│
├── public/                # 🆕 App para páginas públicas
│   ├── views.py           # Signup público
│   ├── templates/         # Templates públicos
│   └── api/               # API pública (signup, plans)
│
└── tenants/               # ✅ Já existe
    └── models.py          # Tenant, Domain, Empresa, Filial
```

---

## 🔐 SEGURANÇA - Checklist Completo

### Implementar:
- [x] JWT com expiração (já existe)
- [x] CSRF protection (já existe)
- [x] Validação de senha (já existe no Django)
- [ ] Rate limiting (prevenir brute force)
- [ ] Audit log (registrar ações importantes)
- [ ] 2FA (opcional, mas recomendado)
- [ ] Criptografia de dados sensíveis
- [ ] HTTPS obrigatório em produção
- [ ] Headers de segurança (HSTS, CSP, etc.)

---

## 💰 Gerenciamento de Assinaturas - Detalhamento

### No Django Admin (Schema Público):

**Planos (Plan):**
- Criar/editar planos
- Definir preços e limites
- Ativar/desativar planos

**Assinaturas (Subscription):**
- Ver todas as assinaturas
- Ativar/desativar manualmente
- Ver histórico de pagamentos
- Cancelar assinaturas
- Alterar plano de um tenant

**Tenants:**
- Ver todos os tenants
- Ativar/desativar tenants
- Ver métricas de uso

### Dashboard Administrativo (Frontend):

**Página: `/admin-dashboard/`** (acesso apenas para superusuário)
- Visão geral de todas as assinaturas
- Gráficos de receita
- Métricas de uso
- Alertas de assinaturas expirando

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

1. **Criar app `subscriptions`**
   ```bash
   python manage.py startapp subscriptions
   ```

2. **Expandir app `accounts`**
   - Adicionar UserProfile
   - Implementar login multi-tenant

3. **Criar app `public`**
   ```bash
   python manage.py startapp public
   ```

4. **Definir modelos de assinatura**
   - Plan, Subscription, Feature, Quota

5. **Escolher gateway de pagamento**
   - Stripe (internacional)
   - Mercado Pago (Brasil)

---

## 📝 Resumo Executivo

### O que JÁ TEM:
✅ Multi-tenancy com schema isolation
✅ Autenticação JWT básica
✅ Estrutura de dados completa
✅ Frontend React moderno

### O que FALTA (Crítico):
❌ Sistema de assinaturas e planos
❌ Cadastro público de novos clientes
❌ Recuperação de senha
❌ Login multi-tenant com seleção de empresa/filial
❌ Gerenciamento de assinaturas no admin
❌ URLs por subdomínio
❌ Segurança avançada (rate limiting, audit log)

### Tempo Estimado:
- **Fase 1 (Crítico)**: 4-6 semanas
- **Fase 2 (Operações)**: 3-4 semanas
- **Fase 3 (Experiência)**: 2-3 semanas
- **Total**: 9-13 semanas para SaaS completo

---

**Última atualização**: 2025-01-27
**Status**: Planejamento detalhado completo

