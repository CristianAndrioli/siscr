import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { maquinasService, type Maquina } from '../../services/frota';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_STYLE: Record<string, string> = {
  operacional: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  manutencao: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  inativa: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { operacional: 'Operacional', manutencao: 'Manutenção', inativa: 'Inativa' };

const COLUMNS: SmartColumn<Maquina>[] = [
  { key: 'nome', label: 'Máquina', width: 200, required: true, render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v)}</span> },
  { key: 'modelo', label: 'Modelo', width: 130, render: v => <span className="text-slate-600 dark:text-slate-300">{String(v ?? '—')}</span> },
  { key: 'placa', label: 'Placa', width: 100, render: v => <span className="font-mono text-xs">{String(v ?? '—')}</span> },
  { key: 'horimetro_atual', label: 'Horímetro', width: 110, align: 'right', render: v => <span className="tabular-nums">{Number(v ?? 0).toFixed(1)} h</span> },
  { key: 'status', label: 'Status', width: 120, render: v => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[String(v)] ?? ''}`}>
      {STATUS_LABEL[String(v)] ?? String(v)}
    </span>
  )},
];

export function MaquinasList() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [applied, setApplied] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await maquinasService.list({ busca: applied || undefined, page, limit: 20 });
      setMaquinas(r.maquinas); setTotal(r.total);
    } catch { setError('Erro ao carregar máquinas.'); }
    finally { setLoading(false); }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja desativar "${nome}"?`)) return;
    try { await maquinasService.delete(id); await load(); }
    catch (err) { const msg = formatApiError(err, 'Erro ao remover máquina.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Máquinas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Equipamentos e veículos da frota</p>
        </div>
      </div>
      <form onSubmit={e => { e.preventDefault(); setPage(0); setApplied(busca.trim()); }} className="flex gap-2">
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, modelo ou placa..."
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Buscar</button>
      </form>
      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      <SmartGrid<Maquina>
        gridId="maquinas-list" data={maquinas} columns={COLUMNS} defaultSort={{ key: 'nome', dir: 'asc' }}
        loading={loading} emptyMessage="Nenhuma máquina cadastrada."
        onRowClick={m => navigate(`/frota/maquinas/${m.id}`)}
        onCreate={() => navigate('/frota/maquinas/nova')} createLabel="Nova Máquina"
        actions={m => <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(m.id), String(m.nome)); }} />}
        serverPagination={{ total, page, pageSize: 20, onPageChange: setPage, onPageSizeChange: () => {} }}
      />
    </div>
  );
}
export default MaquinasList;
