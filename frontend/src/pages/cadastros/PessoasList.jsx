import { useCrud } from '../../hooks/useCrud';
import { DataGrid } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';
import { useNavigate } from 'react-router-dom';

/**
 * Página de listagem de Pessoas usando a estrutura base
 * Demonstra o uso do DataGrid e useCrud
 */
export function PessoasList() {
  const navigate = useNavigate();
  
  const {
    data,
    loading,
    error,
    pagination,
    handleViewRecord,
    handleCreateRecord,
    handleSearch,
    handlePageChange,
  } = useCrud({
    service: pessoasService,
    basePath: '/cadastros/pessoas',
    getRecordId: (record) => record.codigo_cadastro,
  });

  // Configuração das colunas do grid
  const columns = [
    {
      key: 'codigo_cadastro',
      label: 'Código',
      sortable: true,
    },
    {
      key: 'nome_completo',
      label: 'Nome',
      sortable: true,
      render: (value, record) => {
        return value || record.razao_social || record.nome_fantasia || '-';
      },
    },
    {
      key: 'cpf_cnpj',
      label: 'CPF/CNPJ',
      sortable: true,
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (value) => {
        const tipos = {
          'PF': 'Pessoa Física',
          'PJ': 'Pessoa Jurídica',
        };
        return tipos[value] || value;
      },
    },
    {
      key: 'cidade',
      label: 'Cidade',
      sortable: true,
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Pessoas</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gerencie clientes, fornecedores e funcionários
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid
        data={data}
        columns={columns}
        onRowClick={handleViewRecord}
        onSearch={handleSearch}
        onCreate={handleCreateRecord}
        loading={loading}
        pagination={{
          ...pagination,
          onPageChange: handlePageChange,
        }}
        searchPlaceholder="Pesquisar por nome, CPF/CNPJ, cidade..."
        emptyMessage="Nenhuma pessoa cadastrada. Clique em 'Novo' para adicionar."
      />
    </div>
  );
}

export default PessoasList;

