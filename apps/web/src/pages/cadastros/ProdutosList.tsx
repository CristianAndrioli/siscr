import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { produtosService } from '../../services/cadastros/produtos';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';
import type { Produto } from '../../types';

/**
 * Página de listagem de Produtos usando a estrutura base
 * Demonstra o uso do DataGrid e useCrud com geração automática de colunas
 */
export function ProdutosList() {
  const navigate = useNavigate();
  
  const {
    data,
    loading,
    error,
    pagination,
    handleViewRecord,
    handleCreateRecord,
    handleEditRecord,
    handleDeleteRecord,
    handleSearch,
    handlePageChange,
  } = useCrud<Produto>({
    service: produtosService,
    basePath: '/cadastros/produtos',
    getRecordId: (record) => record.codigo_produto,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      // Campos que não devem aparecer no grid
      hiddenFields: [
        'descricao', 'peso_liquido', 'peso_bruto', 'codigo_di', 'incoterm',
        'moeda_negociacao', 'aliquota_ii', 'cst_icms', 'cfop_interno'
      ],
      // Overrides para campos específicos
      fieldOverrides: {
        codigo_produto: {
          label: 'Código',
          required: true,
          width: 100,
        },
        nome: {
          label: 'Nome',
          width: 250,
        },
        valor_custo: {
          label: 'Custo',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        valor_venda: {
          label: 'Venda',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        unidade_medida: {
          label: 'Unidade',
          width: 100,
        },
        ativo: {
          label: 'Ativo',
          width: 80,
          render: (value) => (value ? 'Sim' : 'Não'),
        },
      },
      // Larguras padrão customizadas
      defaultWidths: {
        codigo_produto: 100,
        nome: 250,
        valor_custo: 120,
        valor_venda: 120,
        unidade_medida: 100,
        ativo: 80,
        codigo_ncm: 120,
        origem_mercadoria: 120,
        aliquota_icms: 100,
        aliquota_ipi: 100,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Produtos</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie produtos e mercadorias
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<Produto>
        data={data}
        columns={columns}
        onRowClick={handleViewRecord}
        onSearch={handleSearch}
        onCreate={handleCreateRecord}
        onEdit={handleEditRecord}
        onDelete={handleDeleteRecord}
        loading={loading}
        pagination={{
          ...pagination,
          onPageChange: handlePageChange,
        }}
        searchPlaceholder="Pesquisar por nome, descrição, NCM..."
        emptyMessage="Nenhum produto cadastrado. Clique em 'Novo' para adicionar."
        gridId="produtos"
        showActions={true}
      />
    </div>
  );
}

export default ProdutosList;

