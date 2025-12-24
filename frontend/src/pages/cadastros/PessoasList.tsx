import { useCrud } from '../../hooks/useCrud';
import { DataGrid, ErrorMessage, LoadingSpinner } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';
import { formatCPFCNPJ } from '../../utils/formatters';
import type { Pessoa } from '../../types';

/**
 * Página de listagem de Pessoas usando a estrutura base
 * Demonstra o uso do DataGrid e useCrud com geração automática de colunas
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
    handleEditRecord,
    handleDeleteRecord,
    handleSearch,
    handlePageChange,
  } = useCrud<Pessoa>({
    service: pessoasService,
    basePath: '/cadastros/pessoas',
    getRecordId: (record) => record.codigo_cadastro,
  });

  // Gerar colunas automaticamente com overrides customizados
  const columns = useGridColumns(data, {
    autoConfig: {
      // Campos que não devem aparecer no grid
      hiddenFields: [
        'logradouro', 'numero', 'letra', 'complemento', 'bairro', 'cep',
        'nome_contato', 'telefone_fixo', 'telefone_celular', 'cargo',
        'comissoes', 'observacoes', 'inscricao_estadual', 'contribuinte'
      ],
      // Overrides para campos específicos
      fieldOverrides: {
        codigo_cadastro: {
          label: 'Código',
          required: true,
          width: 100,
        },
        nome_completo: {
          label: 'Nome',
          width: 250,
          render: (value, record) => {
            const pessoa = record as Pessoa;
            return value || pessoa.razao_social || pessoa.nome_fantasia || '-';
          },
        },
        cpf_cnpj: {
          label: 'CPF/CNPJ',
          width: 150,
          render: (value) => formatCPFCNPJ(String(value ?? '')),
        },
        tipo: {
          label: 'Tipo',
          width: 120,
          render: (value) => {
            const tipos: Record<string, string> = {
              'PF': 'Pessoa Física',
              'PJ': 'Pessoa Jurídica',
            };
            return tipos[String(value)] || String(value);
          },
        },
      },
      // Larguras padrão customizadas
      defaultWidths: {
        codigo_cadastro: 100,
        nome_completo: 250,
        cpf_cnpj: 150,
        tipo: 120,
        cidade: 150,
        estado: 80,
        email: 200,
      },
    },
  });

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
        <ErrorMessage message={error} onClose={() => {}} dismissible={false} />
      )}

      {loading && !data && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Carregando pessoas..." />
        </div>
      )}

      <DataGrid<Pessoa>
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
        searchPlaceholder="Pesquisar por nome, CPF/CNPJ, cidade..."
        emptyMessage="Nenhuma pessoa cadastrada. Clique em 'Novo' para adicionar."
        gridId="pessoas"
        showActions={true}
      />
    </div>
  );
}

export default PessoasList;

