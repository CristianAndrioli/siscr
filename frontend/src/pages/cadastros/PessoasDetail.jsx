import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import { formatCPFCNPJ, formatPhone } from '../../utils/formatters';
import { ESTADOS } from '../../utils/constants';

/**
 * Página de detalhamento/edição/criação de Pessoa
 * Suporta visualização, edição e criação de registros
 */
export function PessoasDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState({});
  const [nextCode, setNextCode] = useState(null);
  const [formDataState, setFormDataState] = useState(null);
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud({
    service: pessoasService,
    basePath: '/cadastros/pessoas',
    getRecordId: (record) => record.codigo_cadastro,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      // Carregar próximo código quando for novo
      pessoasService.proximoCodigo().then(response => {
        setNextCode(response.proximo_codigo);
      }).catch(err => {
        console.error('Erro ao carregar próximo código:', err);
      });
    }
  }, [id, loadRecord]);

  // Criar objeto vazio com estrutura para gerar campos quando for novo
  const sampleData = useMemo(() => {
    if (id === 'novo') {
      return {
        codigo_cadastro: nextCode || '',
        tipo: 'PF',
        cpf_cnpj: '',
        nome_completo: '',
        razao_social: '',
        nome_fantasia: '',
        inscricao_estadual: '',
        contribuinte: true,
        logradouro: '',
        numero: '',
        letra: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: 'SC',
        cep: '',
        nome_contato: '',
        telefone_fixo: '',
        telefone_celular: '',
        email: '',
        cargo: '',
        comissoes: 0,
        observacoes: '',
      };
    }
    return currentRecord || {};
  }, [id, nextCode, currentRecord]);

  // Gerar campos do formulário automaticamente
  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: [], // Mostrar todos os campos
    readOnlyFields: ['codigo_cadastro'], // Código é somente leitura
    fieldConfigs: {
      codigo_cadastro: {
        label: 'Código',
        readOnly: true,
      },
      tipo: {
        type: 'select',
        options: [
          { value: 'PF', label: 'Pessoa Física' },
          { value: 'PJ', label: 'Pessoa Jurídica' },
        ],
      },
      estado: {
        type: 'select',
        options: ESTADOS,
      },
      contribuinte: {
        type: 'checkbox',
        label: 'Contribuinte ICMS',
      },
      observacoes: {
        type: 'textarea',
        rows: 4,
        section: 'Observações',
      },
      // Agrupar campos em seções
      logradouro: { section: 'Endereço' },
      numero: { section: 'Endereço' },
      letra: { section: 'Endereço' },
      complemento: { section: 'Endereço' },
      bairro: { section: 'Endereço' },
      cidade: { section: 'Endereço' },
      estado: { section: 'Endereço' },
      cep: { section: 'Endereço' },
      nome_contato: { section: 'Contato' },
      telefone_fixo: { section: 'Contato' },
      telefone_celular: { section: 'Contato' },
      email: { section: 'Contato' },
      cargo: { section: 'Contato' },
      comissoes: { section: 'Contato' },
    },
  });

  const saveRecord = async (formData, shouldCreateNew = false) => {
    try {
      setFormErrors({});
      // Manter dados do formulário em caso de erro
      setFormDataState(formData);
      
      // Garantir que codigo_cadastro esteja presente ao criar
      const dataToSend = { ...formData };
      if (id === 'novo') {
        // Sempre garantir que o código esteja presente e seja um número
        if (!dataToSend.codigo_cadastro || dataToSend.codigo_cadastro === '') {
          if (nextCode) {
            dataToSend.codigo_cadastro = parseInt(nextCode, 10);
          } else {
            // Se não tiver próximo código, buscar agora
            const codeResponse = await pessoasService.proximoCodigo();
            dataToSend.codigo_cadastro = parseInt(codeResponse.proximo_codigo, 10);
          }
        } else {
          // Garantir que seja número
          dataToSend.codigo_cadastro = parseInt(dataToSend.codigo_cadastro, 10);
        }
        // Criar novo registro
        await createRecord(dataToSend);
        
        if (shouldCreateNew) {
          // Limpar formulário e carregar próximo código
          setFormErrors({});
          const codeResponse = await pessoasService.proximoCodigo();
          setNextCode(codeResponse.proximo_codigo);
          // Limpar formDataState para resetar o formulário (será recriado pelo sampleData)
          setFormDataState(null);
          // Manter na mesma rota /novo - o formulário será recriado automaticamente
        } else {
          navigate('/cadastros/pessoas');
        }
      } else {
        // Atualizar registro existente
        await updateRecord(id, dataToSend);
        setIsEditing(false);
      }
    } catch (err) {
      // Tratar erros de validação
      if (err.response?.data) {
        const apiErrors = err.response.data;
        const errors = {};
        
        Object.keys(apiErrors).forEach(key => {
          if (Array.isArray(apiErrors[key])) {
            errors[key] = apiErrors[key][0];
          } else {
            errors[key] = apiErrors[key];
          }
        });
        
        setFormErrors(errors);
      } else {
        setFormErrors({ _general: err.response?.data?.detail || 'Erro ao salvar. Tente novamente.' });
      }
      // Não navegar - manter formulário com dados preenchidos
    }
  };

  const handleSubmit = async (formData) => {
    await saveRecord(formData, false);
  };

  const handleSaveAndNew = async (formData) => {
    await saveRecord(formData, true);
  };

  const handleCancel = () => {
    if (id === 'novo') {
      navigate('/cadastros/pessoas');
    } else {
      setIsEditing(false);
    }
  };

  // Se for novo ou estiver editando, mostrar formulário
  if (id === 'novo' || isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {id === 'novo' ? 'Nova Pessoa' : 'Editar Pessoa'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {id === 'novo' 
                ? 'Preencha os dados para criar um novo cadastro'
                : `Editando: ${currentRecord?.nome_completo || currentRecord?.razao_social || `Código ${id}`}`
              }
            </p>
          </div>
          <button
            onClick={() => navigate('/cadastros/pessoas')}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {formErrors._general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {formErrors._general}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {loading && id !== 'novo' && !currentRecord ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <DynamicForm
              key={id === 'novo' && nextCode ? `new-${nextCode}` : `edit-${id}`}
              fields={formFields}
              initialData={formDataState !== null ? formDataState : (id === 'novo' ? sampleData : currentRecord)}
              onSubmit={handleSubmit}
              onSaveAndNew={id === 'novo' ? handleSaveAndNew : undefined}
              onCancel={handleCancel}
              loading={loading}
              errors={formErrors}
              showSaveAndNew={id === 'novo'}
            />
          )}
        </div>
      </div>
    );
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
        onEdit={() => setIsEditing(true)}
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

