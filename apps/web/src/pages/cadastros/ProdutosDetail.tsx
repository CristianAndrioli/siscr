import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { produtosService } from '../../services/cadastros/produtos';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import type { Produto } from '../../types';

/**
 * Página de detalhamento/edição/criação de Produto
 * Suporta visualização, edição e criação de registros
 */
export function ProdutosDetail() {
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
  } = useCrud<Produto>({
    service: produtosService,
    basePath: '/cadastros/produtos',
    getRecordId: (record) => record.codigo_produto,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      produtosService.proximoCodigo().then(response => {
        setNextCode(response.proximo_codigo);
      }).catch(err => {
        console.error('Erro ao carregar próximo código:', err);
      });
    }
  }, [id, loadRecord]);

  const sampleData = useMemo(() => {
    if (id === 'novo') {
      return {
        codigo_produto: nextCode || '',
        nome: '',
        descricao: '',
        ativo: true,
        valor_custo: 0.00,
        valor_venda: 0.00,
        unidade_medida: 'UN',
        peso_liquido: null,
        peso_bruto: null,
        codigo_ncm: '',
        cfop_interno: '',
        origem_mercadoria: '0',
        cst_icms: '',
        aliquota_icms: 0.00,
        aliquota_ipi: 0.00,
        codigo_di: '',
        incoterm: '',
        moeda_negociacao: 'BRL',
        aliquota_ii: 0.00,
      };
    }
    return (currentRecord || {}) as Record<string, unknown>;
  }, [id, nextCode, currentRecord]);

  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: [],
    readOnlyFields: ['codigo_produto'],
    fieldConfigs: {
      codigo_produto: { label: 'Código', readOnly: true, section: 'Identificação' },
      nome: { label: 'Nome do Produto', required: true, section: 'Identificação' },
      descricao: { type: 'textarea', rows: 4, label: 'Descrição', section: 'Identificação' },
      ativo: { type: 'checkbox', label: 'Ativo', section: 'Identificação' },
      valor_custo: { label: 'Valor de Custo', type: 'number', step: '0.01', section: 'Valores e Logística' },
      valor_venda: { label: 'Valor de Venda', type: 'number', step: '0.01', section: 'Valores e Logística' },
      unidade_medida: {
        type: 'select',
        label: 'Unidade de Medida',
        options: [
          { value: 'UN', label: 'Unidade' },
          { value: 'KG', label: 'Kilograma' },
          { value: 'LT', label: 'Litro' },
          { value: 'M2', label: 'Metro Quadrado' },
        ],
        section: 'Valores e Logística',
      },
      peso_liquido: { label: 'Peso Líquido (Kg)', type: 'number', step: '0.001', section: 'Valores e Logística' },
      peso_bruto: { label: 'Peso Bruto (Kg)', type: 'number', step: '0.001', section: 'Valores e Logística' },
      codigo_ncm: { label: 'Código NCM', section: 'Tributação Nacional' },
      cfop_interno: { section: 'Tributação Nacional' },
      origem_mercadoria: {
        type: 'select',
        label: 'Origem da Mercadoria',
        options: [
          { value: '0', label: 'Nacional' },
          { value: '1', label: 'Estrangeira - Importação Direta' },
          { value: '2', label: 'Estrangeira - Adquirida no Mercado Interno' },
        ],
        section: 'Tributação Nacional',
      },
      cst_icms: { section: 'Tributação Nacional' },
      aliquota_icms: { section: 'Tributação Nacional' },
      aliquota_ipi: { section: 'Tributação Nacional' },
      codigo_di: { section: 'Comércio Exterior' },
      incoterm: { section: 'Comércio Exterior' },
      moeda_negociacao: {
        type: 'select',
        label: 'Moeda de Negociação',
        options: [
          { value: 'BRL', label: 'Real' },
          { value: 'USD', label: 'Dólar Americano' },
          { value: 'EUR', label: 'Euro' },
        ],
        section: 'Comércio Exterior',
      },
      aliquota_ii: { section: 'Comércio Exterior' },
    },
  });

  const saveRecord = async (formData: Record<string, unknown>, shouldCreateNew = false): Promise<void> => {
    try {
      setFormErrors({});
      setFormDataState(formData);
      
      const dataToSend = { ...formData } as Partial<Produto>;
      if (id === 'novo') {
        if (!dataToSend.codigo_produto || dataToSend.codigo_produto === '') {
          if (nextCode) {
            dataToSend.codigo_produto = nextCode;
          } else {
            const codeResponse = await produtosService.proximoCodigo();
            dataToSend.codigo_produto = codeResponse.proximo_codigo;
          }
        } else {
          dataToSend.codigo_produto = typeof dataToSend.codigo_produto === 'number' 
            ? dataToSend.codigo_produto 
            : parseInt(String(dataToSend.codigo_produto), 10);
        }
        await createRecord(dataToSend);
        
        if (shouldCreateNew) {
          setFormErrors({});
          const codeResponse = await produtosService.proximoCodigo();
          setNextCode(codeResponse.proximo_codigo);
          setFormDataState(null);
        } else {
          navigate('/cadastros/produtos');
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
      navigate('/cadastros/produtos');
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
              {id === 'novo' ? 'Novo Produto' : 'Editar Produto'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {id === 'novo' 
                ? 'Preencha os dados para criar um novo produto'
                : `Editando: ${currentRecord?.nome || `Código ${id}`}`
              }
            </p>
          </div>
          <button
            onClick={() => navigate('/cadastros/produtos')}
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
    { key: 'codigo_produto', label: 'Código' },
    { key: 'nome', label: 'Nome' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'ativo', label: 'Ativo', render: (value: unknown) => (value ? 'Sim' : 'Não') },
    { key: 'valor_custo', label: 'Valor de Custo', render: (value: unknown) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
    }},
    { key: 'valor_venda', label: 'Valor de Venda', render: (value: unknown) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
    }},
    { key: 'unidade_medida', label: 'Unidade de Medida' },
    { key: 'peso_liquido', label: 'Peso Líquido (Kg)' },
    { key: 'peso_bruto', label: 'Peso Bruto (Kg)' },
    { key: 'codigo_ncm', label: 'Código NCM' },
    { key: 'cfop_interno', label: 'CFOP Interno' },
    { key: 'origem_mercadoria', label: 'Origem da Mercadoria', render: (value: unknown) => {
      const origens: Record<string, string> = { '0': 'Nacional', '1': 'Estrangeira - Importação Direta', '2': 'Estrangeira - Adquirida no Mercado Interno' };
      return origens[String(value)] || String(value);
    }},
    { key: 'cst_icms', label: 'CST ICMS' },
    { key: 'aliquota_icms', label: 'Alíquota ICMS (%)' },
    { key: 'aliquota_ipi', label: 'Alíquota IPI (%)' },
    { key: 'codigo_di', label: 'Código DI' },
    { key: 'incoterm', label: 'Incoterm' },
    { key: 'moeda_negociacao', label: 'Moeda de Negociação' },
    { key: 'aliquota_ii', label: 'Alíquota II (%)' },
  ];

  return (
    <DetailView
      title={currentRecord?.nome || `Produto #${id}`}
      subtitle={`Código: ${currentRecord?.codigo_produto || id}`}
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/cadastros/produtos')}
      loading={loading}
      error={error}
    />
  );
}

export default ProdutosDetail;

