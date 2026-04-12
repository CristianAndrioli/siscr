import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';
import {
  ncmCatalogService,
  type NcmItemRow,
  type NcmStatusResponse,
  type NcmSyncPostResponse,
} from '../../services/faturamentoService';
import SmartGrid, { type SmartColumn } from '../../components/common/SmartGrid';
import { loadGridPreferences, normalizeGridPageSize } from '../../utils/gridPreferences';

function labelFonte(source: string): string {
  if (source === 'classif') return 'Siscomex';
  if (source === 'brasilapi') return 'Brasil API';
  return source;
}

type NcmGridRow = NcmItemRow & { id: string } & Record<string, unknown>;

const NCM_COLUMNS: SmartColumn<NcmGridRow>[] = [
  {
    key: 'codigo',
    label: 'Código',
    width: 110,
    required: true,
    align: 'center',
    render: (v) => (
      <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{String(v ?? '—')}</span>
    ),
  },
  { key: 'descricao', label: 'Descrição', width: 340, required: true },
  {
    key: 'vigenciaInicio',
    label: 'Início vigência',
    width: 130,
    align: 'center',
    render: (_, row) => (
      <span className="tabular-nums text-slate-600 dark:text-slate-300">{row.vigenciaInicioBr}</span>
    ),
  },
  {
    key: 'vigenciaFim',
    label: 'Fim vigência',
    width: 130,
    align: 'center',
    render: (_, row) => (
      <span className="tabular-nums text-slate-600 dark:text-slate-300">{row.vigenciaFimBr}</span>
    ),
  },
];

function toGridRows(items: NcmItemRow[]): NcmGridRow[] {
  return items.map((r) => ({
    ...r,
    id: `${r.codigo}|${r.vigenciaInicio}|${r.vigenciaFim}`,
  })) as NcmGridRow[];
}

const NCM_GRID_ID = 'faturamento-ncm-catalog';

export function NcmConfigPage() {
  const user = authService.getLocalUser() as { role?: string } | null;
  const isAdmin = user?.role === 'admin';

  const [status, setStatus] = useState<NcmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'classif' | 'brasilapi' | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [rowLimit, setRowLimit] = useState(() =>
    normalizeGridPageSize(loadGridPreferences(NCM_GRID_ID)?.pageSize),
  );
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [gridLoading, setGridLoading] = useState(true);
  const [rows, setRows] = useState<NcmGridRow[]>([]);

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
        q: appliedSearch || undefined,
        limit: rowLimit,
        offset: 0,
      });
      setRows(toGridRows(r.items));
      setCatalogTotal(r.total);
    } catch {
      setError('Não foi possível carregar os códigos NCM.');
      setRows([]);
      setCatalogTotal(0);
    } finally {
      setGridLoading(false);
    }
  }, [appliedSearch, rowLimit]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const runSync = async (which: 'classif' | 'brasilapi') => {
    if (!isAdmin) return;
    setBusy(which);
    setHint('');
    setError('');
    try {
      const r: NcmSyncPostResponse =
        which === 'classif'
          ? await ncmCatalogService.syncClassif(true)
          : await ncmCatalogService.syncBrasilApi(true);
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

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">A carregar estado do catálogo…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col lg:flex-row">
          <div className="p-4 lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Códigos carregados</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-1">{status?.itemCount ?? 0}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Últimas atualizações
            </div>
            {status && status.recentSyncs.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-52 overflow-y-auto">
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
            ) : (
              <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Ainda não há histórico de atualizações.</p>
            )}
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cada atualização descarrega a fonte escolhida e repõe o catálogo completo na base. Pode levar alguns segundos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('classif')}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-50 min-w-[200px]"
            >
              {busy === 'classif' ? `Processando… ${elapsedSec}s` : 'Atualizar pelo Siscomex'}
            </button>
            <button
              type="button"
              disabled={busy !== null || loading}
              onClick={() => runSync('brasilapi')}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 min-w-[220px]"
            >
              {busy === 'brasilapi' ? `Processando… ${elapsedSec}s` : 'Atualizar pela Brasil API'}
            </button>
          </div>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search.trim());
        }}
        className="flex gap-2 flex-wrap"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código ou descrição (recarrega a lista no servidor)…"
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Buscar
        </button>
      </form>

      <SmartGrid<NcmGridRow>
        gridId={NCM_GRID_ID}
        data={rows}
        columns={NCM_COLUMNS}
        defaultSort={{ key: 'codigo', dir: 'asc' }}
        loading={gridLoading}
        rowLimit={{ value: rowLimit, onChange: setRowLimit }}
        backendTotalCount={catalogTotal}
        emptyMessage={
          (status?.itemCount ?? 0) === 0
            ? 'Nenhum código na base. Peça a um administrador para atualizar o catálogo.'
            : 'Nenhum registo com estes critérios. Ajuste a busca acima ou os filtros por coluna.'
        }
      />
    </div>
  );
}
