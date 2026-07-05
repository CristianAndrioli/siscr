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

    const currentTabExists = tabs.some(tab => tab.id === activeTab);
    if (!currentTabExists || !activeTab) {
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
      {/* Cabeçalho das abas — rolável no mobile */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <nav className="-mb-px flex gap-6 whitespace-nowrap" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-t
                  ${
                    isActive
                      ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`py-0.5 px-2 text-xs font-semibold rounded-full ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
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
