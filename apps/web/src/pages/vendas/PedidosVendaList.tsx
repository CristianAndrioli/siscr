import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendasService, STATUS_LABEL, type PedidoListItem, type PedidoStatus, type PedidoTipo } from '../../services/vendas';
import { fmtBRL } from '../../utils/format';
import BaseListPage from '../../components/common/BaseListPage';
import SmartGrid, { type SmartColumn } from '../../components/common/SmartGrid';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';

const STATUS_CLS: Record<PedidoStatus, string> = {
  rascunho: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  confirmado: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  faturado: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  entregue: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
  cancelado: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300',
};

const GRID_ID = 'pedidos-venda-list';

export default function PedidosVendaList() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<PedidoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<PedidoStatus | ''>('');
  const [tipo, setTipo] = useState<PedidoTipo | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await vendasService.list({
        status: status || undefined,
        tipo: tipo || undefined,
      });
      setPedidos(rows);
    } catch {
      setError('Erro ao carregar pedidos de venda.');
    } finally {
      setLoading(false);
    }
  }, [status, tipo]);

  useEffect(() => { load(); }, [load]);

  const columns: SmartColumn<PedidoListItem>[] = [
    { key: 'numero', label: 'Nº', width: 70, align: 'center', required: true,
      render: v => <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">#{String(v)}</span> },
    { key: 'tipo', label: 'Tipo', width: 100,
      render: v => v === 'orcamento' ? 'Orçamento' : 'Pedido' },
    { key: 'cliente', label: 'Cliente', width: 220, required: true },
    { key: 'status', label: 'Status', width: 130,
      render: v => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLS[v as PedidoStatus]}`}>
          {STATUS_LABEL[v as PedidoStatus]}
        </span>
      ) },
    { key: 'total', label: 'Valor', width: 130, align: 'right',
      render: v => <span className="font-mono text-slate-700 dark:text-slate-200">{fmtBRL(Number(v))}</span> },
    { key: 'created_at', label: 'Criado em', width: 110,
      render: v => new Date(String(v)).toLocaleDateString('pt-BR') },
  ];

  return (
    <BaseListPage
      title="Pedidos de Venda"
      description="Pedidos e orçamentos — do rascunho ao faturamento"
      onExport={() => exportRowsToCsv('pedidos-venda', smartColumnsToCsv(columns), pedidos)}
    >
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={e => setStatus(e.target.value as PedidoStatus | '')} className="input w-auto">
          <option value="">Status: Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value as PedidoTipo | '')} className="input w-auto">
          <option value="">Tipo: Todos</option>
          <option value="pedido">Pedido</option>
          <option value="orcamento">Orçamento</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<PedidoListItem>
        gridId={GRID_ID}
        data={pedidos}
        columns={columns}
        defaultSort={{ key: 'created_at', dir: 'desc' }}
        loading={loading}
        emptyMessage="Nenhum pedido de venda cadastrado."
        onRowClick={p => navigate(`/vendas-crm/pedidos/${p.id}`)}
        onCreate={() => navigate('/vendas-crm/pedidos/novo')}
        createLabel="+ Novo pedido"
      />
    </BaseListPage>
  );
}
