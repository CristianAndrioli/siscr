import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { obrasService, type Obra } from '../../services/frota';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';
import BaseListPage from '../../components/common/BaseListPage';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';
import { fmtDateISO } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_STYLE: Record<string, string> = {
  em_andamento: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };

const COLUMNS: SmartColumn<Obra>[] = [
  { key: 'nome', label: 'Obra / Projeto', width: 220, required: true, render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v)}</span> },
  { key: 'cliente_nome', label: 'Cliente', width: 180, render: v => <span className="text-slate-600 dark:text-slate-300">{String(v ?? '—')}</span> },
  { key: 'municipio', label: 'Município', width: 130 },
  { key: 'data_inicio', label: 'Início', width: 110, render: v => fmtDateISO(String(v ?? '')) },
  { key: 'status', label: 'Status', width: 130, render: v => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[String(v)] ?? ''}`}>{STATUS_LABEL[String(v)] ?? String(v)}</span> },
];

export function ObrasList() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [obras, setObras] = useState<Obra[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [applied, setApplied] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await obrasService.list({ busca: applied || undefined, page, limit: 20 }); setObras(r.obras); setTotal(r.total); }
    catch { setError('Erro ao carregar obras.'); }
    finally { setLoading(false); }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Desativar "${nome}"?`)) return;
    try { await obrasService.delete(id); await load(); }
    catch (err) { const msg = formatApiError(err, 'Erro ao remover obra.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  return (
    <BaseListPage
      title="Obras / Projetos"
      description="Projetos e contratos da frota"
      onExport={() => exportRowsToCsv('obras', smartColumnsToCsv(COLUMNS), obras)}
    >
      <form onSubmit={e => { e.preventDefault(); setPage(0); setApplied(busca.trim()); }} className="flex gap-2">
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou município..."
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Buscar</button>
      </form>
      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <SmartGrid<Obra>
        gridId="obras-list" data={obras} columns={COLUMNS} defaultSort={{ key: 'nome', dir: 'asc' }}
        loading={loading} emptyMessage="Nenhuma obra cadastrada."
        onRowClick={o => navigate(`/frota/obras/${o.id}`)}
        onCreate={() => navigate('/frota/obras/nova')} createLabel="Nova Obra"
        actions={o => <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(o.id), String(o.nome)); }} />}
        serverPagination={{ total, page, pageSize: 20, onPageChange: setPage, onPageSizeChange: () => {} }}
      />
    </BaseListPage>
  );
}
export default ObrasList;
