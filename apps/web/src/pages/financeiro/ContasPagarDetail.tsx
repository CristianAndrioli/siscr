import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { contasPagarService } from '../../services/cadastros/contasPagar';
import { pessoasService } from '../../services/cadastros/pessoas';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import type { ContaPagar, Pessoa } from '../../types';

export function ContasPagarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [nextCode, setNextCode] = useState<number | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, unknown> | null>(null);
  const [fornecedores, setFornecedores] = useState<Pessoa[]>([]);
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud<ContaPagar>({
    service: contasPagarService,
    basePath: '/financeiro/contas-pagar',
    getRecordId: (record) => record.codigo_conta,
  });

  useEffect(() => {
    pessoasService.list().then(response => {
      const data = Array.isArray(response) ? response : response.results || [];
      setFornecedores(data.filter((p: Pessoa) => p.tipo === 'PJ'));
    });

    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      contasPagarService.proximoCodigo().then(response => {
        setNextCode(response.proximo_codigo);
      });
    }
  }, [id, loadRecord]);

  const sampleData = useMemo(() => {
    if (id === 'novo') {
      const hoje = new Date().toISOString().split('T')[0];
      return {
        codigo_conta: nextCode || '',
        numero_documento: '',
        fornecedor: '',
        valor_total: 0,
        valor_pago: 0,
        data_emissao: hoje,
        data_vencimento: hoje,
        status: 'Pendente',
        forma_pagamento: '',
        descricao: '',
        observacoes: '',
      };
    }
    return (currentRecord || {}) as Record<string, unknown>;
  }, [id, nextCode, currentRecord]);

  const formFields = useAutoFormFields(sampleData, {
    hiddenFields: ['valor_pendente', 'created_at', 'updated_at', 'fornecedor_nome'],
    readOnlyFields: ['codigo_conta', 'valor_pendente'],
    fieldConfigs: {
      codigo_conta: { label: 'Código', readOnly: true },
      fornecedor: {
        type: 'select',
        label: 'Fornecedor',
        options: fornecedores.map(f => ({
          value: f.codigo_cadastro,
          label: f.razao_social || f.nome_fantasia || `Código ${f.codigo_cadastro}`,
        })),
      },
      valor_total: { type: 'number', label: 'Valor Total', step: '0.01' },
      valor_pago: { type: 'number', label: 'Valor Pago', step: '0.01' },
      data_emissao: { type: 'text', label: 'Data de Emissão' },
      data_vencimento: { type: 'text', label: 'Data de Vencimento' },
      status: {
        type: 'select',
        options: [
          { value: 'Pendente', label: 'Pendente' },
          { value: 'Parcial', label: 'Parcial' },
          { value: 'Pago', label: 'Pago' },
          { value: 'Cancelado', label: 'Cancelado' },
          { value: 'Vencido', label: 'Vencido' },
        ],
      },
      forma_pagamento: {
        type: 'select',
        options: [
          { value: 'Dinheiro', label: 'Dinheiro' },
          { value: 'PIX', label: 'PIX' },
          { value: 'Boleto', label: 'Boleto' },
          { value: 'Cartão Crédito', label: 'Cartão de Crédito' },
          { value: 'Cartão Débito', label: 'Cartão de Débito' },
          { value: 'Transferência', label: 'Transferência Bancária' },
          { value: 'Cheque', label: 'Cheque' },
        ],
      },
      descricao: { type: 'textarea', label: 'Descrição', rows: 3 },
      observacoes: { type: 'textarea', label: 'Observações', rows: 3 },
    },
  });

  const saveRecord = async (formData: Record<string, unknown>): Promise<void> => {
    try {
      setFormErrors({});
      const dataToSave = { ...formData };
      
      if (id === 'novo') {
        await createRecord(dataToSave as Partial<ContaPagar>);
      } else {
        await updateRecord(id!, dataToSave as Partial<ContaPagar>);
      }
      
      navigate('/financeiro/contas-pagar');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const errorResponse = err as { response?: { data?: Record<string, string | string[]> } };
        if (errorResponse.response?.data) {
          const errors: Record<string, string> = {};
          Object.entries(errorResponse.response.data).forEach(([key, value]) => {
            errors[key] = Array.isArray(value) ? value[0] : value;
          });
          setFormErrors(errors);
        }
      }
    }
  };

  const handleSubmit = async (formData: Record<string, unknown>): Promise<void> => {
    await saveRecord(formData);
  };

  const handleCancel = (): void => {
    if (id === 'novo') {
      navigate('/financeiro/contas-pagar');
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
              {id === 'novo' ? 'Nova Conta a Pagar' : 'Editar Conta a Pagar'}
            </h1>
          </div>
          <button onClick={() => navigate('/financeiro/contas-pagar')} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <DynamicForm
            key={id === 'novo' && nextCode ? `new-${nextCode}` : `edit-${id}`}
            fields={formFields}
            initialData={formDataState !== null ? formDataState : (id === 'novo' ? sampleData : (currentRecord as Record<string, unknown>))}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            errors={formErrors}
          />
        </div>
      </div>
    );
  }

  if (loading && !currentRecord) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  const fields = [
    { key: 'codigo_conta', label: 'Código' },
    { key: 'numero_documento', label: 'Número do Documento' },
    { key: 'fornecedor_nome', label: 'Fornecedor' },
    { key: 'valor_total', label: 'Valor Total', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'valor_pago', label: 'Valor Pago', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'valor_pendente', label: 'Valor Pendente', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'data_emissao', label: 'Data de Emissão', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'data_vencimento', label: 'Data de Vencimento', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'data_pagamento', label: 'Data de Pagamento', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'status', label: 'Status' },
    { key: 'forma_pagamento', label: 'Forma de Pagamento' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'observacoes', label: 'Observações' },
  ];

  return (
    <DetailView
      title={`Conta a Pagar #${currentRecord?.numero_documento || id}`}
      subtitle={`Código: ${currentRecord?.codigo_conta || id}`}
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/financeiro/contas-pagar')}
      loading={loading}
      error={error}
    />
  );
}

export default ContasPagarDetail;

