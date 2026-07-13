import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprasService, STATUS_LABEL, type PedidoCompraListItem, type PedidoCompraStatus } from '../../services/compras';
import { fmtBRL } from '../../utils/format';
import BaseListPage from '../../components/common/BaseListPage';
import SmartGrid, { type SmartColumn } from '../../components/common/SmartGrid';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';

const STATUS_CLS: Record<PedidoCompraStatus, string> = {
  rascunho: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  confirmado: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  recebido_parcial: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  recebido: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
};

const GRID_ID = 'pedidos-compra-list';

export default function PedidosCompraList() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<PedidoCompraListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<PedidoCompraStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await comprasService.list({ status: status || undefined });
      setPedidos(rows);
    } catch {
      setError('Erro ao carregar pedidos de compra.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const columns: SmartColumn<PedidoCompraListItem>[] = [
    { key: 'numero', label: 'Nº', width: 70, align: 'center', required: true,
      render: v => <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">#{String(v)}</span> },
    { key: 'fornecedor', label: 'Fornecedor', width: 220, required: true },
    { key: 'status', label: 'Status', width: 160,
      render: v => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLS[v as PedidoCompraStatus]}`}>
          {STATUS_LABEL[v as PedidoCompraStatus]}
        </span>
      ) },
    { key: 'total', label: 'Valor', width: 130, align: 'right',
      render: v => <span className="font-mono text-slate-700 dark:text-slate-200">{fmtBRL(Number(v))}</span> },
    { key: 'created_at', label: 'Criado em', width: 110,
      render: v => new Date(String(v)).toLocaleDateString('pt-BR') },
  ];

  return (
    <BaseListPage
      title="Pedidos de Compra"
      description="Pedidos ao fornecedor — do rascunho ao recebimento"
      badge="NOVO"
      onExport={() => exportRowsToCsv('pedidos-compra', smartColumnsToCsv(columns), pedidos)}
    >
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={e => setStatus(e.target.value as PedidoCompraStatus | '')} className="input w-auto">
          <option value="">Status: Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<PedidoCompraListItem>
        gridId={GRID_ID}
        data={pedidos}
        columns={columns}
        defaultSort={{ key: 'created_at', dir: 'desc' }}
        loading={loading}
        emptyMessage="Nenhum pedido de compra cadastrado."
        onRowClick={p => navigate(`/compras/pedidos/${p.id}`)}
        onCreate={() => navigate('/compras/pedidos/novo')}
        createLabel="+ Novo pedido"
      />
    </BaseListPage>
  );
}
