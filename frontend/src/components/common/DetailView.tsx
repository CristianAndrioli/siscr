import { ReactNode, useMemo } from 'react';
import Tabs, { Tab } from './Tabs';
import Button from './Button';

interface Field {
  key: string;
  label: string;
  render?: (value: unknown) => ReactNode;
}

interface DetailViewProps {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  fields?: Field[];
  data?: Record<string, unknown>;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  showActions?: boolean;
  loading?: boolean;
  error?: string;
}

/**
 * Componente para exibir detalhes de um registro com abas estilo Salesforce
 * Aba "Detalhamento" mostra os campos do objeto
 * Aba "Relacionados" mostra os objetos relacionados
 */
export default function DetailView({
  title,
  subtitle,
  tabs,
  fields,
  data,
  onEdit,
  onDelete,
  onBack,
  showActions = true,
  loading = false,
  error,
}: DetailViewProps) {
  // Gerar tabs automaticamente se fields e data forem fornecidos
  const generatedTabs = useMemo(() => {
    if (tabs) {
      return tabs;
    }
    
    if (fields && data) {
      return [
        {
          id: 'detalhamento',
          label: 'Detalhamento',
          content: (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map((field) => {
                  const value = data[field.key];
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
        },
      ];
    }
    
    return [];
  }, [tabs, fields, data, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-2xl transition-all duration-300">
      {/* Cabeçalho */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          {showActions && (
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="primary" onClick={onEdit}>
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button variant="danger" onClick={onDelete}>
                  Excluir
                </Button>
              )}
              {onBack && (
                <Button variant="secondary" onClick={onBack}>
                  Voltar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="px-8 py-6">
        <Tabs tabs={generatedTabs} defaultTab="detalhamento" />
      </div>
    </div>
  );
}
