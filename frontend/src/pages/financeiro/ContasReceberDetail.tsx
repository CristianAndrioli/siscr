import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm } from '../../components/common';
import { contasReceberService } from '../../services/cadastros/contasReceber';
import { pessoasService } from '../../services/cadastros/pessoas';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import type { ContaReceber, Pessoa } from '../../types';

export function ContasReceberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [nextCode, setNextCode] = useState<number | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, unknown> | null>(null);
  const [clientes, setClientes] = useState<Pessoa[]>([]);
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud<ContaReceber>({
    service: contasReceberService,
    basePath: '/financeiro/contas-receber',
    getRecordId: (record) => record.codigo_conta,
  });

  useEffect(() => {
    // Carregar clientes para o select
    pessoasService.list().then(response => {
      const data = Array.isArray(response) ? response : response.results || [];
      setClientes(data.filter((p: Pessoa) => p.tipo === 'PJ'));
    });

    if (id && id !== 'novo') {
      loadRecord(id);
    } else if (id === 'novo') {
      contasReceberService.proximoCodigo().then(response => {
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
        cliente: '',
        valor_total: 0,
        valor_recebido: 0,
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
    hiddenFields: ['valor_pendente', 'created_at', 'updated_at', 'cliente_nome'],
    readOnlyFields: ['codigo_conta', 'valor_pendente'],
    fieldConfigs: {
      codigo_conta: { label: 'Código', readOnly: true },
      cliente: {
        type: 'select',
        label: 'Cliente',
        options: clientes.map(c => ({
          value: c.codigo_cadastro,
          label: c.razao_social || c.nome_fantasia || `Código ${c.codigo_cadastro}`,
        })),
      },
      valor_total: { type: 'number', label: 'Valor Total', step: '0.01' },
      valor_recebido: { type: 'number', label: 'Valor Recebido', step: '0.01' },
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

  const saveRecord = async (formData: Record<string, unknown>, saveAndNew = false): Promise<void> => {
    try {
      setFormErrors({});
      const dataToSave = { ...formData };
      
      if (id === 'novo') {
        await createRecord(dataToSave as Partial<ContaReceber>);
      } else {
        await updateRecord(id!, dataToSave as Partial<ContaReceber>);
      }
      
      if (saveAndNew) {
        navigate('/financeiro/contas-receber/novo');
      } else {
        navigate('/financeiro/contas-receber');
      }
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
      navigate('/financeiro/contas-receber');
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
              {id === 'novo' ? 'Nova Conta a Receber' : 'Editar Conta a Receber'}
            </h1>
          </div>
          <button onClick={() => navigate('/financeiro/contas-receber')} className="text-gray-500 hover:text-gray-700">
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
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'valor_total', label: 'Valor Total', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'valor_recebido', label: 'Valor Recebido', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'valor_pendente', label: 'Valor Pendente', render: (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) },
    { key: 'data_emissao', label: 'Data de Emissão', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'data_vencimento', label: 'Data de Vencimento', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'data_recebimento', label: 'Data de Recebimento', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('pt-BR') : '-' },
    { key: 'status', label: 'Status' },
    { key: 'forma_pagamento', label: 'Forma de Pagamento' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'observacoes', label: 'Observações' },
  ];

  return (
    <DetailView
      title={`Conta a Receber #${currentRecord?.numero_documento || id}`}
      subtitle={`Código: ${currentRecord?.codigo_conta || id}`}
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/financeiro/contas-receber')}
      loading={loading}
      error={error}
    />
  );
}

export default ContasReceberDetail;

