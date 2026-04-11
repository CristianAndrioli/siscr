import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contasPagarService, type ContaPagar } from '../../services/financeiro';
import { fmtBRL as fmt, fmtDate } from '../../utils/format';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', cancelado: 'Cancelado' };
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS: SmartColumn<ContaPagar>[] = [
  { key: 'codigo', label: '#', width: 70, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{v ?? '—'}</span> },
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
];

export function ContasPagarList() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await contasPagarService.list(statusFiltro ? { status: statusFiltro } : {});
      setContas(data);
    } catch {
      setError('Erro ao carregar contas a pagar.');
    } finally {
      setLoading(false);
    }
  }, [statusFiltro]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      await contasPagarService.delete(id);
      setContas(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Erro ao excluir.');
    }
  };

  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0);
  const totalPago = contas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas.filter(c => c.status === 'pendente' && c.vencimento < today()).reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Contas a Pagar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie os valores a pagar</p>
        </div>
      </div>

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
          onChange={e => setStatusFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <SmartGrid<ContaPagar>
        gridId="contas-pagar-list"
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
      />
    </div>
  );
}

export default ContasPagarList;
