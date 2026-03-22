import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { servicosService } from '../../services/cadastros/servicos';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';
import type { Servico } from '../../types';

/**
 * Página de listagem de Serviços usando a estrutura base
 * Demonstra o uso do DataGrid e useCrud com geração automática de colunas
 */
export function ServicosList() {
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
  } = useCrud<Servico>({
    service: servicosService,
    basePath: '/cadastros/servicos',
    getRecordId: (record) => record.codigo_servico,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      // Campos que não devem aparecer no grid
      hiddenFields: [
        'descricao', 'prazo_execucao', 'valor_impostos_estimado',
        'codigo_ncm', 'cfop', 'tributacao_pis', 'tributacao_cofins'
      ],
      // Overrides para campos específicos
      fieldOverrides: {
        codigo_servico: {
          label: 'Código',
          required: true,
          width: 100,
        },
        nome: {
          label: 'Nome',
          width: 250,
        },
        valor_base: {
          label: 'Valor Base',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        tipo_contrato: {
          label: 'Tipo de Contrato',
          width: 150,
        },
        ativo: {
          label: 'Ativo',
          width: 80,
          render: (value) => (value ? 'Sim' : 'Não'),
        },
      },
      // Larguras padrão customizadas
      defaultWidths: {
        codigo_servico: 100,
        nome: 250,
        valor_base: 120,
        tipo_contrato: 150,
        ativo: 80,
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Serviços</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie serviços e prestações
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<Servico>
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
        emptyMessage="Nenhum serviço cadastrado. Clique em 'Novo' para adicionar."
        gridId="servicos"
        showActions={true}
      />
    </div>
  );
}

export default ServicosList;

