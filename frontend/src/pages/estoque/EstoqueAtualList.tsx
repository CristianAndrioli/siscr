import { useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { estoqueService, type Estoque } from '../../services/estoque';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';
import AdicionarEstoqueModal from '../../components/estoque/AdicionarEstoqueModal';
import Button from '../../components/common/Button';
import { FileText } from 'lucide-react';

/**
 * Página de listagem de Estoque Atual
 */
export function EstoqueAtualList() {
  const navigate = useNavigate();
  const [modalAberto, setModalAberto] = useState(false);
  
  // Verificar se está em modo desenvolvimento
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  
  const {
    data,
    loading,
    error,
    pagination,
    handleViewRecord,
    handleSearch,
    handlePageChange,
    loadData,
  } = useCrud<Estoque>({
    service: estoqueService,
    basePath: '/estoque/estoque-atual',
    getRecordId: (record) => record.id,
  });

  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: ['created_at', 'updated_at', 'empresa', 'location', 'produto'],
      fieldOverrides: {
        produto_nome: {
          label: 'Produto',
          width: 250,
        },
        produto_codigo: {
          label: 'Código',
          width: 120,
        },
        location_nome: {
          label: 'Location',
          width: 200,
        },
        quantidade_atual: {
          label: 'Qtd. Atual',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '0';
            return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          },
        },
        quantidade_disponivel: {
          label: 'Qtd. Disponível',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '0';
            return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          },
        },
        quantidade_reservada: {
          label: 'Qtd. Reservada',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '0';
            return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          },
        },
        custo_medio: {
          label: 'Custo Médio',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        valor_total: {
          label: 'Valor Total',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        abaixo_estoque_minimo: {
          label: 'Abaixo Mínimo',
          width: 120,
          render: (value) => (
            <span className={value ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              {value ? 'Sim' : 'Não'}
            </span>
          ),
        },
      },
    },
  });

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estoque Atual</h1>
          <p className="mt-2 text-sm text-gray-500">
            Visualize o estoque atual de produtos por location
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/estoque/relatorio')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Relatórios
          </Button>
          {isDevelopment && (
            <Button onClick={() => setModalAberto(true)}>
              + Adicionar Estoque
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<Estoque>
        data={data}
        columns={columns}
        onRowClick={handleViewRecord}
        onSearch={handleSearch}
        loading={loading}
        pagination={{
          ...pagination,
          onPageChange: handlePageChange,
        }}
        searchPlaceholder="Pesquisar por produto, location..."
        emptyMessage="Nenhum estoque cadastrado."
        gridId="estoque-atual"
        showActions={false}
      />

      <AdicionarEstoqueModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={() => {
          loadData(pagination.page, '');
        }}
      />
    </div>
  );
}

export default EstoqueAtualList;

