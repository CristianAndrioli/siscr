import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';
import { ncmCatalogService, type NcmStatusResponse, type NcmSyncPostResponse } from '../../services/faturamentoService';

export function NcmConfigPage() {
  const user = authService.getLocalUser() as { role?: string } | null;
  const isAdmin = user?.role === 'admin';

  const [status, setStatus] = useState<NcmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'classif' | 'brasilapi' | null>(null);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
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

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Falha na sincronização.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/faturamento/nf-venda" className="hover:text-brand-600 dark:hover:text-brand-400">
          ← Faturamento
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tabela NCM</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Catálogo de referência para classificação fiscal (Nomenclatura Comum do Mercosul). Os dados são globais na base —
          uma atualização serve a todo o tenant.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sobre o tamanho (~3 MB JSON)</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          No Cloudflare Workers isso é aceitável: a memória do Worker é ampla para um ficheiro deste tamanho; o tempo de CPU
          vai sobretudo para <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">JSON.parse</code> e para
          gravações em lote no D1. O pedido pode levar alguns segundos — é normal.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fontes</h2>
        <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc pl-5 space-y-2">
          <li>
            <strong>Classif (Siscomex / Receita)</strong> — JSON oficial da tabela vigente. Pode falhar com HTTP 403 em alguns
            ambientes; nesse caso use a segunda opção.
          </li>
          <li>
            <strong>Brasil API</strong> — projeto comunitário,{' '}
            <a
              href="https://brasilapi.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 dark:text-brand-400 underline"
            >
              brasilapi.com.br
            </a>
            , API pública sem chave (consulte os termos no site). Útil como espelho; a referência legal estrita continua sendo
            o Classif / legislação.
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-2 text-sm">
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-200">Itens na base ativa:</span>{' '}
            <span className="tabular-nums">{status?.itemCount ?? 0}</span>
          </p>
          {status?.activeBatchId && (
            <p className="text-xs font-mono text-slate-500 break-all">Batch: {status.activeBatchId}</p>
          )}
        </div>
      )}

      {isAdmin ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('classif', false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-50"
            >
              {busy === 'classif' ? 'A atualizar (Classif)…' : 'Atualizar pelo Classif (oficial)'}
            </button>
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('brasilapi', false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
            >
              {busy === 'brasilapi' ? 'A atualizar (Brasil API)…' : 'Atualizar pela Brasil API (espelho)'}
            </button>
          </div>
          <details className="text-xs text-slate-500 dark:text-slate-400">
            <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">Forçar reimportação (ignora deduplicação por hash)</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null || loading}
                onClick={() => runSync('classif', true)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50"
              >
                Forçar Classif
              </button>
              <button
                type="button"
                disabled={busy !== null || loading}
                onClick={() => runSync('brasilapi', true)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50"
              >
                Forçar Brasil API
              </button>
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          Apenas administradores podem executar a sincronização.
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

      {status && status.recentSyncs.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Últimas sincronizações
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto">
            {status.recentSyncs.map((r) => (
              <div key={r.id} className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono">{r.started_at}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{r.source}</span>
                  <span
                    className={
                      r.status === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : r.status === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                    }
                  >
                    {r.status}
                  </span>
                  {r.row_count != null && <span>{r.row_count} linhas</span>}
                </div>
                {r.message && <p className="text-slate-500 dark:text-slate-500">{r.message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
