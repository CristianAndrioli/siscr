# 📐 Plano de Reorganização - Estrutura do Projeto

## 🎯 Objetivo

Reorganizar a estrutura do projeto (Backend e Frontend) para melhorar:
- ✅ Manutenibilidade
- ✅ Escalabilidade
- ✅ Separação de responsabilidades
- ✅ Facilidade de migração
- ✅ Desenvolvimento futuro

---

## 🔴 BACKEND - Situação Atual vs Proposta

### **Situação Atual (Problemática)**

```
core/
├── models.py           # Tudo: Pessoa, Produto, Servico
├── views.py           # Tudo: CRUD + outras views misturadas
├── forms.py           # Tudo: Todos os formulários
├── urls.py            # Todas as rotas
├── api/
│   ├── serializers.py # Todos os serializers
│   ├── viewsets.py    # Todos os viewsets
│   └── urls.py        # Rotas da API
└── templates/         # Todos os templates
```

**Problemas:**
- ❌ Tudo no mesmo app `core`
- ❌ Difícil de manter com muitos módulos
- ❌ Não segue arquitetura modular proposta
- ❌ Acoplamento alto

---

### **Estrutura Proposta (Modular)**

```
siscr/
├── tenants/              # ✅ JÁ EXISTE - Multi-tenancy
│   ├── models.py
│   └── admin.py
│
├── accounts/             # 🆕 App de autenticação/permissões
│   ├── models.py        # User estendido, Profile, Role
│   ├── views.py         # Login, Logout, Perfil
│   ├── permissions.py   # Permissões customizadas
│   ├── serializers.py   # API de autenticação
│   └── urls.py
│
├── cadastros/            # 🆕 Módulo de Cadastros
│   ├── models.py        # Pessoa, Produto, Servico
│   ├── views.py         # Views Django (legado)
│   ├── forms.py         # Formulários Django (legado)
│   ├── templates/       # Templates Django (legado)
│   ├── api/
│   │   ├── serializers.py
│   │   ├── viewsets.py
│   │   └── urls.py
│   └── urls.py
│
├── core/                 # ⚠️ REFATORAR - App base/comum
│   ├── models.py        # Apenas modelos comuns (se houver)
│   ├── utils.py         # Utilitários compartilhados
│   ├── constants.py     # Constantes
│   └── exceptions.py    # Exceções customizadas
│
├── nf_saida/             # 🆕 Módulo Nota Fiscal Saída
│   ├── models.py
│   ├── views.py
│   ├── api/
│   └── urls.py
│
├── nf_entrada/           # 🆕 Módulo Nota Fiscal Entrada
│   ├── models.py
│   ├── views.py
│   ├── api/
│   └── urls.py
│
└── importacao/           # 🆕 Módulo Gestão Importação
    ├── models.py
    ├── views.py
    ├── api/
    └── urls.py
```

---

## 🔵 FRONTEND - Situação Atual vs Proposta

### **Situação Atual (Básica)**

```
frontend/src/
├── components/
│   └── Layout.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   └── cadastros/
│       └── CadastroGeral.jsx
└── services/
    ├── api.js
    ├── pessoas.js
    ├── produtos.js
    └── servicos.js
```

**Problemas:**
- ❌ Falta componentes reutilizáveis
- ❌ Falta hooks customizados
- ❌ Falta utilitários
- ❌ Falta constantes
- ❌ Falta tipos/validações
- ❌ Organização por features poderia ser melhor

---

### **Estrutura Proposta (Completa)**

```
frontend/src/
├── components/           # Componentes reutilizáveis
│   ├── common/          # Componentes comuns
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Select.jsx
│   │   ├── Textarea.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   └── Alert.jsx
│   ├── layout/          # Componentes de layout
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   └── forms/           # Componentes de formulário
│       ├── FormField.jsx
│       ├── FormSection.jsx
│       └── FormActions.jsx
│
├── pages/               # Páginas (rotas)
│   ├── auth/
│   │   └── Login.jsx
│   ├── dashboard/
│   │   └── Dashboard.jsx
│   ├── cadastros/
│   │   ├── CadastroGeral.jsx
│   │   ├── CadastroProdutos.jsx
│   │   ├── CadastroServicos.jsx
│   │   ├── ListagemGeral.jsx
│   │   ├── ListagemProdutos.jsx
│   │   └── ListagemServicos.jsx
│   ├── financeiro/
│   └── faturamento/
│
├── features/            # 🆕 Organização por features (opcional)
│   ├── cadastros/
│   │   ├── components/  # Componentes específicos
│   │   ├── hooks/       # Hooks específicos
│   │   ├── services/    # Services específicos
│   │   └── utils/      # Utilitários específicos
│   └── ...
│
├── hooks/               # 🆕 Hooks customizados
│   ├── useForm.js
│   ├── useValidation.js
│   ├── useApi.js
│   └── useAuth.js
│
├── services/            # Services de API
│   ├── api.js          # Configuração base
│   ├── auth.js         # Autenticação
│   ├── cadastros/      # 🆕 Organizar por módulo
│   │   ├── pessoas.js
│   │   ├── produtos.js
│   │   └── servicos.js
│   └── ...
│
├── utils/               # 🆕 Utilitários
│   ├── format.js       # Formatação (moeda, data, etc.)
│   ├── validation.js   # Validações
│   ├── constants.js    # Constantes
│   └── helpers.js      # Funções auxiliares
│
├── constants/           # 🆕 Constantes
│   ├── routes.js
│   ├── api.js
│   └── messages.js
│
├── context/             # 🆕 Context API (se necessário)
│   └── AuthContext.jsx
│
├── App.jsx
└── main.jsx
```

