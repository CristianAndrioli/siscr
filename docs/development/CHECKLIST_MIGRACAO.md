# Checklist de Migração - Página por Página

## 📋 Aspectos a Analisar em Cada Migração

### **Próxima Página: Cadastro de Produtos**

---

## 🔍 **1. Análise do Template Django Original**

### **Localização:**
- [ ] Template: `core/templates/cadastro_produtos.html`
- [ ] View: `core/views.py` → `cadastrar_produtos()`
- [ ] Form: `core/forms.py` → `ProdutoForm`
- [ ] Model: `core/models.py` → `Produto`

### **Estrutura Visual:**
- [ ] Layout geral (grid, espaçamentos)
- [ ] Seções do formulário (Dados Básicos, Tributação, etc.)
- [ ] Campos e seus tipos
- [ ] Botões e ações
- [ ] Mensagens de erro/sucesso
- [ ] Validações visuais

### **Lógica de Negócio:**
- [ ] Cálculo de próximo código
- [ ] Validações de campos
- [ ] Campos obrigatórios vs opcionais
- [ ] Comportamento de campos condicionais
- [ ] Formatação de valores (moeda, porcentagem, etc.)

---

## 🎨 **2. Design e Estilo**

### **Cores:**
- [ ] Cores de fundo (bg-white, bg-gray-50, etc.)
- [ ] Cores de texto (text-gray-800, etc.)
- [ ] Cores de bordas (border-indigo-600, etc.)
- [ ] Cores de botões (bg-indigo-600, bg-green-600, etc.)

### **Espaçamentos:**
- [ ] Padding (p-8, p-4, etc.)
- [ ] Margens (mb-6, mt-8, etc.)
- [ ] Gaps no grid (gap-6, gap-4, etc.)

### **Tipografia:**
- [ ] Tamanhos de título (text-3xl, text-2xl, etc.)
- [ ] Peso de fonte (font-bold, font-semibold, etc.)
- [ ] Labels e textos auxiliares

### **Componentes Visuais:**
- [ ] Cards/seções (bg-gray-50, border, rounded-lg)
- [ ] Inputs (classes Tailwind)
- [ ] Selects
- [ ] Checkboxes
- [ ] Botões (hover effects, transitions)

---

## ⚙️ **3. Funcionalidades**

### **CRUD:**
- [ ] Criar novo produto
- [ ] Editar produto existente
- [ ] Excluir produto
- [ ] Listar produtos (página separada)

### **Validações:**
- [ ] Campos obrigatórios
- [ ] Formatos (CPF, CNPJ, CEP, etc.)
- [ ] Valores numéricos (min/max)
- [ ] Validações customizadas

### **Integrações:**
- [ ] API REST (`/api/produtos/`)
- [ ] Endpoint de próximo código
- [ ] Tratamento de erros da API
- [ ] Loading states

---

## 🔄 **4. Comportamento**

### **Interações:**
- [ ] Mudança de campos (onChange)
- [ ] Submissão de formulário
- [ ] Cancelamento/Voltar
- [ ] Limpar formulário
- [ ] Confirmações (exclusão, etc.)

### **Estado:**
- [ ] Estado do formulário
- [ ] Estado de loading
- [ ] Estado de erro
- [ ] Estado de sucesso

### **Navegação:**
- [ ] Redirecionamento após salvar
- [ ] Links para outras páginas
- [ ] Histórico do navegador

---

## 📱 **5. Responsividade**

### **Breakpoints:**
- [ ] Mobile (< 640px)
- [ ] Tablet (640px - 1024px)
- [ ] Desktop (> 1024px)

### **Grid:**
- [ ] Colunas no mobile (col-span-1)
- [ ] Colunas no tablet (md:col-span-2)
- [ ] Colunas no desktop (lg:col-span-4)

---

## 🧪 **6. Testes**

### **Funcional:**
- [ ] Criar produto com dados válidos
- [ ] Criar produto com dados inválidos
- [ ] Editar produto existente
- [ ] Excluir produto
- [ ] Validações de campos
- [ ] Integração com API

### **Visual:**
- [ ] Comparar com template Django original
- [ ] Verificar responsividade
- [ ] Verificar estados (loading, error, success)

---

## 📝 **7. Componentes React**

### **Estrutura:**
```jsx
// frontend/src/pages/cadastros/CadastroProdutos.jsx
- [ ] Importações necessárias
- [ ] Estado do formulário
- [ ] Hooks (useState, useEffect, useNavigate, useParams)
- [ ] Funções auxiliares
- [ ] Handlers (onChange, onSubmit, etc.)
- [ ] Renderização condicional
- [ ] JSX completo
```

### **Reutilização:**
- [ ] Componentes comuns (Input, Select, Button)
- [ ] Hooks customizados (useForm, useValidation)
- [ ] Serviços de API

---

## 🔗 **8. Integração**

### **API:**
- [ ] Serviço `produtosService` criado
- [ ] Endpoints testados
- [ ] Tratamento de erros
- [ ] Loading states

### **Rotas:**
- [ ] Rota no `App.jsx`
- [ ] Link no Layout (sidebar)
- [ ] Navegação funcionando

---

## ✅ **Checklist de Migração Completa**

### **Antes de Considerar Completo:**
- [ ] Design idêntico ao template Django
- [ ] Todas as funcionalidades implementadas
- [ ] Validações funcionando
- [ ] Integração com API testada
- [ ] Responsividade verificada
- [ ] Erros tratados
- [ ] Loading states implementados
- [ ] Mensagens de sucesso/erro
- [ ] Navegação funcionando
- [ ] Código limpo e organizado

---

## 🎯 Próxima Página: **Cadastro de Produtos**

### **Prioridade:** Alta
### **Complexidade:** Média-Alta (muitos campos, seções, validações)
### **Tempo Estimado:** 2-3 horas

### **Seções do Formulário:**
1. Dados Básicos e Valores
2. Tributação Nacional
3. Comércio Exterior

### **Campos Principais:**
- Código (auto)
- Nome *
- Descrição
- Ativo (checkbox)
- Valor Custo *
- Valor Venda *
- Unidade de Medida
- Peso Líquido/Bruto
- NCM *
- CFOP Interno
- Origem Mercadoria
- CST/CSOSN ICMS
- Alíquotas (ICMS, IPI, II)
- DI, Incoterm, Moeda
- E mais...

---

## 📚 **Referências**

- **Template Original:** `core/templates/cadastro_produtos.html`
- **View Original:** `core/views.py` → `cadastrar_produtos()`
- **Form Original:** `core/forms.py` → `ProdutoForm`
- **Model:** `core/models.py` → `Produto`
- **API:** `core/api/viewsets.py` → `ProdutoViewSet`
- **Service:** `frontend/src/services/produtos.js`

