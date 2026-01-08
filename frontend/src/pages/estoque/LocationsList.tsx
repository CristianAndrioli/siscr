import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { locationsService, type Location } from '../../services/estoque';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';

/**
 * Página de listagem de Locations
 */
export function LocationsList() {
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
  } = useCrud<Location>({
    service: locationsService,
    basePath: '/estoque/locations',
    getRecordId: (record) => record.id,
  });

  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: ['letra', 'complemento', 'created_at', 'updated_at'],
      fieldOverrides: {
        codigo: {
          label: 'Código',
          required: true,
          width: 120,
        },
        nome: {
          label: 'Nome',
          width: 250,
        },
        tipo: {
          label: 'Tipo',
          width: 150,
          render: (value) => {
            const tipos: Record<string, string> = {
              'LOJA': 'Loja',
              'ALMOXARIFADO': 'Almoxarifado',
              'ARMAZEM': 'Armazém',
              'CENTRO_DISTRIBUICAO': 'Centro de Distribuição',
              'ESTOQUE_TERCEIRO': 'Estoque em Terceiros',
              'OUTRO': 'Outro',
            };
            return tipos[value] || value;
          },
        },
        endereco_completo: {
          label: 'Endereço',
          width: 300,
        },
        empresa_nome: {
          label: 'Empresa',
          width: 200,
        },
        filial_nome: {
          label: 'Filial',
          width: 150,
          render: (value) => value || '-',
        },
        ativo: {
          label: 'Ativo',
          width: 80,
          render: (value) => (value ? 'Sim' : 'Não'),
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie os locais físicos de armazenamento (lojas, almoxarifados, armazéns, etc.)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<Location>
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
        searchPlaceholder="Pesquisar por nome, código, endereço..."
        emptyMessage="Nenhuma location cadastrada. Clique em 'Novo' para adicionar."
        gridId="locations"
        showActions={true}
      />
    </div>
  );
}

export default LocationsList;