---

## 📋 Plano de Execução

### **FASE 1: Reorganização Backend** 🔴 Prioridade Alta

#### **1.1 Criar App `accounts`**
- [ ] `python manage.py startapp accounts`
- [ ] Mover/extender User model
- [ ] Criar Profile, Role models
- [ ] Mover views de autenticação
- [ ] Criar API de autenticação

#### **1.2 Criar App `cadastros`**
- [ ] `python manage.py startapp cadastros`
- [ ] Mover models: Pessoa, Produto, Servico
- [ ] Mover views relacionadas
- [ ] Mover forms
- [ ] Mover templates
- [ ] Mover API (serializers, viewsets)
- [ ] Atualizar imports

#### **1.3 Refatorar `core`**
- [ ] Manter apenas código comum
- [ ] Criar utils, constants, exceptions
- [ ] Limpar models, views, forms

#### **1.4 Atualizar Configurações**
- [ ] Atualizar `INSTALLED_APPS`
- [ ] Atualizar `SHARED_APPS` e `TENANT_APPS`
- [ ] Atualizar `urls.py` principal
- [ ] Atualizar migrations

---

### **FASE 2: Reorganização Frontend** 🔴 Prioridade Alta

#### **2.1 Criar Componentes Reutilizáveis**
- [ ] `components/common/Button.jsx`
- [ ] `components/common/Input.jsx`
- [ ] `components/common/Select.jsx`
- [ ] `components/common/Textarea.jsx`
- [ ] `components/common/Card.jsx`
- [ ] `components/common/Modal.jsx`
- [ ] `components/common/Alert.jsx`

#### **2.2 Criar Hooks Customizados**
- [ ] `hooks/useForm.js`
- [ ] `hooks/useValidation.js`
- [ ] `hooks/useApi.js`
- [ ] `hooks/useAuth.js`

#### **2.3 Criar Utilitários**
- [ ] `utils/format.js` (formatação)
- [ ] `utils/validation.js` (validações)
- [ ] `utils/constants.js` (constantes)
- [ ] `utils/helpers.js` (helpers)

#### **2.4 Reorganizar Services**
- [ ] Criar `services/auth.js`
- [ ] Mover services para `services/cadastros/`
- [ ] Organizar por módulo

#### **2.5 Criar Constantes**
- [ ] `constants/routes.js`
- [ ] `constants/api.js`
- [ ] `constants/messages.js`

---

### **FASE 3: Migração Gradual** 🟡 Após Reorganização

#### **3.1 Refatorar Componentes Existentes**
- [ ] Usar novos componentes reutilizáveis
- [ ] Usar hooks customizados
- [ ] Usar utilitários

#### **3.2 Continuar Migração**
- [ ] Migrar CadastroProdutos
- [ ] Migrar CadastroServicos
- [ ] Migrar Listagens
- [ ] Usar estrutura organizada

---

## ⚠️ Considerações Importantes

### **Backend:**
1. **Migrations**: Precisa criar novas migrations ao mover models
2. **Dependências**: Verificar imports e dependências
3. **Templates**: Manter templates Django durante migração
4. **API**: Organizar API por módulo

### **Frontend:**
1. **Retrocompatibilidade**: Não quebrar código existente
2. **Gradual**: Fazer reorganização gradual
3. **Testes**: Testar após cada mudança

---

## 🎯 Benefícios da Reorganização

### **Backend:**
- ✅ Separação clara de responsabilidades
- ✅ Fácil adicionar novos módulos
- ✅ Manutenção mais simples
- ✅ Escalabilidade melhor

### **Frontend:**
- ✅ Componentes reutilizáveis
- ✅ Menos duplicação de código
- ✅ Manutenção mais fácil
- ✅ Desenvolvimento mais rápido

---

## 📅 Estimativa

- **FASE 1 (Backend)**: 1-2 dias
- **FASE 2 (Frontend)**: 1-2 dias
- **FASE 3 (Migração)**: Contínua

**Total**: 2-4 dias para reorganização completa

---

## ✅ Decisão

**Recomendação: Fazer reorganização ANTES de continuar migração**

**Motivos:**
1. Evita retrabalho depois
2. Facilita migração futura
3. Melhora qualidade do código
4. Estabelece padrões claros

**Próximo Passo:** Executar FASE 1 (Backend) primeiro, depois FASE 2 (Frontend)

