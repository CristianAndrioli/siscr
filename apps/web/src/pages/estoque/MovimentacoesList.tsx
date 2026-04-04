import { useState, useEffect, useCallback } from 'react';
import { movimentacoesService, estoqueService, locaisService, type Movimentacao } from '../../services/estoqueService';

const fmtQtd = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

const TIPO_STYLE: Record<string, string> = {
  entrada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  saida: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  ajuste: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  transferencia_saida: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  transferencia_entrada: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
};

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  transferencia_saida: 'Transf. Saída',
  transferencia_entrada: 'Transf. Entrada',
};

interface Produto { id: string; descricao: string; codigo: string; }

export function MovimentacoesList() {
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [locais, setLocais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form, setForm] = useState({ produtoId: '', tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', quantidade: '', location: 'GERAL', motivo: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [movsData, estoqueData, locaisData] = await Promise.all([
        movimentacoesService.list(tipoFiltro ? { tipo: tipoFiltro } : {}),
        estoqueService.posicao(),
        locaisService.list(),
      ]);
      setMovs(movsData);
      const locaisEstoque = [...new Set(estoqueData.map(i => i.location))];
      const locaisCadastrados = locaisData.map(l => l.nome);
      setLocais([...new Set(['GERAL', ...locaisEstoque, ...locaisCadastrados])].sort());
    } catch {
      setError('Erro ao carregar movimentações.');
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal && produtos.length === 0) {
      pessoasService.list().catch(() => {});
      // Carrega produtos via API diretamente
      import('../../services/api').then(({ default: api }) => {
        api.get('/tenant/cadastros/produtos').then(res => {
          setProdutos(res.data.produtos ?? []);
        }).catch(() => {});
      });
    }
  }, [showModal, produtos.length]);

  const handleSave = async () => {
    if (!form.produtoId) { setModalError('Selecione o produto.'); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { setModalError('Informe uma quantidade positiva.'); return; }
    if (!form.location) { setModalError('Informe o local.'); return; }
    setSaving(true);
    setModalError('');
    try {
      await movimentacoesService.create({
        produtoId: form.produtoId,
        tipo: form.tipo,
        quantidade: Number(form.quantidade),
        location: form.location.toUpperCase(),
        motivo: form.motivo || undefined,
      });
      setShowModal(false);
      setForm({ produtoId: '', tipo: 'entrada', quantidade: '', location: 'GERAL', motivo: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setModalError(e?.response?.data?.error || 'Erro ao registrar movimentação.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = movs.filter(m => {
    const matchBusca = !busca || m.produto?.toLowerCase().includes(busca.toLowerCase()) || m.codigo?.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = !tipoFiltro || m.tipo === tipoFiltro;
    return matchBusca && matchTipo;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Movimentações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Entradas, saídas e ajustes de estoque</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Movimentação
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar produto ou código..."
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="ajuste">Ajuste</option>
          <option value="transferencia_saida">Transf. Saída</option>
          <option value="transferencia_entrada">Transf. Entrada</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            Nenhuma movimentação registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Produto', 'Tipo', 'Qtd.', 'Local', 'Motivo', 'Data'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{m.produto || '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{m.codigo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIPO_STYLE[m.tipo] ?? ''}`}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${m.tipo === 'saida' || m.tipo === 'transferencia_saida' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {m.tipo === 'saida' || m.tipo === 'transferencia_saida' ? '-' : '+'}{fmtQtd(m.quantidade)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{m.location}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate">{m.motivo || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Movimentação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova Movimentação</h2>

            {modalError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {([['entrada', 'Entrada', 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-700'], ['saida', 'Saída', 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700'], ['ajuste', 'Ajuste', 'text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700']] as const).map(([val, label, cls]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: val }))}
                      className={`py-2 rounded-lg border text-sm font-semibold transition-colors ${form.tipo === val ? cls : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Produto <span className="text-red-500">*</span></label>
                <select value={form.produtoId} onChange={e => setForm(p => ({ ...p, produtoId: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Selecione o produto...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao} ({p.codigo})</option>)}
                </select>
                {produtos.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Nenhum produto cadastrado. <a href="/cadastros/produtos/novo" className="underline">Cadastrar produto</a></p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade <span className="text-red-500">*</span></label>
                  <input type="number" min="0.001" step="0.001" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local <span className="text-red-500">*</span></label>
                  <input list="locais-list" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value.toUpperCase() }))}
                    placeholder="GERAL"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <datalist id="locais-list">
                    {locais.map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo / Observação</label>
                <input type="text" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex.: Compra NF 123, Ajuste de inventário..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setModalError(''); }} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MovimentacoesList;
