import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getErrorLog,
  clearErrorLog,
  getErrorById,
  type ErrorLogEntry,
} from '../../utils/errorLogger';

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

// ── Detalhe de um único erro ──────────────────────────────────────────────────
function ErrorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ErrorLogEntry | null>(null);

  useEffect(() => {
    if (id) setEntry(getErrorById(id) ?? null);
  }, [id]);

  if (!entry) {
    return (
      <div className="max-w-2xl space-y-4">
        <button onClick={() => navigate('/configuracoes/logs')}
          className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800">
          ← Voltar para logs
        </button>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Registro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/configuracoes/logs')}
          className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400">
          ← Voltar
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Detalhe do Erro</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
        <Row label="Ocorreu em" value={fmtDate(entry.timestamp)} />
        <Row label="Tela" value={entry.url} />
        {entry.context && <Row label="Contexto" value={entry.context} />}
        <Row label="Mensagem exibida" value={entry.friendlyMessage} />
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Detalhes técnicos
          </p>
          <pre className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 leading-relaxed">
            {entry.technical || '(sem detalhes adicionais)'}
          </pre>
        </div>
        <div className="px-5 py-3">
          <p className="text-xs text-slate-400 font-mono">ID: {entry.id}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex gap-4">
      <span className="w-36 flex-shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-100 break-all">{value}</span>
    </div>
  );
}

// ── Lista de erros ────────────────────────────────────────────────────────────
export function ErrorLogsPage() {
  const { id } = useParams<{ id?: string }>();

  if (id) return <ErrorDetail />;
  return <ErrorLogList />;
}

function ErrorLogList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);

  const reload = () => setEntries(getErrorLog());

  useEffect(() => { reload(); }, []);

  const handleClear = () => {
    if (!window.confirm('Limpar todos os registros de erro?')) return;
    clearErrorLog();
    reload();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Log de Erros</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Registros dos erros ocorridos neste navegador.
          </p>
        </div>
        {entries.length > 0 && (
          <button onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpar tudo
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <svg className="mx-auto w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nenhum erro registrado.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Os erros aparecerão aqui quando ocorrerem.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/configuracoes/logs/${e.id}`)}
              className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {e.friendlyMessage}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(e.timestamp)}</span>
                    {e.context && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">· {e.context}</span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">· {e.url}</span>
                  </div>
                  {e.technical && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                      {e.technical.split('\n')[0]}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Exibindo os {entries.length} registros mais recentes. Armazenados localmente neste navegador.
        </p>
      )}
    </div>
  );
}

export default ErrorLogsPage;
