import { useState, useEffect, useCallback, useRef } from 'react';
import { movimentacoesService, estoqueService, locaisService, type Movimentacao } from '../../services/estoqueService';
import api from '../../services/api';

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

const TIPO_SIGN: Record<string, string> = {
  entrada: '+',
  ajuste: '±',
  transferencia_saida: '−',
  transferencia_entrada: '+',
  saida: '−',
};

interface Produto { id: string; descricao: string; codigo: string; unidade: string; }

// Componente de busca de produto por SKU/nome
function ProdutoBusca({ onSelect }: { onSelect: (p: Produto) => void }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (termo: string) => {
    if (!termo.trim()) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await api.get('/tenant/cadastros/produtos', { params: { busca: termo } });
      setResultados(res.data.produtos ?? []);
      setAberto(true);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    if (selecionado) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, buscar, selecionado]);

  const selecionar = (p: Produto) => {
    setSelecionado(p);
    setQuery(`${p.codigo} — ${p.descricao}`);
    setResultados([]);
    setAberto(false);
    onSelect(p);
  };

  const limpar = () => {
    setSelecionado(null);
    setQuery('');
    setResultados([]);
    setAberto(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelecionado(null); }}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Digite o SKU ou nome do produto..."
          className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 dark:text-slate-100 ${selecionado ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-300 dark:border-slate-600'}`}
        />
        {buscando && (
          <svg className="absolute right-2.5 w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {selecionado && (
          <button type="button" onClick={limpar} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {resultados.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => selecionar(p)}
              className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
            >
              <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{p.codigo}</span>
              <span className="ml-2 text-sm text-slate-700 dark:text-slate-200">{p.descricao}</span>
              <span className="ml-1 text-xs text-slate-400">({p.unidade})</span>
            </button>
          ))}
        </div>
      )}
      {aberto && !buscando && resultados.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          Nenhum produto encontrado para "{query}"
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────

export function MovimentacoesList() {
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [locais, setLocais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [form, setForm] = useState({ tipo: 'entrada' as 'entrada' | 'saida' | 'ajuste', quantidade: '', location: 'GERAL', motivo: '' });
  const [resetKey, setResetKey] = useState(0);

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

  const openModal = () => {
    setProdutoSelecionado(null);
    setForm({ tipo: 'entrada', quantidade: '', location: 'GERAL', motivo: '' });
    setModalError('');
    setResetKey(k => k + 1);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!produtoSelecionado) { setModalError('Busque e selecione um produto.'); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { setModalError('Informe uma quantidade maior que zero.'); return; }
    if (!form.location.trim()) { setModalError('Informe o local.'); return; }
    setSaving(true);
    setModalError('');
    try {
      await movimentacoesService.create({
        produtoId: produtoSelecionado.id,
        tipo: form.tipo,
        quantidade: Number(form.quantidade),
        location: form.location.toUpperCase(),
        motivo: form.motivo || undefined,
      });
      setShowModal(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setModalError(e?.response?.data?.error || 'Erro ao registrar movimentação.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = movs.filter(m => {
    const matchBusca = !busca || m.produto?.toLowerCase().includes(busca.toLowerCase()) || m.produto_codigo?.toLowerCase().includes(busca.toLowerCase());
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
          onClick={openModal}
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
          <div className="text-center py-16">
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Nenhuma movimentação registrada.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Clique em "Nova Movimentação" para registrar a primeira entrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['#', 'Produto', 'Tipo', 'Qtd.', 'Local', 'Motivo', 'Data'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{m.codigo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{m.produto || '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{m.produto_codigo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIPO_STYLE[m.tipo] ?? ''}`}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${m.tipo === 'saida' || m.tipo === 'transferencia_saida' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {TIPO_SIGN[m.tipo]}{fmtQtd(m.quantidade)}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-5">

            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova Movimentação</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Busque o produto pelo SKU ou nome, informe quantidade e local.</p>
            </div>

            {modalError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
            )}

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de movimentação</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['entrada', 'Entrada', 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'],
                  ['saida', 'Saída', 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-700'],
                  ['ajuste', 'Ajuste', 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700'],
                ] as const).map(([val, label, cls]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tipo: val }))}
                    className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${form.tipo === val ? cls : 'border-transparent bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Produto */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Produto <span className="text-red-500">*</span>
              </label>
              <ProdutoBusca key={resetKey} onSelect={setProdutoSelecionado} />
              {produtoSelecionado && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ {produtoSelecionado.descricao} — unidade: {produtoSelecionado.unidade}
                </p>
              )}
            </div>

            {/* Quantidade + Local */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantidade}
                  onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))}
                  placeholder="Ex: 10"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Local <span className="text-red-500">*</span>
                </label>
                <input
                  list="locais-mov"
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value.toUpperCase() }))}
                  placeholder="GERAL"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <datalist id="locais-mov">
                  {locais.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Motivo / Referência</label>
              <input
                type="text"
                value={form.motivo}
                onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Ex: Compra NF 001, Inventário Jan/2026..."
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
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
