import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchErrorLog, fetchErrorById, clearErrorLog, type ErrorLogEntry } from '../../utils/errorLogger';
import { SmartGrid, type SmartColumn } from '../../components/common/SmartGrid';
import BaseListPage from '../../components/common/BaseListPage';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';
import {
  loadGridListPage,
  loadGridPreferences,
  normalizeGridPageSize,
  type GridPageSize,
} from '../../utils/gridPreferences';

const ERROR_LOG_GRID_ID = 'error-logs';

const fmtDatetime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—';

// ── Colunas do SmartGrid ─────────────────────────────────────────────────────
const COLUMNS: SmartColumn<ErrorLogEntry>[] = [
  {
    key: 'timestamp',
    label: 'Data / Hora',
    width: 160,
    sortable: true,
    filterable: true,
    required: true,
    render: (v) => (
      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
        {fmtDatetime(v as string)}
      </span>
    ),
  },
  {
    key: 'context',
    label: 'Contexto',
    width: 160,
    sortable: true,
    filterable: true,
    render: (v) =>
      v ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {String(v)}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
  {
    key: 'friendly_message',
    label: 'Mensagem',
    sortable: true,
    filterable: true,
    required: true,
    render: (v) => (
      <span className="text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{String(v)}</span>
    ),
  },
  {
    key: 'url',
    label: 'Tela',
    width: 200,
    sortable: true,
    filterable: true,
    render: (v) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v ? String(v) : '—'}</span>
    ),
  },
  {
    key: 'technical',
    label: 'Detalhe técnico',
    width: 260,
    filterable: true,
    render: (v) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
        {v ? String(v).split('\n')[0] : '—'}
      </span>
    ),
  },
];

// ── Detalhe de um único erro ──────────────────────────────────────────────────
function ErrorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ErrorLogEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchErrorById(id)
      .then(setEntry)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-40">
        <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="max-w-2xl space-y-4">
        <BackBtn onClick={() => navigate('/configuracoes/logs')} />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Registro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <BackBtn onClick={() => navigate('/configuracoes/logs')} />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Detalhe do Erro</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
        <InfoRow label="Ocorreu em" value={fmtDatetime(entry.timestamp)} />
        <InfoRow label="Tela" value={entry.url ?? '—'} />
        {entry.context && <InfoRow label="Contexto" value={entry.context} />}
        <InfoRow label="Mensagem" value={entry.friendly_message} />

        {entry.technical && (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Detalhes técnicos
            </p>
            <pre className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 leading-relaxed">
              {entry.technical}
            </pre>
          </div>
        )}

        <div className="px-5 py-3">
          <p className="text-xs text-slate-400 font-mono">ID: {entry.id}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex gap-4">
      <span className="w-32 flex-shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-100 break-all">{value}</span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Voltar
    </button>
  );
}

// ── Lista de erros (SmartGrid) ────────────────────────────────────────────────
function ErrorLogList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => loadGridListPage(ERROR_LOG_GRID_ID));
  const [pageSize, setPageSize] = useState<GridPageSize>(() =>
    normalizeGridPageSize(loadGridPreferences(ERROR_LOG_GRID_ID)?.pageSize),
  );
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchErrorLog({ page, limit: pageSize });
      setEntries(r.errors);
      setTotal(r.total);
      const maxPage = Math.max(0, Math.ceil(r.total / Math.max(r.limit, 1)) - 1);
      if (page > maxPage) setPage(maxPage);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleClear = async () => {
    if (!window.confirm('Limpar todos os registros de erro?')) return;
    setClearing(true);
    try {
      await clearErrorLog();
      setPage(0);
      setEntries([]);
      setTotal(0);
    } finally {
      setClearing(false);
    }
  };

  return (
    <BaseListPage
      title="Log de Erros"
      description="Erros registrados pelo sistema para este tenant."
      onExport={() => exportRowsToCsv('logs-erro', smartColumnsToCsv(COLUMNS), entries)}
    >
      {total > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {clearing ? 'Limpando…' : 'Limpar tudo'}
          </button>
        </div>
      )}

      <SmartGrid<ErrorLogEntry>
        gridId={ERROR_LOG_GRID_ID}
        columns={COLUMNS}
        data={entries}
        defaultSort={{ key: 'timestamp', dir: 'desc' }}
        loading={loading}
        onRowClick={(row) => navigate(`/configuracoes/logs/${row.id}`)}
        emptyMessage="Nenhum erro registrado."
        serverPagination={{
          total,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(normalizeGridPageSize(n));
            setPage(0);
          },
        }}
      />
    </BaseListPage>
  );
}

// ── Componente principal (roteador interno) ───────────────────────────────────
export function ErrorLogsPage() {
  const { id } = useParams<{ id?: string }>();
  if (id) return <ErrorDetail />;
  return <ErrorLogList />;
}

export default ErrorLogsPage;
