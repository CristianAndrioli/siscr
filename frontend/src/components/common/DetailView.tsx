import { ReactNode } from 'react';
import Tabs, { Tab } from './Tabs';
import Button from './Button';

interface DetailViewProps {
  title: string;
  subtitle?: string;
  tabs: Tab[];
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  showActions?: boolean;
  loading?: boolean;
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
  onEdit,
  onDelete,
  onBack,
  showActions = true,
  loading = false,
}: DetailViewProps) {
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
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
