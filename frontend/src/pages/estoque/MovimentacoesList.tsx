import { useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { movimentacoesService, type MovimentacaoEstoque } from '../../services/estoque';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';

/**
 * Página de listagem de Movimentações de Estoque
 */
export function MovimentacoesList() {
  const navigate = useNavigate();
  
  const {
    data,
    loading,
    error,
    pagination,
    handleViewRecord,
    handleSearch,
    handlePageChange,
  } = useCrud<MovimentacaoEstoque>({
    service: movimentacoesService,
    basePath: '/estoque/movimentacoes',
    getRecordId: (record) => record.id,
  });

  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: ['movimentacao_origem', 'movimentacao_destino', 'movimentacao_relacionada', 'created_by', 'updated_at'],
      fieldOverrides: {
        produto_nome: {
          label: 'Produto',
          width: 200,
        },
        location_nome: {
          label: 'Location',
          width: 180,
        },
        tipo: {
          label: 'Tipo',
          width: 150,
          render: (value) => {
            const tipos: Record<string, string> = {
              'ENTRADA': 'Entrada',
              'SAIDA': 'Saída',
              'TRANSFERENCIA_ORIGEM': 'Transferência (Origem)',
              'TRANSFERENCIA_DESTINO': 'Transferência (Destino)',
              'AJUSTE': 'Ajuste',
            };
            return tipos[value] || value;
          },
        },
        quantidade: {
          label: 'Quantidade',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '0';
            return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          },
        },
        custo_unitario: {
          label: 'Custo Unitário',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        custo_total: {
          label: 'Custo Total',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        created_at: {
          label: 'Data',
          width: 150,
          render: (value) => {
            if (!value) return '-';
            return new Date(value).toLocaleString('pt-BR');
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Movimentações de Estoque</h1>
          <p className="mt-2 text-sm text-gray-500">
            Histórico de todas as movimentações de estoque (entradas, saídas, transferências, ajustes)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<MovimentacaoEstoque>
        data={data}
        columns={columns}
        onRowClick={handleViewRecord}
        onSearch={handleSearch}
        loading={loading}
        pagination={{
          ...pagination,
          onPageChange: handlePageChange,
        }}
        searchPlaceholder="Pesquisar por produto, location, tipo..."
        emptyMessage="Nenhuma movimentação registrada."
        gridId="movimentacoes"
        showActions={false}
      />
    </div>
  );
}

export default MovimentacoesList;

