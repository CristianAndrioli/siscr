import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm, Button, Alert } from '../../components/common';
import { pessoasService } from '../../services/cadastros/pessoas';
import { emailService } from '../../services/email';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import { ESTADOS } from '../../utils/constants';
import type { Pessoa } from '../../types';

/**
 * Página de detalhamento/edição/criação de Pessoa
 * Suporta visualização, edição e criação de registros
 */
export function PessoasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [nextCode, setNextCode] = useState<number | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, unknown> | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  
  // Verificar se está em modo de desenvolvimento
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud<Pessoa>({
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
        tipo: 'PF' as const,
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
    return (currentRecord || {}) as Record<string, unknown>;
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
        options: ESTADOS.map(estado => ({
          value: estado.value,
          label: estado.label,
        })),
        section: 'Endereço',
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
      cep: { section: 'Endereço' },
      nome_contato: { section: 'Contato' },
      telefone_fixo: { section: 'Contato' },
      telefone_celular: { section: 'Contato' },
      email: { section: 'Contato' },
      cargo: { section: 'Contato' },
      comissoes: { section: 'Contato' },
    },
  });

  const saveRecord = async (formData: Record<string, unknown>, shouldCreateNew = false): Promise<void> => {
    try {
      setFormErrors({});
      // Manter dados do formulário em caso de erro
      setFormDataState(formData);
      
      // Garantir que codigo_cadastro esteja presente ao criar
      const dataToSend = { ...formData } as Partial<Pessoa>;
      if (id === 'novo') {
        // Sempre garantir que o código esteja presente e seja um número
        if (!dataToSend.codigo_cadastro || dataToSend.codigo_cadastro === '') {
          if (nextCode) {
            dataToSend.codigo_cadastro = nextCode;
          } else {
            // Se não tiver próximo código, buscar agora
            const codeResponse = await pessoasService.proximoCodigo();
            dataToSend.codigo_cadastro = codeResponse.proximo_codigo;
          }
        } else {
          // Garantir que seja número
          dataToSend.codigo_cadastro = typeof dataToSend.codigo_cadastro === 'number' 
            ? dataToSend.codigo_cadastro 
            : parseInt(String(dataToSend.codigo_cadastro), 10);
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
      // Não navegar - manter formulário com dados preenchidos
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
      navigate('/cadastros/pessoas');
    } else {
      setIsEditing(false);
    }
  };

  const handleTestEmail = useCallback(async () => {
    if (!currentRecord) return;
    
    const email = (currentRecord as any).email;
    if (!email) {
      setEmailTestResult({ success: false, error: 'Esta pessoa não possui email cadastrado' });
      return;
    }

    setTestingEmail(true);
    setEmailTestResult(null);

    try {
      const result = await emailService.testEmail({ to_email: email });
      setEmailTestResult(result);
    } catch (err: any) {
      console.error('Erro ao testar email:', err);
      setEmailTestResult({
        success: false,
        error: err.response?.data?.error || err.response?.data?.detail || 'Erro ao enviar email de teste',
      });
    } finally {
      setTestingEmail(false);
    }
  }, [currentRecord]);

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

  // Configuração dos campos para exibição
  const fields = [
    { key: 'codigo_cadastro', label: 'Código' },
    { key: 'tipo', label: 'Tipo', render: (value: unknown) => (value === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica') },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ' },
    { key: 'nome_completo', label: 'Nome Completo' },
    { key: 'razao_social', label: 'Razão Social' },
    { key: 'nome_fantasia', label: 'Nome Fantasia' },
    { key: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { key: 'contribuinte', label: 'Contribuinte ICMS', render: (value: unknown) => (value ? 'Sim' : 'Não') },
    { key: 'logradouro', label: 'Logradouro' },
    { key: 'numero', label: 'Número' },
    { key: 'letra', label: 'Letra' },
    { key: 'complemento', label: 'Complemento' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'Estado' },
    { key: 'cep', label: 'CEP' },
    { key: 'nome_contato', label: 'Nome do Contato' },
    { key: 'telefone_fixo', label: 'Telefone Fixo' },
    { key: 'telefone_celular', label: 'Telefone Celular' },
    { key: 'email', label: 'Email' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'comissoes', label: 'Comissões (%)' },
    { key: 'observacoes', label: 'Observações' },
  ];

  // Gerar tabs com botão de teste de email em desenvolvimento
  const tabs = useMemo(() => {
    const detailTab = {
      id: 'detalhamento',
      label: 'Detalhamento',
      content: (
        <div className="space-y-6">
          {error && (
            <Alert type="error" message={error} onClose={() => {}} dismissible={false} />
          )}
          
          {/* Botão de teste de email (apenas em desenvolvimento) */}
          {isDevelopment && currentRecord && (currentRecord as any).email && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    🧪 Modo Desenvolvimento
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Teste o envio de email para: {(currentRecord as any).email}
                  </p>
                </div>
                <Button
                  onClick={handleTestEmail}
                  variant="secondary"
                  size="sm"
                  disabled={testingEmail}
                >
                  {testingEmail ? 'Enviando...' : 'Enviar Email de Teste'}
                </Button>
              </div>
              
              {emailTestResult && (
                <div className={`mt-3 p-3 rounded ${
                  emailTestResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <p className="text-sm">
                    {emailTestResult.success ? '✓ ' : '✗ '}
                    {emailTestResult.message || emailTestResult.error}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => {
              const value = (currentRecord as Record<string, unknown>)[field.key];
              const displayValue = field.render ? field.render(value) : (value ?? '-');
              return (
                <div key={field.key} className="border-b border-gray-200 pb-2">
                  <label className="text-sm font-medium text-gray-500">{field.label}</label>
                  <p className="mt-1 text-sm text-gray-900">{displayValue}</p>
                </div>
              );
            })}
          </div>
        </div>
      ),
    };
    
    return [detailTab];
  }, [currentRecord, fields, error, isDevelopment, testingEmail, emailTestResult, handleTestEmail]);

  return (
    <DetailView
      title={currentRecord?.nome_completo || currentRecord?.razao_social || `Pessoa #${id}`}
      subtitle={`Código: ${currentRecord?.codigo_cadastro || id}`}
      tabs={tabs}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/cadastros/pessoas')}
      loading={loading}
      error={error}
    />
  );
}

export default PessoasDetail;

