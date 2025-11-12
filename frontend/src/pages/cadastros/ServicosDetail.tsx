import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { servicosService } from '../../services/cadastros/servicos';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import type { Servico } from '../../types';

/**
 * Página de detalhamento/edição/criação de Serviço
 * Suporta visualização, edição e criação de registros
 */
export function ServicosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [nextCode, setNextCode] = useState<number | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, unknown> | null>(null);
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud<Servico>({
    service: servicosService,
    basePath: '/cadastros/servicos',
    getRecordId: (record) => record.codigo_servico,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      servicosService.proximoCodigo().then(response => {
        setNextCode(response.proximo_codigo);
      }).catch(err => {
        console.error('Erro ao carregar próximo código:', err);
      });
    }
  }, [id, loadRecord]);

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
    return (currentRecord || {}) as Record<string, unknown>;
  }, [id, nextCode, currentRecord]);

  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: [],
    readOnlyFields: ['codigo_servico'],
    fieldConfigs: {
      codigo_servico: { label: 'Código', readOnly: true, section: 'Identificação' },
      nome: { label: 'Nome do Serviço', required: true, section: 'Identificação' },
      descricao: { type: 'textarea', rows: 4, label: 'Descrição', section: 'Identificação' },
      ativo: { type: 'checkbox', label: 'Ativo', section: 'Identificação' },
      valor_base: { label: 'Valor Base', type: 'number', step: '0.01', required: true, section: 'Valores e Contratos' },
      tipo_contrato: {
        type: 'select',
        label: 'Tipo de Contrato',
        options: [
          { value: 'Mensal', label: 'Mensal' },
          { value: 'Anual', label: 'Anual' },
          { value: 'Projeto', label: 'Por Projeto' },
          { value: 'Avulso', label: 'Avulso' },
        ],
        section: 'Valores e Contratos',
      },
      prazo_execucao: { label: 'Prazo de Execução (dias úteis)', type: 'number', section: 'Valores e Contratos' },
      valor_impostos_estimado: { label: 'Valor de Impostos Estimado', type: 'number', step: '0.01', section: 'Valores e Contratos' },
      codigo_ncm: { label: 'Código NCM', section: 'Tributação' },
      cfop: { label: 'CFOP', section: 'Tributação' },
      tributacao_pis: { label: 'Tributação PIS (%)', type: 'number', step: '0.01', section: 'Tributação' },
      tributacao_cofins: { label: 'Tributação COFINS (%)', type: 'number', step: '0.01', section: 'Tributação' },
      icms_tributado: { 
        type: 'checkbox', 
        label: 'ICMS Tributado',
        section: 'Tributação',
      },
    },
  });

  const saveRecord = async (formData: Record<string, unknown>, shouldCreateNew = false): Promise<void> => {
    try {
      setFormErrors({});
      setFormDataState(formData);
      
      const dataToSend = { ...formData } as Partial<Servico>;
      if (id === 'novo') {
        if (!dataToSend.codigo_servico || dataToSend.codigo_servico === '') {
          if (nextCode) {
            dataToSend.codigo_servico = nextCode;
          } else {
            const codeResponse = await servicosService.proximoCodigo();
            dataToSend.codigo_servico = codeResponse.proximo_codigo;
          }
        } else {
          dataToSend.codigo_servico = typeof dataToSend.codigo_servico === 'number' 
            ? dataToSend.codigo_servico 
            : parseInt(String(dataToSend.codigo_servico), 10);
        }
        await createRecord(dataToSend);
        
        if (shouldCreateNew) {
          setFormErrors({});
          const codeResponse = await servicosService.proximoCodigo();
          setNextCode(codeResponse.proximo_codigo);
          setFormDataState(null);
        } else {
          navigate('/cadastros/servicos');
        }
      } else {
        await updateRecord(id, dataToSend);
        setIsEditing(false);
      }
    } catch (err) {
      const axiosError = err as { response?: { data?: Record<string, unknown> } };
      if (axiosError.response?.data) {
        const apiErrors = axiosError.response.data;
        const errors: Record<string, string> = {};
        
        Object.keys(apiErrors).forEach(key => {
          const errorValue = apiErrors[key];
          if (Array.isArray(errorValue)) {
            errors[key] = String(errorValue[0]);
          } else if (typeof errorValue === 'string') {
            errors[key] = errorValue;
          }
        });
        
        setFormErrors(errors);
      } else {
        setFormErrors({ _general: 'Erro ao salvar. Tente novamente.' });
      }
    }
  };

  const handleSubmit = async (formData: Record<string, unknown>): Promise<void> => {
    await saveRecord(formData, false);
  };

  const handleSaveAndNew = async (formData: Record<string, unknown>): Promise<void> => {
    await saveRecord(formData, true);
  };

  const handleCancel = (): void => {
    if (id === 'novo') {
      navigate('/cadastros/servicos');
    } else {
      setIsEditing(false);
    }
  };

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
              initialData={formDataState !== null ? formDataState : (id === 'novo' ? sampleData : (currentRecord as Record<string, unknown>))}
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

  const fields = [
    { key: 'codigo_servico', label: 'Código' },
    { key: 'nome', label: 'Nome' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'ativo', label: 'Ativo', render: (value: unknown) => (value ? 'Sim' : 'Não') },
    { key: 'valor_base', label: 'Valor Base', render: (value: unknown) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
    }},
    { key: 'tipo_contrato', label: 'Tipo de Contrato' },
    { key: 'prazo_execucao', label: 'Prazo de Execução (dias úteis)' },
    { key: 'valor_impostos_estimado', label: 'Valor de Impostos Estimado', render: (value: unknown) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
    }},
    { key: 'codigo_ncm', label: 'Código NCM' },
    { key: 'cfop', label: 'CFOP' },
    { key: 'tributacao_pis', label: 'Tributação PIS (%)' },
    { key: 'tributacao_cofins', label: 'Tributação COFINS (%)' },
    { key: 'icms_tributado', label: 'ICMS Tributado', render: (value: unknown) => (value ? 'Sim' : 'Não') },
  ];

  return (
    <DetailView
      title={currentRecord?.nome || `Serviço #${id}`}
      subtitle={`Código: ${currentRecord?.codigo_servico || id}`}
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/cadastros/servicos')}
      loading={loading}
      error={error}
    />
  );
}

export default ServicosDetail;

