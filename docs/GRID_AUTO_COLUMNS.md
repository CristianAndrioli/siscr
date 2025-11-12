# 🎯 Geração Automática de Colunas no Grid

## 📋 Visão Geral

O sistema agora suporta **geração automática de colunas** para grids, eliminando a necessidade de definir manualmente todas as colunas. A chave primária (código) é automaticamente identificada e marcada como obrigatória.

## 🚀 Como Funciona

### 1. **Modo Automático Completo** (Zero Configuração)

Para criar um grid totalmente automático, basta passar os dados:

```javascript
import { useGridColumns } from '../../hooks/useGridColumns';
import { useCrud } from '../../hooks/useCrud';

function MeuGrid() {
  const { data, ... } = useCrud({ service: meuService, ... });
  
  // Geração 100% automática - detecta todos os campos
  const columns = useGridColumns(data);
  
  return <DataGrid data={data} columns={columns} ... />;
}
```

### 2. **Modo Automático com Configuração** (Recomendado)

Personalize apenas o que precisa:

```javascript
const columns = useGridColumns(data, {
  autoConfig: {
    // Ocultar campos que não devem aparecer
    hiddenFields: ['campo_interno', 'metadata', 'senha'],
    
    // Personalizar campos específicos
    fieldOverrides: {
      nome: {
        label: 'Nome Completo',
        defaultWidth: 250,
        render: (value) => value?.toUpperCase(),
      },
      valor: {
        render: (value) => formatCurrency(value),
      },
    },
    
    // Campos adicionais obrigatórios (além da chave primária)
    requiredFields: ['status', 'ativo'],
    
    // Larguras padrão customizadas
    defaultWidths: {
      codigo: 100,
      nome: 250,
      email: 200,
    },
  },
});
```

### 3. **Modo Manual** (Override Completo)

Se precisar de controle total, defina colunas manualmente:

```javascript
const columns = useGridColumns(data, {
  manualColumns: [
    {
      key: 'codigo',
      label: 'Código',
      required: true,
      defaultWidth: 100,
    },
    // ... outras colunas
  ],
});
```

## 🔍 Detecção Automática

O sistema detecta automaticamente:

### **Chave Primária (Obrigatória)**
- Campos que começam com `codigo_` (ex: `codigo_cadastro`, `codigo_produto`)
- Campos `id` ou `pk`
- Campos que terminam com `_id`

### **Tipos de Dados**
- **Boolean**: Renderiza como "Sim"/"Não"
- **Number/Decimal**: Formata como moeda se contém "valor"
- **Date**: Formata como data brasileira
- **String**: Exibe como está (com formatação customizada se configurado)

### **Larguras Padrão**
- Código/ID: 100px
- Boolean: 80px
- Número: 120px
- Data/Hora: 120px
- Nome/Razão: 250px
- Email: 200px
- Cidade: 150px
- Estado/UF: 80px
- Outros: 150px

## 📝 Exemplos Práticos

### Exemplo 1: Grid Simples (Produtos)

```javascript
function ProdutosList() {
  const { data, ... } = useCrud({
    service: produtosService,
    basePath: '/cadastros/produtos',
    getRecordId: (r) => r.codigo_produto,
  });

  // Automático - apenas oculta campos desnecessários
  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: [
        'descricao', 'peso_liquido', 'peso_bruto',
        'codigo_ncm', 'cfop_interno', 'origem_mercadoria',
        'cst_icms', 'aliquota_icms', 'aliquota_ipi',
        'codigo_di', 'incoterm', 'moeda_negociacao', 'aliquota_ii'
      ],
      fieldOverrides: {
        valor_venda: {
          render: (value) => formatCurrency(value),
        },
        ativo: {
          label: 'Status',
          render: (value) => value ? 'Ativo' : 'Inativo',
        },
      },
    },
  });

  return <DataGrid data={data} columns={columns} gridId="produtos" ... />;
}
```

### Exemplo 2: Grid Totalmente Automático

```javascript
function ServicosList() {
  const { data, ... } = useCrud({
    service: servicosService,
    basePath: '/cadastros/servicos',
    getRecordId: (r) => r.codigo_servico,
  });

  // 100% automático - mostra todos os campos
  const columns = useGridColumns(data);

  return <DataGrid data={data} columns={columns} gridId="servicos" ... />;
}
```

## ✅ Vantagens

1. **Menos Código**: Não precisa definir todas as colunas manualmente
2. **Manutenção Fácil**: Adiciona campo no modelo → aparece automaticamente no grid
3. **Consistência**: Chave primária sempre obrigatória automaticamente
4. **Flexibilidade**: Pode personalizar apenas o que precisa
5. **Type-Safe**: Detecta tipos e aplica formatação apropriada

## 🎨 Personalização Avançada

### Render Customizado

```javascript
fieldOverrides: {
  status: {
    render: (value) => (
      <span className={value === 'ativo' ? 'text-green-600' : 'text-red-600'}>
        {value}
      </span>
    ),
  },
}
```

### Múltiplos Campos Obrigatórios

```javascript
autoConfig: {
  requiredFields: ['codigo', 'nome', 'status'], // Além da chave primária
}
```

## 🔄 Migração de Grids Existentes

Para migrar um grid manual para automático:

1. **Substitua** a definição manual de colunas por `useGridColumns`
2. **Mova** configurações específicas para `fieldOverrides`
3. **Adicione** campos a ocultar em `hiddenFields`
4. **Teste** e ajuste conforme necessário

**Antes:**
```javascript
const columns = [
  { key: 'codigo', label: 'Código', required: true, ... },
  { key: 'nome', label: 'Nome', ... },
  // ... 20+ colunas definidas manualmente
];
```

**Depois:**
```javascript
const columns = useGridColumns(data, {
  autoConfig: {
    hiddenFields: ['campo1', 'campo2'],
    fieldOverrides: {
      nome: { label: 'Nome Completo' },
    },
  },
});
```

## 📚 API Reference

### `useGridColumns(data, config)`

**Parâmetros:**
- `data` (Array): Dados do grid (usado para detectar campos)
- `config` (Object): Configuração opcional
  - `manualColumns` (Array): Override completo de colunas
  - `autoConfig` (Object): Configuração para geração automática
    - `hiddenFields` (Array): Campos a ocultar
    - `fieldOverrides` (Object): Personalização por campo
    - `requiredFields` (Array): Campos obrigatórios adicionais
    - `defaultWidths` (Object): Larguras padrão

**Retorna:** Array de colunas configuradas

