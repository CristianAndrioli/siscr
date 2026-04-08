import { useState, useEffect, useCallback, useRef } from 'react';
import { transferenciasService, estoqueService, locaisService, type Transferencia } from '../../services/estoqueService';
import api from '../../services/api';

const fmtQtd = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

interface Produto { id: string; descricao: string; codigo: string; unidade: string; }

function ProdutoBusca({ onSelect, resetKey }: { onSelect: (p: Produto | null) => void; resetKey: number }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(''); setSelecionado(null); setResultados([]); setAberto(false); }, [resetKey]);

  const buscar = useCallback(async (termo: string) => {
    if (!termo.trim()) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await api.get('/tenant/cadastros/produtos', { params: { busca: termo } });
      setResultados(res.data.produtos ?? []);
      setAberto(true);
    } catch { setResultados([]); } finally { setBuscando(false); }
  }, []);

  useEffect(() => {
    if (selecionado) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, buscar, selecionado]);

  const selecionar = (p: Produto) => {
    setSelecionado(p); setQuery(`${p.codigo} — ${p.descricao}`);
    setResultados([]); setAberto(false); onSelect(p);
  };

  const limpar = () => {
    setSelecionado(null); setQuery(''); setResultados([]); setAberto(false); onSelect(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelecionado(null); }}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Digite o SKU ou nome do produto..."
          className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 dark:text-slate-100 ${selecionado ? 'border-emerald-400 dark:border-emerald-600' : 'border-slate-300 dark:border-slate-600'}`}
        />
        {buscando && <svg className="absolute right-2.5 w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
        {selecionado && <button type="button" onClick={limpar} className="absolute right-2 text-slate-400 hover:text-slate-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
      </div>
      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {resultados.map(p => (
            <button key={p.id} type="button" onMouseDown={() => selecionar(p)} className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
              <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{p.codigo}</span>
              <span className="ml-2 text-sm text-slate-700 dark:text-slate-200">{p.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Transferencias() {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [locais, setLocais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [form, setForm] = useState({ localOrigem: '', localDestino: '', quantidade: '', motivo: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [transData, estoqueData, locaisData] = await Promise.all([
        transferenciasService.list(),
        estoqueService.posicao(),
        locaisService.list(),
      ]);
      setTransferencias(transData);
      const locaisEstoque = [...new Set(estoqueData.map(i => i.location))];
      const locaisCadastrados = locaisData.map(l => l.nome);
      setLocais([...new Set(['GERAL', ...locaisEstoque, ...locaisCadastrados])].sort());
    } catch {
      setError('Erro ao carregar transferências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    setProdutoSelecionado(null);
    setForm({ localOrigem: '', localDestino: '', quantidade: '', motivo: '' });
    setModalError('');
    setResetKey(k => k + 1);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!produtoSelecionado) { setModalError('Busque e selecione um produto.'); return; }
    if (!form.localOrigem) { setModalError('Informe o local de origem.'); return; }
    if (!form.localDestino) { setModalError('Informe o local de destino.'); return; }
    if (form.localOrigem.toUpperCase() === form.localDestino.toUpperCase()) { setModalError('Origem e destino devem ser diferentes.'); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { setModalError('Informe uma quantidade positiva.'); return; }

    setSaving(true);
    setModalError('');
    try {
      await transferenciasService.create({
        produtoId: produtoSelecionado.id,
        localOrigem: form.localOrigem.toUpperCase(),
        localDestino: form.localDestino.toUpperCase(),
        quantidade: Number(form.quantidade),
        motivo: form.motivo || undefined,
      });
      setShowModal(false);
      setForm({ produtoId: '', localOrigem: '', localDestino: '', quantidade: '', motivo: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setModalError(e?.response?.data?.error || 'Erro ao registrar transferência.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = transferencias.filter(t =>
    !busca || t.produto?.toLowerCase().includes(busca.toLowerCase()) ||
    t.produto_codigo?.toLowerCase().includes(busca.toLowerCase()) ||
    t.local_origem?.toLowerCase().includes(busca.toLowerCase()) ||
    t.local_destino?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Transferências</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Movimentação de produtos entre locais</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          Nova Transferência
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar produto, origem ou destino..."
        className="w-full max-w-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

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
            Nenhuma transferência registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['#', 'Produto', 'Origem', '', 'Destino', 'Qtd.', 'Motivo', 'Data'].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{t.codigo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{t.produto || '—'}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.produto_codigo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{t.local_origem || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t.local_destino || '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtQtd(t.quantidade)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[160px] truncate">{t.motivo || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Transferência */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova Transferência</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">O saldo será debitado da origem e creditado no destino.</p>

            {modalError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Produto <span className="text-red-500">*</span></label>
                <ProdutoBusca resetKey={resetKey} onSelect={p => setProdutoSelecionado(p)} />
                {produtoSelecionado && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ {produtoSelecionado.descricao}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local Origem <span className="text-red-500">*</span></label>
                  <input list="locais-origem" value={form.localOrigem} onChange={e => setForm(p => ({ ...p, localOrigem: e.target.value.toUpperCase() }))}
                    placeholder="Ex: GERAL"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <datalist id="locais-origem">{locais.map(l => <option key={l} value={l} />)}</datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local Destino <span className="text-red-500">*</span></label>
                  <input list="locais-destino" value={form.localDestino} onChange={e => setForm(p => ({ ...p, localDestino: e.target.value.toUpperCase() }))}
                    placeholder="Ex: DEPOSITO"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <datalist id="locais-destino">{locais.map(l => <option key={l} value={l} />)}</datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade <span className="text-red-500">*</span></label>
                <input type="number" min="0.001" step="0.001" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo</label>
                <input type="text" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex.: Reorganização de estoque"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setModalError(''); }} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Transferindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transferencias;
