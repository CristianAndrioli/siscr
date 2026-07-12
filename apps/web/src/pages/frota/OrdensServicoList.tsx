import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordensServicoService, type OrdemServico } from '../../services/frota';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';
import BaseListPage from '../../components/common/BaseListPage';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';
import { fmtBRL, fmtDateISO } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  execucao: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  concluido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', execucao: 'Execução', concluido: 'Concluído', cancelado: 'Cancelado' };

const COLUMNS: SmartColumn<OrdemServico>[] = [
  { key: 'turno_data', label: 'Data', width: 110, render: v => fmtDateISO(String(v ?? '')) },
  { key: 'obra_nome', label: 'Obra', width: 180, required: true, render: v => <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{String(v ?? '—')}</span> },
  { key: 'maquina_nome', label: 'Máquina', width: 140, render: v => <span className="text-slate-600 dark:text-slate-300">{String(v ?? '—')}</span> },
  { key: 'operador_nome', label: 'Operador', width: 140 },
  { key: 'horas_trabalhadas', label: 'Horas', width: 80, align: 'right', render: v => <span className="tabular-nums">{v != null ? `${Number(v).toFixed(1)} h` : '—'}</span> },
  { key: 'valor_total', label: 'Valor', width: 110, align: 'right', render: v => v != null ? <span className="font-semibold tabular-nums">{fmtBRL(Number(v))}</span> : <span className="text-slate-400">—</span> },
  { key: 'nota_fiscal_id', label: 'NF', width: 60, align: 'center', render: v => v ? <span title="Faturada" className="text-emerald-500"><svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></span> : <span className="text-slate-300 dark:text-slate-600">—</span> },
  { key: 'status', label: 'Status', width: 110, render: v => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[String(v)] ?? ''}`}>{STATUS_LABEL[String(v)] ?? String(v)}</span> },
];

export function OrdensServicoList() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [applied, setApplied] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await ordensServicoService.list({ busca: applied || undefined, status: statusFiltro || undefined, page, limit: 20 });
      setOrdens(r.ordens); setTotal(r.total);
    } catch { setError('Erro ao carregar ordens.'); }
    finally { setLoading(false); }
  }, [applied, statusFiltro, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta OS?')) return;
    try { await ordensServicoService.delete(id); await load(); }
    catch (err) { const msg = formatApiError(err, 'Erro ao excluir.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  return (
    <BaseListPage
      title="Ordens de Serviço"
      description="Registro de horas trabalhadas por máquina"
      onExport={() => exportRowsToCsv('ordens-servico', smartColumnsToCsv(COLUMNS), ordens)}
    >
      <div className="flex flex-wrap gap-3">
        <form onSubmit={e => { e.preventDefault(); setPage(0); setApplied(busca.trim()); }} className="flex gap-2 flex-1">
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por obra, máquina ou operador..."
            className="flex-1 min-w-48 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Buscar</button>
        </form>
        <select value={statusFiltro} onChange={e => { setStatusFiltro(e.target.value); setPage(0); }}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="execucao">Em execução</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <SmartGrid<OrdemServico>
        gridId="os-frota-list" data={ordens} columns={COLUMNS} defaultSort={{ key: 'turno_data', dir: 'desc' }}
        loading={loading} emptyMessage="Nenhuma OS encontrada."
        onRowClick={o => navigate(`/frota/ordens-servico/${o.id}`)}
        onCreate={() => navigate('/frota/ordens-servico/nova')} createLabel="Nova OS"
        actions={o => <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(o.id)); }} />}
        serverPagination={{ total, page, pageSize: 20, onPageChange: setPage, onPageSizeChange: () => {} }}
      />
    </BaseListPage>
  );
}
export default OrdensServicoList;
