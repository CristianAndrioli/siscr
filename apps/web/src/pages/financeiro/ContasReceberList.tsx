import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { contasReceberService } from '../../services/cadastros/contasReceber';
import { useGridColumns } from '../../hooks/useGridColumns';
import type { ContaReceber } from '../../types';

/**
 * Página de listagem de Contas a Receber
 */
export function ContasReceberList() {
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
  } = useCrud<ContaReceber>({
    service: contasReceberService,
    basePath: '/financeiro/contas-receber',
    getRecordId: (record) => record.codigo_conta,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: [
        'descricao', 'observacoes', 'created_at', 'updated_at',
        'data_recebimento', 'cliente'
      ],
      fieldOverrides: {
        codigo_conta: {
          label: 'Código',
          required: true,
          width: 100,
        },
        numero_documento: {
          label: 'Documento',
          width: 150,
        },
        cliente_nome: {
          label: 'Cliente',
          width: 250,
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
        valor_recebido: {
          label: 'Recebido',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        valor_pendente: {
          label: 'Pendente',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        data_emissao: {
          label: 'Emissão',
          width: 120,
          render: (value) => {
            if (!value) return '-';
            return new Date(value).toLocaleDateString('pt-BR');
          },
        },
        data_vencimento: {
          label: 'Vencimento',
          width: 120,
          render: (value) => {
            if (!value) return '-';
            return new Date(value).toLocaleDateString('pt-BR');
          },
        },
        status: {
          label: 'Status',
          width: 120,
          render: (value) => {
            const statusColors: Record<string, string> = {
              'Pendente': 'bg-yellow-100 text-yellow-800',
              'Parcial': 'bg-blue-100 text-blue-800',
              'Pago': 'bg-green-100 text-green-800',
              'Cancelado': 'bg-gray-100 text-gray-800',
              'Vencido': 'bg-red-100 text-red-800',
            };
            const color = statusColors[String(value)] || 'bg-gray-100 text-gray-800';
            return (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                {String(value)}
              </span>
            );
          },
        },
        forma_pagamento: {
          label: 'Forma Pagamento',
          width: 150,
        },
      },
      defaultWidths: {
        codigo_conta: 100,
        numero_documento: 150,
        cliente_nome: 250,
        valor_total: 130,
        valor_recebido: 130,
        valor_pendente: 130,
        data_emissao: 120,
        data_vencimento: 120,
        status: 120,
        forma_pagamento: 150,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contas a Receber</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie as contas a receber da empresa
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<ContaReceber>
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
        searchPlaceholder="Pesquisar por documento, cliente, descrição..."
        emptyMessage="Nenhuma conta a receber cadastrada. Clique em 'Novo' para adicionar."
        gridId="contas-receber"
        showActions={true}
      />
    </div>
  );
}

export default ContasReceberList;

