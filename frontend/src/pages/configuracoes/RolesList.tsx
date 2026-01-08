import { useCrud } from '../../hooks/useCrud';
import { DataGrid, ErrorMessage, LoadingSpinner } from '../../components/common';
import { rolesService, type CustomRole } from '../../services/accounts/roles';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';

/**
 * Página de listagem de Roles do Tenant
 * Apenas admins do tenant podem acessar
 */
export function RolesList() {
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
  } = useCrud<CustomRole>({
    service: rolesService,
    basePath: '/configuracoes/roles',
    getRecordId: (record) => record.id,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      // Campos que não devem aparecer no grid
      hiddenFields: [
        'tenant', 'module_permissions', 'created_at', 'updated_at',
      ],
      // Overrides para campos específicos
      fieldOverrides: {
        id: {
          label: 'ID',
          required: true,
          width: 80,
        },
        name: {
          label: 'Nome',
          width: 200,
        },
        code: {
          label: 'Código',
          width: 150,
        },
        description: {
          label: 'Descrição',
          width: 300,
        },
        permissions_count: {
          label: 'Permissões',
          width: 120,
          render: (value) => {
            return (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                {value || 0} módulo(s)
              </span>
            );
          },
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
        is_system: {
          label: 'Sistema',
          width: 100,
          render: (value) => {
            return value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                Sistema
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                Customizado
              </span>
            );
          },
        },
      },
      // Larguras padrão customizadas
      defaultWidths: {
        id: 80,
        name: 200,
        code: 150,
        description: 300,
        permissions_count: 120,
        is_active: 80,
        is_system: 100,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Roles</h1>
          <p className="mt-2 text-sm text-gray-500">
            Crie e gerencie roles customizados com permissões por módulo
          </p>
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} onClose={() => {}} dismissible={false} />
      )}

      {loading && !data && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Carregando roles..." />
        </div>
      )}

      <DataGrid<CustomRole>
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
        searchPlaceholder="Pesquisar por nome, código, descrição..."
        emptyMessage="Nenhum role cadastrado. Clique em 'Novo' para criar um role customizado."
        gridId="roles"
        showActions={true}
      />
    </div>
  );
}

export default RolesList;

