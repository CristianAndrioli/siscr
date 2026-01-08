# Telas do Frontend - Relatórios

## 📋 Resumo das Telas

O sistema de relatórios possui **4 telas principais** no frontend:

1. **Configurações de Relatórios** (`/configuracoes/relatorios`)
2. **Geração de Relatórios de Estoque** (`/estoque/relatorio`)
3. **Formulário de Templates** (modal dentro de Configurações)
4. **Configurações Gerais** (aba dentro de Configurações)

---

## 1. Configurações de Relatórios

**Rota:** `/configuracoes/relatorios`  
**Arquivo:** `frontend/src/pages/configuracoes/Relatorios.tsx`

### Funcionalidades:
- **Aba "Templates"**: Lista todos os templates de relatórios
  - Grid com colunas: Nome, Código, Módulo, Tipo, Status
  - Botão "Novo Template" para criar template
  - Botão de editar/excluir em cada linha
  - Filtros por módulo e tipo

- **Aba "Configurações Gerais"**: Configurações globais de relatórios
  - Logo (URL ou upload)
  - Dados da empresa (nome, endereço, telefone, email, CNPJ)
  - Formato padrão (PDF/HTML/Excel)
  - Email padrão para envio

### Acesso:
- Menu: **Configurações** → **Configuração de Relatórios**
- Ou diretamente: `http://localhost:5173/configuracoes/relatorios`

---

## 2. Geração de Relatórios de Estoque

**Rota:** `/estoque/relatorio`  
**Arquivo:** `frontend/src/pages/estoque/Relatorio.tsx`

### Funcionalidades:
- Seleção de tipo de relatório:
  - Estoque por Location
  - Estoque Consolidado

- Seleção de template customizado (opcional)
  - Lista apenas templates do módulo "estoque"
  - Opção de usar template padrão

- Filtros:
  - **Estoque por Location:**
    - Location (dropdown com todas as locations)
    - Código do Produto (texto livre)
  - **Estoque Consolidado:**
    - Código do Produto (texto livre)

- Formato de saída:
  - PDF (download)
  - HTML (preview)

- Preview HTML:
  - Modal com iframe mostrando preview do relatório
  - Botão para gerar PDF após preview

- Envio por email (opcional):
  - Checkbox para habilitar
  - Campo de email destinatário

### Acesso:
- Menu: **Estoque** → **Estoque Atual** → Botão "📊 Relatórios"
- Ou diretamente: `http://localhost:5173/estoque/relatorio`

---

## 3. Formulário de Templates

**Arquivo:** `frontend/src/pages/configuracoes/TemplatesForm.tsx`  
**Acesso:** Modal aberto a partir de "Novo Template" ou "Editar" na tela de Configurações

### Funcionalidades:
- Campos básicos:
  - Nome do template
  - Código (slug único)
  - Módulo (dropdown)
  - Tipo de Relatório (dropdown baseado no módulo)
  - Descrição

- Template customizado:
  - Checkbox "Template Customizado"
  - Editor HTML (textarea com syntax highlighting básico)
  - Editor CSS (textarea com syntax highlighting básico)
  - Botão "Mostrar Preview" para visualizar em tempo real

- Configurações:
  - Orientação (Retrato/Paisagem)
  - Incluir Logo (checkbox)
  - Incluir Dados da Empresa (checkbox)

- Preview em tempo real:
  - Modal com componente `ReportPreview`
  - Atualiza automaticamente quando HTML/CSS muda
  - Usa dados de exemplo para preview

---

## 4. Configurações Gerais de Relatórios

**Arquivo:** `frontend/src/pages/configuracoes/ConfiguracoesRelatorios.tsx`  
**Acesso:** Aba "Configurações Gerais" na tela `/configuracoes/relatorios`

### Funcionalidades:
- **Logo:**
  - URL do logo (texto)
  - Upload de logo (arquivo)

- **Dados da Empresa:**
  - Nome da Empresa
  - Endereço (textarea)
  - Telefone
  - Email
  - CNPJ

- **Configurações Padrão:**
  - Formato Padrão (PDF/HTML/Excel)
  - Email Destinatário Padrão
  - Assunto Padrão

- **Salvar:**
  - Botão "Salvar Configurações"
  - Validação de campos obrigatórios

---

## Componentes Auxiliares

### ReportPreview
**Arquivo:** `frontend/src/components/reports/ReportPreview.tsx`

Componente reutilizável para exibir preview de relatórios:
- Recebe `tipo`, `modulo`, `templateId`, `templateHtml`, `templateCss`
- Renderiza HTML em iframe
- Atualiza em tempo real quando HTML/CSS muda
- Pode buscar preview da API ou renderizar localmente

---

## Fluxo de Uso

### 1. Criar um Template Customizado
```
1. Acesse /configuracoes/relatorios
2. Clique em "Novo Template"
3. Preencha os dados (nome, código, módulo, tipo)
4. Marque "Template Customizado"
5. Cole HTML e CSS customizados
6. Clique em "Mostrar Preview" para ver como ficará
7. Salve o template
```

### 2. Gerar um Relatório
```
1. Acesse /estoque/relatorio
2. Selecione o tipo de relatório
3. (Opcional) Selecione um template customizado
4. Configure os filtros desejados
5. Clique em "Preview HTML" para ver antes de gerar
6. Clique em "Gerar e Baixar" para baixar o PDF
```

### 3. Configurar Dados da Empresa
```
1. Acesse /configuracoes/relatorios
2. Vá para a aba "Configurações Gerais"
3. Preencha os dados da empresa
4. Configure logo (URL ou upload)
5. Salve as configurações
```

---

## Rotas no App.tsx

```typescript
// Configurações de Relatórios
path="/configuracoes/relatorios"
→ <Relatorios />

// Geração de Relatórios de Estoque
path="/estoque/relatorio"
→ <RelatorioEstoque />
```

---

## Notas Importantes

1. **Escopo de Templates**: Templates são filtrados automaticamente por tenant/empresa do usuário logado
2. **Módulo Específico**: A tela `/estoque/relatorio` mostra apenas templates do módulo "estoque"
3. **Preview em Tempo Real**: O preview atualiza automaticamente quando você edita HTML/CSS no formulário de templates
4. **Validação**: Todos os campos obrigatórios são validados antes de salvar
5. **Multi-tenant**: Todas as telas respeitam o escopo do tenant/empresa atual

---

## Estrutura de Arquivos

```
frontend/src/
├── pages/
│   ├── configuracoes/
│   │   ├── Relatorios.tsx          # Tela principal de configurações
│   │   ├── TemplatesForm.tsx       # Formulário de templates (modal)
│   │   └── ConfiguracoesRelatorios.tsx  # Configurações gerais (aba)
│   ├── estoque/
│   │   └── Relatorio.tsx            # Geração de relatórios de estoque
│   └── relatorios/
│       └── RelatoriosList.tsx      # (DEPRECADO - não usado mais)
└── components/
    └── reports/
        └── ReportPreview.tsx       # Componente de preview
```

---

## Status das Telas

- ✅ **Configurações de Relatórios** - Funcional
- ✅ **Geração de Relatórios de Estoque** - Funcional
- ✅ **Formulário de Templates** - Funcional
- ✅ **Configurações Gerais** - Funcional
- ❌ **RelatoriosList.tsx** - Deprecado (não usado mais, pode ser removido)

