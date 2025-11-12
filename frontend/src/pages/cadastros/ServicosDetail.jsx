import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { servicosService } from '../../services/cadastros/servicos';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';

/**
 * Página de detalhamento/edição/criação de Serviço
 * Suporta visualização, edição e criação de registros
 */
export function ServicosDetail() {
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
    service: servicosService,
    basePath: '/cadastros/servicos',
    getRecordId: (record) => record.codigo_servico,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      // Carregar próximo código quando for novo
      servicosService.proximoCodigo().then(response => {
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
        codigo_servico: nextCode || '',
        nome: '',
        descricao: '',
        ativo: true,
        valor_base: 0.00,
        tipo_contrato: 'Avulso',
        prazo_execucao: null,
        valor_impostos_estimado: 0.00,
        codigo_ncm: '',
        cfop: '',
        tributacao_pis: 0.00,
        tributacao_cofins: 0.00,
        icms_tributado: false,
      };
    }
    return currentRecord || {};
  }, [id, nextCode, currentRecord]);

  // Gerar campos do formulário automaticamente
  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: [], // Mostrar todos os campos
    readOnlyFields: ['codigo_servico'], // Código é somente leitura
    fieldConfigs: {
      codigo_servico: {
        label: 'Código',
        readOnly: true,
      },
      nome: {
        label: 'Nome do Serviço',
        required: true,
      },
      descricao: {
        type: 'textarea',
        rows: 4,
        label: 'Descrição',
      },
      ativo: {
        type: 'checkbox',
        label: 'Ativo',
      },
      valor_base: {
        label: 'Valor Base',
        type: 'number',
        step: '0.01',
        required: true,
      },
      tipo_contrato: {
        type: 'select',
        label: 'Tipo de Contrato',
        options: [
          { value: 'Mensal', label: 'Mensal' },
          { value: 'Anual', label: 'Anual' },
          { value: 'Projeto', label: 'Por Projeto' },
          { value: 'Avulso', label: 'Avulso' },
        ],
      },
      prazo_execucao: {
        label: 'Prazo de Execução (dias úteis)',
        type: 'number',
      },
      valor_impostos_estimado: {
        label: 'Valor de Impostos Estimado',
        type: 'number',
        step: '0.01',
      },
      codigo_ncm: {
        label: 'Código NCM',
      },
      cfop: {
        label: 'CFOP',
      },
      tributacao_pis: {
        label: 'Tributação PIS (%)',
        type: 'number',
        step: '0.01',
      },
      tributacao_cofins: {
        label: 'Tributação COFINS (%)',
        type: 'number',
        step: '0.01',
      },
      icms_tributado: {
        type: 'checkbox',
        label: 'ICMS Tributado',
      },
      // Agrupar campos em seções
      codigo_servico: { section: 'Identificação' },
      nome: { section: 'Identificação' },
      descricao: { section: 'Identificação' },
      ativo: { section: 'Identificação' },
      valor_base: { section: 'Valores e Contratos' },
      tipo_contrato: { section: 'Valores e Contratos' },
      prazo_execucao: { section: 'Valores e Contratos' },
      valor_impostos_estimado: { section: 'Valores e Contratos' },
      codigo_ncm: { section: 'Tributação' },
      cfop: { section: 'Tributação' },
      tributacao_pis: { section: 'Tributação' },
      tributacao_cofins: { section: 'Tributação' },
      icms_tributado: { section: 'Tributação' },
    },
  });

  const saveRecord = async (formData, shouldCreateNew = false) => {
    try {
      setFormErrors({});
      // Manter dados do formulário em caso de erro
      setFormDataState(formData);
      
      // Garantir que codigo_servico esteja presente ao criar
      const dataToSend = { ...formData };
      if (id === 'novo') {
        // Sempre garantir que o código esteja presente e seja um número
        if (!dataToSend.codigo_servico || dataToSend.codigo_servico === '') {
          if (nextCode) {
            dataToSend.codigo_servico = parseInt(nextCode, 10);
          } else {
            // Se não tiver próximo código, buscar agora
            const codeResponse = await servicosService.proximoCodigo();
            dataToSend.codigo_servico = parseInt(codeResponse.proximo_codigo, 10);
          }
        } else {
          // Garantir que seja número
          dataToSend.codigo_servico = parseInt(dataToSend.codigo_servico, 10);
        }
        // Criar novo registro
        await createRecord(dataToSend);
        
        if (shouldCreateNew) {
          // Limpar formulário e carregar próximo código
          setFormErrors({});
          const codeResponse = await servicosService.proximoCodigo();
          setNextCode(codeResponse.proximo_codigo);
          // Limpar formDataState para resetar o formulário (será recriado pelo sampleData)
          setFormDataState(null);
          // Manter na mesma rota /novo - o formulário será recriado automaticamente
        } else {
          navigate('/cadastros/servicos');
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
      navigate('/cadastros/servicos');
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
              {id === 'novo' ? 'Novo Serviço' : 'Editar Serviço'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {id === 'novo' 
                ? 'Preencha os dados para criar um novo serviço'
                : `Editando: ${currentRecord?.nome || `Código ${id}`}`
              }
            </p>
          </div>
          <button
            onClick={() => navigate('/cadastros/servicos')}
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
    { key: 'codigo_servico', label: 'Código' },
    { key: 'nome', label: 'Nome' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'ativo', label: 'Ativo', render: (value) => value ? 'Sim' : 'Não' },
    { key: 'valor_base', label: 'Valor Base', render: (value) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }},
    { key: 'tipo_contrato', label: 'Tipo de Contrato' },
    { key: 'prazo_execucao', label: 'Prazo de Execução (dias úteis)' },
    { key: 'valor_impostos_estimado', label: 'Valor de Impostos Estimado', render: (value) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }},
    { key: 'codigo_ncm', label: 'Código NCM' },
    { key: 'cfop', label: 'CFOP' },
    { key: 'tributacao_pis', label: 'Tributação PIS (%)' },
    { key: 'tributacao_cofins', label: 'Tributação COFINS (%)' },
    { key: 'icms_tributado', label: 'ICMS Tributado', render: (value) => value ? 'Sim' : 'Não' },
  ];

  return (
    <DetailView
      title={currentRecord?.nome || `Serviço #${id}`}
      subtitle={`Código: ${currentRecord?.codigo_servico || id}`}
      fields={fields}
      data={currentRecord}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id)}
      onBack={() => navigate('/cadastros/servicos')}
      loading={loading}
      error={error}
    />
  );
}

export default ServicosDetail;

