/** Texto de ajuda visível ao pairar o ícone (não ocupa espaço fixo no layout). */
export function FieldHelp({ text }: { text: string }) {
  return (
    <span className="relative inline-flex align-middle ml-0.5 group">
      <button
        type="button"
        tabIndex={-1}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-400 cursor-help"
        aria-label={text}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 z-50 hidden w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 bottom-[calc(100%+6px)] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 shadow-lg group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
