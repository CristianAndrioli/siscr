import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contasReceberService, type ContaReceber } from '../../services/financeiro';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtDate = (s: string) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export function ContasReceberList() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [busca, setBusca] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await contasReceberService.list(statusFiltro ? { status: statusFiltro } : {});
      setContas(data);
    } catch {
      setError('Erro ao carregar contas a receber.');
    } finally {
      setLoading(false);
    }
  }, [statusFiltro]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      await contasReceberService.delete(id);
      setContas(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Erro ao excluir.');
    }
  };

  const filtered = busca
    ? contas.filter(c =>
        c.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (c.cliente ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : contas;

  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0);
  const totalRecebido = contas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0);
  const totalVencido = contas
    .filter(c => c.status === 'pendente' && c.vencimento < new Date().toISOString().slice(0, 10))
    .reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Contas a Receber</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie os valores a receber</p>
        </div>
        <button
          onClick={() => navigate('/financeiro/contas-receber/novo')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conta
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'A Receber', value: totalPendente, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Recebido', value: totalRecebido, color: 'text-emerald-600 dark:text-emerald-400' },
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou cliente..."
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
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

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <p className="text-sm">Nenhuma conta encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Descrição', 'Cliente', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(conta => {
                  const vencida = conta.status === 'pendente' && conta.vencimento < new Date().toISOString().slice(0, 10);
                  return (
                    <tr
                      key={conta.id}
                      onClick={() => navigate(`/financeiro/contas-receber/${conta.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{conta.descricao}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{conta.cliente || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{fmt(conta.valor)}</td>
                      <td className={`px-4 py-3 ${vencida ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                        {fmtDate(conta.vencimento)}
                        {vencida && <span className="ml-1 text-xs">(vencida)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[conta.status] ?? ''}`}>
                          {STATUS_LABEL[conta.status] ?? conta.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(conta.id); }}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContasReceberList;
