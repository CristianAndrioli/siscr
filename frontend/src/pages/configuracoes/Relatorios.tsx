import { useState } from 'react';
import { Button } from '../../components/common';

/**
 * Página de Configuração de Relatórios
 */
export default function Relatorios() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configuração de Relatórios</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Templates de Relatórios</h2>
              <p className="text-gray-600 text-sm">
                Gerencie templates de relatórios personalizados para o seu tenant
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Em desenvolvimento:</strong> A interface de gerenciamento de templates será implementada em breve.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Funcionalidades Planejadas:</h3>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Lista de templates disponíveis por módulo</li>
                <li>Editor de templates HTML/CSS</li>
                <li>Preview de templates em tempo real</li>
                <li>Configuração de logo e dados da empresa</li>
                <li>Customização por tenant/empresa</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Configurações Gerais</h2>
              <p className="text-gray-600 text-sm">
                Configure logo, dados da empresa e preferências de relatórios
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Em desenvolvimento:</strong> A interface de configurações será implementada em breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

