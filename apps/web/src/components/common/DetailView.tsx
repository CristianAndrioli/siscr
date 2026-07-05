import { ReactNode, useMemo } from 'react';
import Tabs, { Tab } from './Tabs';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';

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
  children?: ReactNode;
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
  children,
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
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {fields.map((field) => {
                  const value = data[field.key];
                  const displayValue = field.render ? field.render(value) : (value ?? '—');
                  return (
                    <div key={field.key} className="border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {field.label}
                      </label>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{displayValue}</p>
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
    return <LoadingSpinner fullScreen text="Carregando dados..." />;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card">
      {/* Cabeçalho */}
      <div className="px-5 lg:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {showActions && (
            <div className="flex flex-wrap gap-2 flex-none">
              {children}
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
      <div className="px-5 lg:px-8 py-5">
        <Tabs tabs={generatedTabs} defaultTab="detalhamento" />
      </div>
    </div>
  );
}
