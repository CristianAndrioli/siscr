import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contasPagarService, financeiroService, type ContaPagar } from '../../services/financeiro';
import { fmtBRL as fmt, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';
import BaseListPage from '../../components/common/BaseListPage';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';
import {
  loadGridListPage,
  loadGridPreferences,
  normalizeGridPageSize,
  type GridPageSize,
} from '../../utils/gridPreferences';

const GRID_ID = 'contas-pagar-list';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  parcialmente_pago: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', parcialmente_pago: 'Parc. pago', pago: 'Pago', cancelado: 'Cancelado' };
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS: SmartColumn<ContaPagar>[] = [
  { key: 'codigo', label: '#', width: 70, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{v != null && v !== '' ? String(v) : '—'}</span> },
  { key: 'descricao', label: 'Descrição', width: 220, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'fornecedor', label: 'Fornecedor', width: 180 },
  { key: 'valor', label: 'Valor', width: 120, align: 'right',
    render: v => <span className="font-semibold tabular-nums">{fmt(Number(v ?? 0))}</span> },
  { key: 'vencimento', label: 'Vencimento', width: 120,
    render: (v, row) => {
      const vencida = row.status === 'pendente' && String(v) < today();
      return (
        <span className={vencida ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
          {fmtDate(String(v ?? ''))}
          {vencida && <span className="ml-1 text-xs">(vencida)</span>}
        </span>
      );
    } },
  { key: 'status', label: 'Status', width: 110, filterable: false,
    render: v => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[String(v)] ?? ''}`}>
        {STATUS_LABEL[String(v)] ?? String(v)}
      </span>
    ) },
  { key: 'conciliado', label: 'Conciliado', width: 100, align: 'center', filterable: false,
    render: v => v === 1 || v === '1' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6l3 3 5-5" />
        </svg>
        Sim
      </span>
    ) : (
      <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
    ) },
];

export function ContasPagarList() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => loadGridListPage(GRID_ID));
  const [pageSize, setPageSize] = useState<GridPageSize>(() =>
    normalizeGridPageSize(loadGridPreferences(GRID_ID)?.pageSize),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [resumo, setResumo] = useState<{ pendente: number; pago: number; vencido: number } | null>(null);

  const loadResumo = useCallback(async () => {
    try {
      const d = await financeiroService.dashboard();
      const p = d.pagar as { pendente?: number; pago?: number; vencido?: number };
      setResumo({
        pendente: Number(p.pendente ?? 0),
        pago: Number(p.pago ?? 0),
        vencido: Number(p.vencido ?? 0),
      });
    } catch {
      setResumo(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await contasPagarService.list({
        status: statusFiltro || undefined,
        page,
        limit: pageSize,
      });
      setContas(r.contas);
      setTotal(r.total);
      const maxPage = Math.max(0, Math.ceil(r.total / Math.max(r.limit, 1)) - 1);
      if (page > maxPage) setPage(maxPage);
    } catch {
      setError('Erro ao carregar contas a pagar.');
    } finally {
      setLoading(false);
    }
  }, [statusFiltro, page, pageSize]);

  useEffect(() => {
    loadResumo();
  }, [loadResumo]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      await contasPagarService.delete(id);
      await load();
      await loadResumo();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao excluir conta a pagar.');
      reportError(msg, err, 'Contas a Pagar');
      setError(msg);
    }
  };

  const totalPendente = resumo?.pendente ?? 0;
  const totalPago = resumo?.pago ?? 0;
  const totalVencido = resumo?.vencido ?? 0;

  return (
    <BaseListPage
      title="Contas a Pagar"
      description="Gerencie os valores a pagar"
      onExport={() => exportRowsToCsv('contas-pagar', smartColumnsToCsv(COLUMNS), contas)}
    >
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'A Pagar', value: totalPendente, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Pago', value: totalPago, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Vencido', value: totalVencido, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-3">
        <select
          value={statusFiltro}
          onChange={(e) => {
            setStatusFiltro(e.target.value);
            setPage(0);
          }}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="parcialmente_pago">Parcialmente pago</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <SmartGrid<ContaPagar>
        gridId={GRID_ID}
        data={contas}
        columns={COLUMNS}
        defaultSort={{ key: 'vencimento', dir: 'asc' }}
        loading={loading}
        emptyMessage="Nenhuma conta encontrada."
        onRowClick={c => navigate(`/financeiro/contas-pagar/${c.id}`)}
        onCreate={() => navigate('/financeiro/contas-pagar/novo')}
        createLabel="Nova Conta"
        actions={c => (
          <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(c.id)); }} />
        )}
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

export default ContasPagarList;
