import { Link } from 'react-router-dom';
import { icons, Icon } from '../icons';
import { HUB_MODULES } from '../../config/hubConfig';
import { useUserPreferences } from '../../hooks/useUserPreferences';

const BADGE_CLS: Record<'NOVO' | 'DEV', string> = {
  NOVO: 'bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300',
  DEV: 'bg-amber-100 dark:bg-[#3a3323] text-amber-800 dark:text-[#e8a33d]',
};

/**
 * Tela-hub genérica: cada módulo da sidebar abre aqui antes de entrar na
 * tela do componente (breadcrumb, ícone, grupos de tiles). Dirigida pela
 * config declarativa em `config/hubConfig.ts` — não crie uma página por
 * módulo, adicione a entrada no config.
 */
export default function ModuleHub({ moduleKey }: { moduleKey: string }) {
  const mod = HUB_MODULES[moduleKey];
  const { trackRecentItem } = useUserPreferences();

  if (!mod) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Módulo não encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-start gap-4">
        <div className="w-[46px] h-[46px] rounded-tile bg-[rgb(var(--tint-rgb)/0.12)] dark:bg-[rgb(var(--tint-rgb)/0.16)] text-brand-600 dark:text-brand-400 flex items-center justify-center flex-none">
          <Icon d={icons[mod.icon]} className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">{mod.label}</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{mod.description}</p>
        </div>
      </div>

      {mod.groups.map(group => (
        <div key={group.title}>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3">
            {group.title}
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {group.items.map((item, idx) => (
              <Link
                key={`${item.to}-${item.label}-${idx}`}
                to={item.to}
                onClick={() => trackRecentItem({ label: `${mod.label} — ${item.label}`, to: item.to, icon: mod.icon })}
                className="group flex items-start gap-3 p-4 rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400 dark:hover:border-brand-500 transition-colors"
              >
                <div className="w-[34px] h-[34px] rounded-lg bg-[rgb(var(--tint-rgb)/0.12)] dark:bg-[rgb(var(--tint-rgb)/0.16)] text-brand-600 dark:text-brand-400 flex items-center justify-center flex-none">
                  <Icon d={icons[mod.icon]} className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.label}</p>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-none ${BADGE_CLS[item.badge]}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
