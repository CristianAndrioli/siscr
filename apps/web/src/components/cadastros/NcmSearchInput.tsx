import { useCallback, useEffect, useRef, useState } from 'react';
import { ncmCatalogService, type NcmItemRow } from '../../services/faturamentoService';

const INPUT_CLS =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

function onlyNcmDigits(s: string) {
  return s.replace(/\D/g, '').slice(0, 8);
}

type Props = {
  value: string;
  onChange: (ncm8: string) => void;
  disabled?: boolean;
};

/**
 * Campo de NCM com busca no catálogo (tabela NCM sincronizada em Configurações).
 * Grava só os 8 dígitos no cadastro; a nota fiscal usa esse valor.
 */
export function NcmSearchInput({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NcmItemRow[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const r = await ncmCatalogService.items({ q: trimmed, limit: 12, page: 0 });
      setRows(r.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (open) void search(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  const pick = (item: NcmItemRow) => {
    const digits = onlyNcmDigits(item.codigo);
    onChange(digits);
    setQuery('');
    setOpen(false);
    setRows([]);
  };

  return (
    <div ref={wrapRef} className="relative space-y-1">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(onlyNcmDigits(e.target.value))}
          placeholder="00000000"
          maxLength={8}
          disabled={disabled}
          className={`${INPUT_CLS} font-mono sm:max-w-[9rem]`}
        />
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Pesquisar descrição ou código no catálogo NCM…"
            disabled={disabled}
            className={INPUT_CLS}
            autoComplete="off"
          />
          {open && (query.trim().length >= 2 || loading) && (
            <div className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
              {loading && (
                <div className="px-3 py-2 text-xs text-slate-500">A pesquisar…</div>
              )}
              {!loading && rows.length === 0 && query.trim().length >= 2 && (
                <div className="px-3 py-2 text-xs text-slate-500">Nenhum resultado. Ajuste o termo ou sincronize a tabela NCM em Faturamento.</div>
              )}
              {!loading &&
                rows.map((r) => (
                  <button
                    key={`${r.codigo}-${r.vigenciaInicio}`}
                    type="button"
                    className="flex w-full flex-col gap-0.5 border-b border-slate-100 dark:border-slate-700 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/80"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r)}
                  >
                    <span className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                      {onlyNcmDigits(r.codigo)}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">{r.descricao}</span>
                    <span className="text-[10px] text-slate-400">
                      Vig. {r.vigenciaInicioBr} a {r.vigenciaFimBr}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Dica: pode digitar os 8 dígitos à esquerda ou pesquisar à direita; ao escolher uma linha, o código é preenchido automaticamente.
      </p>
    </div>
  );
}
