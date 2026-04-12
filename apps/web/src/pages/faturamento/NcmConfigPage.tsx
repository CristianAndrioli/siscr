import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';
import {
  ncmCatalogService,
  type NcmItemRow,
  type NcmStatusResponse,
  type NcmSyncPostResponse,
} from '../../services/faturamentoService';

const PAGE_SIZE = 50;

function labelFonte(source: string): string {
  if (source === 'classif') return 'Classif';
  if (source === 'brasilapi') return 'Brasil API';
  return source;
}

export function NcmConfigPage() {
  const user = authService.getLocalUser() as { role?: string } | null;
  const isAdmin = user?.role === 'admin';

  const [status, setStatus] = useState<NcmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'classif' | 'brasilapi' | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const [gridLoading, setGridLoading] = useState(true);
  const [items, setItems] = useState<NcmItemRow[]>([]);
  const [total, setTotal] = useState(0);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await ncmCatalogService.status();
      setStatus(s);
    } catch {
      setError('Não foi possível carregar o status da tabela NCM.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    setError('');
    try {
      const r = await ncmCatalogService.items({
        q: busca || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch {
      setError('Não foi possível carregar os códigos NCM.');
      setItems([]);
      setTotal(0);
    } finally {
      setGridLoading(false);
    }
  }, [busca, page]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 350);
    return () => clearTimeout(t);
  }, [buscaInput]);

  useEffect(() => {
    setPage(0);
  }, [busca]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const maxPage = total > 0 ? Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) : 0;
  useEffect(() => {
    if (total === 0) return;
    setPage((p) => (p > maxPage ? maxPage : p));
  }, [total, maxPage]);

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const runSync = async (which: 'classif' | 'brasilapi', force: boolean) => {
    if (!isAdmin) return;
    setBusy(which);
    setHint('');
    setError('');
    try {
      const r: NcmSyncPostResponse =
        which === 'classif'
          ? await ncmCatalogService.syncClassif(force)
          : await ncmCatalogService.syncBrasilApi(force);
      setHint(
        r.skipped
          ? r.message
          : `${r.message}${r.meta?.dataUltima ? ` (${r.meta.dataUltima})` : ''}${r.meta?.ato ? ` — ${r.meta.ato}` : ''}`,
      );
      await loadStatus();
      await loadGrid();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Falha na atualização.');
    } finally {
      setBusy(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, maxPage);
  const from = total === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const to = Math.min(total, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/faturamento/nf-venda" className="hover:text-brand-600 dark:hover:text-brand-400">
          ← Faturamento
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Tabela NCM</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          O código NCM classifica mercadorias para emissão de notas fiscais. A lista abaixo é o catálogo disponível para
          consulta e uso nos cadastros.
        </p>
      </div>

      {!loading && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">Códigos carregados:</span>{' '}
          <span className="tabular-nums">{status?.itemCount ?? 0}</span>
        </p>
      )}

      {isAdmin ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Atualize pela fonte oficial (Receita / Siscomex) ou pela Brasil API. A operação pode levar alguns segundos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('classif', false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-50 min-w-[200px]"
            >
              {busy === 'classif' ? `Processando… ${elapsedSec}s` : 'Atualizar pelo Classif (oficial)'}
            </button>
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('brasilapi', false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 min-w-[220px]"
            >
              {busy === 'brasilapi' ? `Processando… ${elapsedSec}s` : 'Atualizar pela Brasil API'}
            </button>
          </div>
          <details className="text-sm text-slate-600 dark:text-slate-400">
            <summary className="cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
              Reimportar tudo (mesmo sem mudança na fonte)
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null || loading}
                onClick={() => runSync('classif', true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
              >
                Forçar Classif
              </button>
              <button
                type="button"
                disabled={busy !== null || loading}
                onClick={() => runSync('brasilapi', true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50"
              >
                Forçar Brasil API
              </button>
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          Apenas administradores podem atualizar o catálogo.
        </p>
      )}

      {hint && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
          {hint}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={buscaInput}
          onChange={(e) => setBuscaInput(e.target.value)}
          placeholder="Buscar por código ou descrição…"
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {total > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {from}–{to} de {total}
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {gridLoading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            {total === 0 ? 'Nenhum código na base. Peça a um administrador para atualizar o catálogo.' : 'Nenhum resultado para a busca.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Código', 'Descrição', 'Vigência'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((row, idx) => (
                  <tr key={`${row.codigo}-${row.vigenciaInicio}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {row.codigo}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100 max-w-xl">{row.descricao}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap tabular-nums">
                      {row.vigenciaInicio} → {row.vigenciaFim}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-500">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= maxPage}
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                >
                  Seguinte
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {status && status.recentSyncs.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Últimas atualizações
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-56 overflow-y-auto">
            {status.recentSyncs.map((r) => (
              <div key={r.id} className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-slate-500">{r.started_at?.replace('T', ' ').slice(0, 19)}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{labelFonte(r.source)}</span>
                  <span
                    className={
                      r.status === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : r.status === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                    }
                  >
                    {r.status === 'ok' ? 'concluída' : r.status === 'error' ? 'erro' : r.status}
                  </span>
                  {r.row_count != null && <span className="tabular-nums">{r.row_count} itens</span>}
                </div>
                {r.message && <p className="text-slate-500">{r.message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
