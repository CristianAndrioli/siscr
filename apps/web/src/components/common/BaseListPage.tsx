import { ReactNode } from 'react';
import { icons, Icon } from '../icons';

interface BaseListPageProps {
  title: string;
  description?: string;
  /** Ex.: "NOVO CADASTRO" — só para entidades recém-criadas pelo redesign. */
  badge?: string;
  /** Mostra o banner âmbar "em desenvolvimento" abaixo do header. */
  dev?: boolean;
  /** Se informado, mostra o botão secundário "Exportar" no header. */
  onExport?: () => void;
  children: ReactNode;
}

/**
 * Moldura compartilhada por todas as telas de listagem/cadastro: título +
 * badge opcional + ação Exportar, banner de "em desenvolvimento", e o
 * conteúdo da tela (busca própria da página + `SmartGrid`) como children.
 * Não substitui o `SmartGrid` — ele já resolve toolbar/paginação/colunas.
 */
export default function BaseListPage({ title, description, badge, dev, onExport, children }: BaseListPageProps) {
  return (
    <div className="space-y-5 animate-fade-up">
      {dev && (
        <div
          role="status"
          className="px-4 py-3 rounded-card border border-amber-200 dark:border-amber-800 bg-warn-bg dark:bg-amber-950/40 text-warn-text dark:text-amber-200 text-sm font-medium"
        >
          Funcionalidade em desenvolvimento — os dados exibidos podem ser parciais ou de demonstração.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {badge && (
              <span className="badge bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">{badge}</span>
            )}
          </div>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>

        {onExport && (
          <button type="button" onClick={onExport} className="btn-secondary">
            <Icon d={icons.download} className="w-4 h-4" />
            Exportar
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
