# 🏗️ Arquitetura Frontend - Estrutura Base Reutilizável

## 📋 Visão Geral

A arquitetura do frontend foi projetada para ser **reutilizável** e **escalável**, inspirada no padrão do Salesforce. Cada entidade (tabela) pode ter rapidamente uma interface completa de CRUD com:

- **Grid de listagem** com pesquisa e paginação
- **Página de detalhamento** com abas (Detalhamento + Relacionados)
- **Formulário** de criação/edição

## 🎯 Componentes Base

### 1. **DataGrid** (`components/common/DataGrid.jsx`)

Componente reutilizável para exibir dados em tabela.

**Características:**
- ✅ Pesquisa integrada com debounce
- ✅ Ordenação por colunas
- ✅ Paginação
- ✅ Loading state
- ✅ Empty state
- ✅ Clique em linha para ver detalhes

**Uso:**
```jsx
<DataGrid
  data={data}
  columns={columns}
  onRowClick={handleViewRecord}
  onSearch={handleSearch}
  onCreate={handleCreateRecord}
  loading={loading}
  pagination={pagination}
/>
```

### 2. **DetailView** (`components/common/DetailView.jsx`)

Componente para exibir detalhes de um registro com abas estilo Salesforce.

**Características:**
- ✅ Aba "Detalhamento" (campos do registro)
- ✅ Aba "Relacionados" (registros com chave estrangeira)
- ✅ Botões de ação (Editar, Excluir, Voltar)
- ✅ Layout responsivo

**Uso:**
```jsx
<DetailView
  data={currentRecord}
  fields={fields}
  relatedRecords={relatedRecords}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onBack={handleBack}
  title="Nome do Registro"
  subtitle="Informações adicionais"
/>
```

### 3. **RelatedRecords** (`components/common/RelatedRecords.jsx`)

Componente para exibir registros relacionados na aba "Related".

**Características:**
- ✅ Tabela de registros relacionados
- ✅ Clique para navegar ao registro relacionado
- ✅ Empty state quando não há registros

**Uso:**
```jsx
<RelatedRecords
  title="Pedidos"
  records={pedidos}
  columns={pedidosColumns}
  onRecordClick={(record) => navigate(`/pedidos/${record.id}`)}
/>
```

## 🪝 Hook useCrud

Hook customizado que gerencia todo o estado e operações CRUD.

**Características:**
- ✅ Estado centralizado (data, loading, error, pagination)
- ✅ Operações CRUD (create, read, update, delete)
- ✅ Pesquisa integrada
- ✅ Paginação automática
- ✅ Navegação automática

**Uso:**
```jsx
const {
  data,
  loading,
  currentRecord,
  handleViewRecord,
  handleCreateRecord,
  handleEditRecord,
  handleDeleteRecord,
  handleSearch,
} = useCrud({
  service: pessoasService,
  basePath: '/cadastros/pessoas',
  getRecordId: (record) => record.codigo_cadastro,
});
```

## 📁 Estrutura de Páginas

### Padrão de Nomenclatura

Para cada entidade (ex: Pessoas, Produtos, Serviços), criar 3 arquivos:

```
pages/cadastros/
├── PessoasList.jsx      # Lista com DataGrid
├── PessoasDetail.jsx    # Detalhamento com DetailView
└── PessoasForm.jsx      # Formulário de criação/edição
```

### Exemplo Completo: Pessoas

#### 1. **PessoasList.jsx** - Listagem

```jsx
import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';

export function PessoasList() {
  const {
    data,
    loading,
    handleViewRecord,
    handleCreateRecord,
    handleSearch,
  } = useCrud({
    service: pessoasService,
    basePath: '/cadastros/pessoas',
  });

  const columns = [
    { key: 'codigo_cadastro', label: 'Código' },
    { key: 'nome_completo', label: 'Nome' },
    // ...
  ];

  return (
    <DataGrid
      data={data}
      columns={columns}
      onRowClick={handleViewRecord}
      onCreate={handleCreateRecord}
      loading={loading}
    />
  );
}
```

#### 2. **PessoasDetail.jsx** - Detalhamento

