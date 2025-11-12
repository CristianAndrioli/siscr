import { useState } from 'react';
import Button from './Button';
import RelatedRecords from './RelatedRecords';

interface DetailField {
  key: string;
  label: string;
  render?: (value: unknown, record?: unknown) => React.ReactNode;
}

interface RelatedRecordConfig {
  title: string;
  records: unknown[];
  columns: Array<{ key: string; label: string; render?: (value: unknown, record?: unknown) => React.ReactNode }>;
  onRecordClick?: (record: unknown) => void;
  emptyMessage?: string;
}

interface DetailViewProps {
  data?: Record<string, unknown> | null;
  fields?: DetailField[];
  relatedRecords?: RelatedRecordConfig[];
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
}

/**
 * DetailView - Componente para exibir detalhes de um registro
 * Inspirado no Salesforce com abas: Detalhamento e Related
 */
export function DetailView({
  data,
  fields = [],
  relatedRecords = [],
  onEdit,
  onDelete,
  onBack,
  title,
  subtitle,
  loading = false,
  error,
}: DetailViewProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'related'>('details');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-red-500">{error}</p>
        {onBack && (
          <Button onClick={onBack} variant="secondary" className="mt-4">
            Voltar
          </Button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500">Registro não encontrado</p>
        {onBack && (
          <Button onClick={onBack} variant="secondary" className="mt-4">
            Voltar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            {onBack && (
              <Button
                onClick={onBack}
                variant="secondary"
                className="mb-2"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar
              </Button>
            )}
            {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button onClick={onEdit} variant="primary">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </Button>
            )}
            {onDelete && (
              <Button onClick={onDelete} variant="danger">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Detalhamento
          </button>
          {relatedRecords.length > 0 && (
            <button
              onClick={() => setActiveTab('related')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'related'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Relacionados
              {relatedRecords.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {relatedRecords.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="block text-sm font-medium text-gray-500">{field.label}</label>
                <div className="text-sm text-gray-900">
                  {field.render
                    ? field.render(data[field.key], data)
                    : String(data[field.key] ?? '-')}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'related' && (
          <div className="space-y-6">
            {relatedRecords.map((related, index) => (
              <RelatedRecords
                key={index}
                title={related.title}
                records={related.records}
                columns={related.columns}
                onRecordClick={related.onRecordClick}
                emptyMessage={related.emptyMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailView;

