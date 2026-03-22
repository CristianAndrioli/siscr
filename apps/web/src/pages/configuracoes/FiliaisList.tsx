import { useCrud } from '../../hooks/useCrud';
import { DataGrid, ErrorMessage, LoadingSpinner } from '../../components/common';
import { filiaisService, type Filial } from '../../services/tenants/filiais';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';

/**
 * Página de listagem de Filiais do Tenant
 */
export function FiliaisList() {
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
  } = useCrud<Filial>({
    service: filiaisService,
    basePath: '/configuracoes/filiais',
    getRecordId: (record) => record.id,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: ['created_at', 'updated_at'],
      fieldOverrides: {
        id: {
          label: 'ID',
          required: true,
          width: 80,
        },
        empresa_nome: {
          label: 'Empresa',
          width: 200,
        },
        nome: {
          label: 'Nome da Filial',
          width: 200,
        },
        codigo_filial: {
          label: 'Código',
          width: 120,
        },
        cidade: {
          label: 'Cidade',
          width: 150,
        },
        estado: {
          label: 'Estado',
          width: 80,
        },
        is_active: {
          label: 'Ativo',
          width: 80,
          render: (value) => {
            return value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Sim
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                Não
              </span>
            );
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Filiais</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie as filiais das empresas do seu tenant
          </p>
        </div>
        <div>
          <button
            onClick={handleCreateRecord}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Filial
          </button>
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} onClose={() => {}} dismissible={false} />
      )}

      {loading && !data && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Carregando filiais..." />
        </div>
      )}

      <DataGrid<Filial>
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
        searchPlaceholder="Pesquisar por nome, código, cidade..."
        emptyMessage="Nenhuma filial cadastrada. Clique em 'Novo' para adicionar."
        gridId="filiais"
        showActions={true}
      />
    </div>
  );
}

export default FiliaisList;

