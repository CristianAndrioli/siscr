import { ReactNode } from 'react';

interface PlaceholderServiceProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

/**
 * Componente placeholder para serviços logísticos ainda não implementados
 */
function PlaceholderService({ title, description, icon }: PlaceholderServiceProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>

      {/* Card de Informação */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center py-12">
          {icon && (
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                {icon}
              </div>
            </div>
          )}
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Em Desenvolvimento
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Este serviço está em desenvolvimento e estará disponível em breve.
            Nossa equipe está trabalhando para disponibilizar todas as funcionalidades necessárias.
          </p>
        </div>
      </div>

      {/* Informação Adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Sobre este Serviço
            </h3>
            <p className="text-sm text-blue-800">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceholderService;

