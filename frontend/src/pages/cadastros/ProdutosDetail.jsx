import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { produtosService } from '../../services/cadastros/produtos';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';

/**
 * Página de detalhamento/edição/criação de Produto
 * Suporta visualização, edição e criação de registros
 */
export function ProdutosDetail() {
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
    service: produtosService,
    basePath: '/cadastros/produtos',
    getRecordId: (record) => record.codigo_produto,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      // Carregar próximo código quando for novo
      produtosService.proximoCodigo().then(response => {
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
    return currentRecord || {};
  }, [id, nextCode, currentRecord]);

  // Gerar campos do formulário automaticamente
  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: [], // Mostrar todos os campos
    readOnlyFields: ['codigo_produto'], // Código é somente leitura
    fieldConfigs: {
      codigo_produto: {
        label: 'Código',
        readOnly: true,
      },
      nome: {
        label: 'Nome do Produto',
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
      valor_custo: {
        label: 'Valor de Custo',
        type: 'number',
        step: '0.01',
      },
      valor_venda: {
        label: 'Valor de Venda',
        type: 'number',
        step: '0.01',
      },
      unidade_medida: {
        type: 'select',
        label: 'Unidade de Medida',
        options: [
          { value: 'UN', label: 'Unidade' },
          { value: 'KG', label: 'Kilograma' },
          { value: 'LT', label: 'Litro' },
          { value: 'M2', label: 'Metro Quadrado' },
        ],
      },
      peso_liquido: {
        label: 'Peso Líquido (Kg)',
        type: 'number',
        step: '0.001',
      },
      peso_bruto: {
        label: 'Peso Bruto (Kg)',
        type: 'number',
        step: '0.001',
      },
      codigo_ncm: {
        label: 'Código NCM',
      },
      origem_mercadoria: {
        type: 'select',
        label: 'Origem da Mercadoria',
        options: [
          { value: '0', label: 'Nacional' },
          { value: '1', label: 'Estrangeira - Importação Direta' },
          { value: '2', label: 'Estrangeira - Adquirida no Mercado Interno' },
        ],
      },
      moeda_negociacao: {
        type: 'select',
        label: 'Moeda de Negociação',
        options: [
          { value: 'BRL', label: 'Real' },
          { value: 'USD', label: 'Dólar Americano' },
          { value: 'EUR', label: 'Euro' },
        ],
      },
      // Agrupar campos em seções
      codigo_produto: { section: 'Identificação' },
      nome: { section: 'Identificação' },
      descricao: { section: 'Identificação' },
      ativo: { section: 'Identificação' },
      valor_custo: { section: 'Valores e Logística' },
      valor_venda: { section: 'Valores e Logística' },
      unidade_medida: { section: 'Valores e Logística' },
      peso_liquido: { section: 'Valores e Logística' },
      peso_bruto: { section: 'Valores e Logística' },
      codigo_ncm: { section: 'Tributação Nacional' },
      cfop_interno: { section: 'Tributação Nacional' },
      origem_mercadoria: { section: 'Tributação Nacional' },
      cst_icms: { section: 'Tributação Nacional' },
      aliquota_icms: { section: 'Tributação Nacional' },
      aliquota_ipi: { section: 'Tributação Nacional' },
      codigo_di: { section: 'Comércio Exterior' },
      incoterm: { section: 'Comércio Exterior' },
      moeda_negociacao: { section: 'Comércio Exterior' },
      aliquota_ii: { section: 'Comércio Exterior' },
    },
  });

  const saveRecord = async (formData, shouldCreateNew = false) => {
    try {
      setFormErrors({});
      // Manter dados do formulário em caso de erro
      setFormDataState(formData);
      
      // Garantir que codigo_produto esteja presente ao criar
      const dataToSend = { ...formData };
      if (id === 'novo') {
        // Sempre garantir que o código esteja presente e seja um número
        if (!dataToSend.codigo_produto || dataToSend.codigo_produto === '') {
          if (nextCode) {
            dataToSend.codigo_produto = parseInt(nextCode, 10);
          } else {
            // Se não tiver próximo código, buscar agora
            const codeResponse = await produtosService.proximoCodigo();
            dataToSend.codigo_produto = parseInt(codeResponse.proximo_codigo, 10);
          }
        } else {
          // Garantir que seja número
          dataToSend.codigo_produto = parseInt(dataToSend.codigo_produto, 10);
        }
        // Criar novo registro
        await createRecord(dataToSend);
        
        if (shouldCreateNew) {
          // Limpar formulário e carregar próximo código
          setFormErrors({});
          const codeResponse = await produtosService.proximoCodigo();
          setNextCode(codeResponse.proximo_codigo);
          // Limpar formDataState para resetar o formulário (será recriado pelo sampleData)
          setFormDataState(null);
          // Manter na mesma rota /novo - o formulário será recriado automaticamente
        } else {
          navigate('/cadastros/produtos');
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
      navigate('/cadastros/produtos');
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
    { key: 'codigo_produto', label: 'Código' },
    { key: 'nome', label: 'Nome' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'ativo', label: 'Ativo', render: (value) => value ? 'Sim' : 'Não' },
    { key: 'valor_custo', label: 'Valor de Custo', render: (value) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }},
    { key: 'valor_venda', label: 'Valor de Venda', render: (value) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }},
    { key: 'unidade_medida', label: 'Unidade de Medida' },
    { key: 'peso_liquido', label: 'Peso Líquido (Kg)' },
    { key: 'peso_bruto', label: 'Peso Bruto (Kg)' },
    { key: 'codigo_ncm', label: 'Código NCM' },
    { key: 'cfop_interno', label: 'CFOP Interno' },
    { key: 'origem_mercadoria', label: 'Origem da Mercadoria', render: (value) => {
      const origens = { '0': 'Nacional', '1': 'Estrangeira - Importação Direta', '2': 'Estrangeira - Adquirida no Mercado Interno' };
      return origens[value] || value;
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
      data={currentRecord}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id)}
      onBack={() => navigate('/cadastros/produtos')}
      loading={loading}
      error={error}
    />
  );
}

export default ProdutosDetail;

