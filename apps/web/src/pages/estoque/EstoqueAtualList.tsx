import { useState, useEffect, useCallback } from 'react';
import { estoqueService, type ItemEstoque } from '../../services/estoqueService';

const fmtQtd = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

const TIPO_COLOR: Record<string, string> = {
  GERAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ALMOXARIFADO: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  LOJA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ARMAZEM: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  DEPOSITO: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  EXTERNO: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

export function EstoqueAtualList() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [locationFiltro, setLocationFiltro] = useState('');

  const locaisDisponiveis = [...new Set(itens.map(i => i.location))].sort();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await estoqueService.posicao();
      setItens(data);
    } catch {
      setError('Erro ao carregar posição de estoque.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = itens.filter(i => {
    const matchBusca = !busca || i.produto?.toLowerCase().includes(busca.toLowerCase()) || i.codigo?.toLowerCase().includes(busca.toLowerCase());
    const matchLocal = !locationFiltro || i.location === locationFiltro;
    return matchBusca && matchLocal;
  });

  const totalItens = filtered.length;
  const totalZerado = filtered.filter(i => i.quantidade <= 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Posição Atual</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saldo de estoque por produto e local</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Produtos com saldo</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{totalItens - totalZerado}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Locais</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{locaisDisponiveis.length}</p>
        </div>
        {totalZerado > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Zerados / Negativos</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{totalZerado}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar produto ou código..."
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={locationFiltro}
          onChange={e => setLocationFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os locais</option>
          {locaisDisponiveis.map(l => <option key={l} value={l}>{l}</option>)}
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
          <div className="text-center py-16">
            <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhum item de estoque encontrado.</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Registre uma entrada em Movimentações para iniciar o controle.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Produto', 'Código', 'Local', 'Unidade', 'Quantidade', 'Atualizado'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{item.produto || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{item.codigo || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TIPO_COLOR[item.location] ?? TIPO_COLOR.GERAL}`}>
                        {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{item.unidade || 'UN'}</td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${item.quantidade <= 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {fmtQtd(item.quantidade)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default EstoqueAtualList;
