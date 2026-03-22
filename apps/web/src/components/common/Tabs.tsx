import { ReactNode, useState, useEffect } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  count?: number; // Opcional: número de itens na aba (ex: "Relacionados (5)")
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

/**
 * Componente de abas estilo Salesforce
 */
export default function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(() => {
    if (defaultTab) return defaultTab;
    if (tabs && tabs.length > 0 && tabs[0]) return tabs[0].id;
    return '';
  });

  // Atualizar aba ativa quando as tabs mudarem (ex: quando dados são carregados)
  useEffect(() => {
    if (!tabs || tabs.length === 0) return;
    
    // Se a aba atual não existe mais nas tabs, ou se activeTab está vazio, definir a primeira aba
    const currentTabExists = tabs.some(tab => tab.id === activeTab);
    if (!currentTabExists || !activeTab) {
      // Priorizar defaultTab, senão usar a primeira aba disponível
      const tabToActivate = defaultTab && tabs.some(tab => tab.id === defaultTab)
        ? defaultTab
        : tabs[0]?.id;
      
      if (tabToActivate) {
        setActiveTab(tabToActivate);
      }
    }
  }, [tabs, defaultTab, activeTab]);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {/* Cabeçalho das abas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 py-0.5 px-2 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="mt-6">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}

