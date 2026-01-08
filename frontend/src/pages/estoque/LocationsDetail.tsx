import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView, DynamicForm, Alert } from '../../components/common';
import { locationsService, type Location } from '../../services/estoque';
import { useAutoFormFields } from '../../hooks/useAutoFormFields';
import { ESTADOS } from '../../utils/constants';

/**
 * Página de detalhamento/edição/criação de Location
 * Suporta visualização, edição e criação de registros
 */
export function LocationsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formDataState, setFormDataState] = useState<Record<string, unknown> | null>(null);
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
    createRecord,
    updateRecord,
    handleDeleteRecord,
  } = useCrud<Location>({
    service: locationsService,
    basePath: '/estoque/locations',
    getRecordId: (record) => record.id,
  });

  useEffect(() => {
    if (id && id !== 'novo') {
      loadRecord(id);
    }
  }, [id, loadRecord]);

  // Criar objeto vazio com estrutura para gerar campos quando for novo
  const sampleData: Partial<Location> = useMemo(() => ({
    nome: '',
    codigo: '',
    tipo: 'LOJA',
    empresa: 0,
    filial: null,
    logradouro: '',
    numero: '',
    letra: null,
    complemento: null,
    bairro: '',
    cidade: '',
    estado: 'SC',
    cep: '',
    permite_entrada: true,
    permite_saida: true,
    ativo: true,
  }), []);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    try {
      setFormErrors({});
      setFormDataState(data);
      
      if (id === 'novo') {
        await createRecord(data as Partial<Location>);
        navigate('/estoque/locations');
      } else {
        await updateRecord(id!, data as Partial<Location>);
        setIsEditing(false);
        if (id) {
          await loadRecord(id);
        }
      }
    } catch (err: any) {
      const errorData = err?.response?.data || {};
      if (errorData) {
        const fieldErrors: Record<string, string> = {};
        Object.keys(errorData).forEach((key) => {
          if (Array.isArray(errorData[key])) {
            fieldErrors[key] = errorData[key][0];
          } else if (typeof errorData[key] === 'string') {
            fieldErrors[key] = errorData[key];
          }
        });
        setFormErrors(fieldErrors);
      } else {
        setFormErrors({ _general: 'Erro ao salvar location' });
      }
    }
  }, [id, createRecord, updateRecord, navigate, loadRecord]);

  const handleCancel = useCallback(() => {
    if (id === 'novo') {
      navigate('/estoque/locations');
    } else {
      setIsEditing(false);
      if (id) {
        loadRecord(id);
      }
    }
  }, [id, navigate, loadRecord]);

  // Gerar campos do formulário automaticamente
  const formFields = useAutoFormFields(
    id === 'novo' ? sampleData : (currentRecord || sampleData),
    {
      hiddenFields: ['id', 'created_at', 'updated_at', 'endereco_completo', 'empresa_nome', 'filial_nome'],
      fieldOverrides: {
        nome: {
          label: 'Nome',
          required: true,
          type: 'text',
        },
        codigo: {
          label: 'Código',
          required: true,
          type: 'text',
        },
        tipo: {
          label: 'Tipo',
          required: true,
          type: 'select',
          options: [
            { value: 'LOJA', label: 'Loja' },
            { value: 'ALMOXARIFADO', label: 'Almoxarifado' },
            { value: 'ARMAZEM', label: 'Armazém' },
            { value: 'CENTRO_DISTRIBUICAO', label: 'Centro de Distribuição' },
            { value: 'ESTOQUE_TERCEIRO', label: 'Estoque em Terceiros' },
            { value: 'OUTRO', label: 'Outro' },
          ],
        },
        empresa: {
          label: 'Empresa',
          required: true,
          type: 'number',
        },
        filial: {
          label: 'Filial',
          type: 'number',
        },
        logradouro: {
          label: 'Logradouro',
          required: true,
          type: 'text',
        },
        numero: {
          label: 'Número',
          required: true,
          type: 'text',
        },
        letra: {
          label: 'Letra',
          type: 'text',
        },
        complemento: {
          label: 'Complemento',
          type: 'text',
        },
        bairro: {
          label: 'Bairro',
          required: true,
          type: 'text',
        },
        cidade: {
          label: 'Cidade',
          required: true,
          type: 'text',
        },
        estado: {
          label: 'Estado',
          required: true,
          type: 'select',
          options: ESTADOS.map(estado => ({ value: estado.sigla, label: `${estado.sigla} - ${estado.nome}` })),
        },
        cep: {
          label: 'CEP',
          required: true,
          type: 'text',
        },
        permite_entrada: {
          label: 'Permite Entrada',
          type: 'checkbox',
        },
        permite_saida: {
          label: 'Permite Saída',
          type: 'checkbox',
        },
        ativo: {
          label: 'Ativo',
          type: 'checkbox',
        },
      },
    }
  );

  // Campos para visualização
  const fields = [
    { key: 'nome', label: 'Nome' },
    { key: 'codigo', label: 'Código' },
    { 
      key: 'tipo', 
      label: 'Tipo',
      render: (value: string) => {
        const tipos: Record<string, string> = {
          'LOJA': 'Loja',
          'ALMOXARIFADO': 'Almoxarifado',
          'ARMAZEM': 'Armazém',
          'CENTRO_DISTRIBUICAO': 'Centro de Distribuição',
          'ESTOQUE_TERCEIRO': 'Estoque em Terceiros',
          'OUTRO': 'Outro',
        };
        return tipos[value] || value;
      },
    },
    { key: 'empresa_nome', label: 'Empresa' },
    { key: 'filial_nome', label: 'Filial', render: (value: string | null) => value || '-' },
    { key: 'endereco_completo', label: 'Endereço Completo' },
    { key: 'permite_entrada', label: 'Permite Entrada', render: (value: boolean) => value ? 'Sim' : 'Não' },
    { key: 'permite_saida', label: 'Permite Saída', render: (value: boolean) => value ? 'Sim' : 'Não' },
    { key: 'ativo', label: 'Ativo', render: (value: boolean) => value ? 'Sim' : 'Não' },
  ];

  // Gerar tabs
  const tabs = useMemo(() => {
    const detailTab = {
      id: 'detalhamento',
      label: 'Detalhamento',
      content: (
        <div className="space-y-6">
          {error && (
            <Alert type="error" message={error} onClose={() => {}} dismissible={false} />
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentRecord && fields.map((field) => {
              const value = (currentRecord as Record<string, unknown>)[field.key];
              const displayValue = field.render ? field.render(value as never) : (value ?? '-');
              return (
                <div key={field.key} className="border-b border-gray-200 pb-2">
                  <label className="text-sm font-medium text-gray-500">{field.label}</label>
                  <p className="mt-1 text-sm text-gray-900">{String(displayValue)}</p>
                </div>
              );
            })}
            {!currentRecord && (
              <div className="col-span-2 text-center text-gray-500 py-8">
                Carregando dados...
              </div>
            )}
          </div>
        </div>
      ),
    };
    
    return [detailTab];
  }, [currentRecord, fields, error]);

  // Se for novo ou estiver editando, mostrar formulário
  if (id === 'novo' || isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {id === 'novo' ? 'Nova Location' : `Editar Location #${id}`}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {id === 'novo' 
                ? 'Cadastre um novo local físico de armazenamento'
                : 'Edite as informações da location'}
            </p>
          </div>
        </div>

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
              key={id === 'novo' ? 'new' : `edit-${id}`}
              fields={formFields}
              initialData={formDataState !== null ? formDataState : (id === 'novo' ? sampleData : (currentRecord as Record<string, unknown>))}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
              errors={formErrors}
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

  return (
    <DetailView
      title={currentRecord?.nome || `Location #${id}`}
      subtitle={`Código: ${currentRecord?.codigo || id}`}
      tabs={tabs}
      onEdit={() => setIsEditing(true)}
      onDelete={() => handleDeleteRecord(id!)}
      onBack={() => navigate('/estoque/locations')}
      loading={loading}
      error={error}
    />
  );
}

export default LocationsDetail;