```jsx
import { DetailView } from '../../components/common';
import { useCrud } from '../../hooks/useCrud';

export function PessoasDetail() {
  const { id } = useParams();
  const { currentRecord, loadRecord, handleEditRecord } = useCrud({...});

  const fields = [
    { key: 'codigo_cadastro', label: 'Código' },
    { key: 'nome_completo', label: 'Nome' },
    // ...
  ];

  const relatedRecords = [
    {
      title: 'Pedidos',
      records: pedidos,
      columns: pedidosColumns,
      onRecordClick: (record) => navigate(`/pedidos/${record.id}`),
    },
  ];

  return (
    <DetailView
      data={currentRecord}
      fields={fields}
      relatedRecords={relatedRecords}
      onEdit={handleEditRecord}
    />
  );
}
```

## 🔗 Registros Relacionados (Aba Related)

A aba "Related" mostra registros que possuem chave estrangeira apontando para o registro atual.

### Exemplo: Mostrar Pedidos de uma Pessoa

```jsx
const relatedRecords = [
  {
    title: 'Pedidos',
    records: pedidos.filter(p => p.cliente_id === currentRecord.id),
    columns: [
      { key: 'numero', label: 'Número' },
      { key: 'data', label: 'Data' },
      { key: 'valor', label: 'Valor' },
    ],
    onRecordClick: (record) => navigate(`/pedidos/${record.id}`),
    emptyMessage: 'Nenhum pedido encontrado para esta pessoa',
  },
];
```

## 📊 Estrutura de Serviços

Os serviços devem seguir o padrão esperado pelo `useCrud`:

```js
export const pessoasService = {
  list: async (params) => { /* ... */ },
  get: async (id) => { /* ... */ },
  create: async (data) => { /* ... */ },
  update: async (id, data) => { /* ... */ },
  delete: async (id) => { /* ... */ },
};
```

## 🚀 Como Criar uma Nova Entidade

### Passo 1: Criar o Serviço

```js
// services/cadastros/produtos.js
export const produtosService = {
  list: async (params) => {
    const response = await api.get('/cadastros/produtos/', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/cadastros/produtos/${id}/`);
    return response.data;
  },
  // ... create, update, delete
};
```

### Passo 2: Criar as Páginas

1. **ProdutosList.jsx** - Usar `DataGrid` + `useCrud`
2. **ProdutosDetail.jsx** - Usar `DetailView` + `useCrud`
3. **ProdutosForm.jsx** - Formulário de criação/edição

### Passo 3: Adicionar Rotas

```jsx
<Route path="/cadastros/produtos" element={<ProdutosList />} />
<Route path="/cadastros/produtos/:id" element={<ProdutosDetail />} />
<Route path="/cadastros/produtos/novo" element={<ProdutosForm />} />
```

## 🎨 Customização

### Colunas do Grid

```jsx
const columns = [
  {
    key: 'nome',
    label: 'Nome',
    sortable: true,
    render: (value, record) => {
      return <strong>{value}</strong>;
    },
  },
];
```

### Campos do Detalhamento

```jsx
const fields = [
  {
    key: 'valor',
    label: 'Valor',
    render: (value) => {
      return formatCurrency(value);
    },
  },
];
```

## 📝 Notas Importantes

1. **ID do Registro**: O `getRecordId` no `useCrud` deve retornar o identificador único do registro (pode ser `id`, `codigo_cadastro`, `codigo_produto`, etc.)

2. **Paginação**: O backend deve retornar no formato:
   ```json
   {
     "results": [...],
     "count": 100,
     "next": "...",
     "previous": "..."
   }
   ```

3. **Pesquisa**: O `handleSearch` envia o termo de pesquisa para o backend via parâmetro `search`.

4. **Relacionamentos**: Para mostrar registros relacionados, você precisa buscar esses dados separadamente e passar para `relatedRecords`.

## 🔄 Fluxo Completo

1. **Lista** → Usuário vê grid com todos os registros
2. **Clicar em linha** → Navega para página de detalhamento
3. **Detalhamento** → Mostra dados na aba "Detalhamento"
4. **Aba Related** → Mostra registros relacionados (se houver)
5. **Clicar em relacionado** → Navega para o registro relacionado
6. **Editar** → Navega para formulário de edição
7. **Novo** → Navega para formulário de criação

---

**Última atualização**: 2025-01-XX

