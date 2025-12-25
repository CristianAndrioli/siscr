import { useCrud } from '../../hooks/useCrud';
import { DataGrid, ErrorMessage, LoadingSpinner } from '../../components/common';
import { usuariosService, type Usuario } from '../../services/accounts/usuarios';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';

/**
 * Página de listagem de Usuários do Tenant
 * Apenas admins do tenant podem acessar
 */
export function UsuariosList() {
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
  } = useCrud<Usuario>({
    service: usuariosService,
    basePath: '/usuarios',
    getRecordId: (record) => record.id,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      // Campos que não devem aparecer no grid
      hiddenFields: [
        'profile', 'membership', 'date_joined', 'last_login',
      ],
      // Overrides para campos específicos
      fieldOverrides: {
        id: {
          label: 'ID',
          required: true,
          width: 80,
        },
        username: {
          label: 'Usuário',
          width: 150,
        },
        email: {
          label: 'E-mail',
          width: 250,
        },
        first_name: {
          label: 'Nome',
          width: 200,
        },
        last_name: {
          label: 'Sobrenome',
          width: 200,
        },
        role: {
          label: 'Papel',
          width: 120,
          render: (value) => {
            const roles: Record<string, string> = {
              'admin': 'Administrador',
              'manager': 'Gerente',
              'user': 'Usuário',
              'viewer': 'Visualizador',
            };
            return roles[String(value)] || String(value) || '-';
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
        is_active_membership: {
          label: 'Membro Ativo',
          width: 120,
          render: (value) => {
            return value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Ativo
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                Inativo
              </span>
            );
          },
        },
      },
      // Larguras padrão customizadas
      defaultWidths: {
        id: 80,
        username: 150,
        email: 250,
        first_name: 200,
        last_name: 200,
        role: 120,
        is_active: 80,
        is_active_membership: 120,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie os usuários que têm acesso ao sistema do seu tenant
          </p>
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} onClose={() => {}} dismissible={false} />
      )}

      {loading && !data && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Carregando usuários..." />
        </div>
      )}

      <DataGrid<Usuario>
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
        searchPlaceholder="Pesquisar por nome, usuário, e-mail..."
        emptyMessage="Nenhum usuário cadastrado. Clique em 'Novo' para adicionar."
        gridId="usuarios"
        showActions={true}
      />
    </div>
  );
}

export default UsuariosList;

