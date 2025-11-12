import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';
import { formatCPFCNPJ, formatPhone } from '../../utils/formatters';

/**
 * Página de detalhamento de Pessoa
 * Demonstra o uso do DetailView com abas (Detalhamento + Related)
 */
export function PessoasDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    handleEditRecord,
    handleDeleteRecord,
  } = useCrud({
    service: pessoasService,
    basePath: '/cadastros/pessoas',
    getRecordId: (record) => record.codigo_cadastro,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    }
  }, [id, loadRecord]);

  if (!id || id === 'novo') {
    // Redirecionar para formulário de criação
    navigate('/cadastros/pessoas/novo');
    return null;
  }

  if (loading && !currentRecord) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Configuração dos campos para exibição
  const fields = [
    { key: 'codigo_cadastro', label: 'Código' },
    { key: 'tipo', label: 'Tipo', render: (value) => value === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica' },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ', render: (value) => formatCPFCNPJ(value) },
    { key: 'nome_completo', label: 'Nome Completo' },
    { key: 'razao_social', label: 'Razão Social' },
    { key: 'nome_fantasia', label: 'Nome Fantasia' },
    { key: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { key: 'contribuinte', label: 'Contribuinte ICMS', render: (value) => value ? 'Sim' : 'Não' },
    { key: 'cep', label: 'CEP' },
    { key: 'logradouro', label: 'Logradouro' },
    { key: 'numero', label: 'Número' },
    { key: 'letra', label: 'Letra' },
    { key: 'complemento', label: 'Complemento' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'Estado' },
    { key: 'nome_contato', label: 'Nome do Contato' },
    { key: 'telefone_fixo', label: 'Telefone Fixo', render: (value) => value ? formatPhone(value) : '-' },
    { key: 'telefone_celular', label: 'Celular', render: (value) => value ? formatPhone(value) : '-' },
    { key: 'email', label: 'Email' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'comissoes', label: 'Comissão (%)', render: (value) => value ? `${value}%` : '0%' },
    { key: 'observacoes', label: 'Observações', render: (value) => value || '-' },
  ];

  // Exemplo de registros relacionados (quando houver relacionamentos)
  // Por enquanto, vamos deixar vazio, mas a estrutura está pronta
  const relatedRecords = [
    // Exemplo futuro: quando houver relacionamentos
    // {
    //   title: 'Pedidos',
    //   records: [],
    //   columns: [
    //     { key: 'numero', label: 'Número' },
    //     { key: 'data', label: 'Data' },
    //     { key: 'valor', label: 'Valor' },
    //   ],
    //   onRecordClick: (record) => navigate(`/pedidos/${record.id}`),
    //   emptyMessage: 'Nenhum pedido encontrado para esta pessoa',
    // },
  ];

  // Exemplo de registros relacionados para demonstração
  // Quando houver relacionamentos reais, substituir por dados da API
  const exampleRelatedRecords = [
    {
      title: 'Pedidos',
      records: [],
      columns: [
        { key: 'numero', label: 'Número' },
        { key: 'data', label: 'Data' },
        { key: 'valor', label: 'Valor' },
      ],
      onRecordClick: (record) => navigate(`/pedidos/${record.id}`),
      emptyMessage: 'Nenhum pedido encontrado para esta pessoa',
    },
    {
      title: 'Contratos',
      records: [],
      columns: [
        { key: 'numero', label: 'Número do Contrato' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'status', label: 'Status' },
      ],
      onRecordClick: (record) => navigate(`/contratos/${record.id}`),
      emptyMessage: 'Nenhum contrato encontrado para esta pessoa',
    },
  ];

  const title = currentRecord?.nome_completo || currentRecord?.razao_social || `Pessoa #${id}`;
  const subtitle = currentRecord?.cpf_cnpj ? `CPF/CNPJ: ${formatCPFCNPJ(currentRecord.cpf_cnpj)}` : '';

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DetailView
        data={currentRecord}
        fields={fields}
        relatedRecords={exampleRelatedRecords}
        onEdit={() => handleEditRecord(currentRecord)}
        onDelete={() => handleDeleteRecord(currentRecord)}
        onBack={() => navigate('/cadastros/pessoas')}
        title={title}
        subtitle={subtitle}
        loading={loading}
      />
    </div>
  );
}

export default PessoasDetail;

