import { useState, useEffect, useCallback } from 'react';
import { transferenciasService, estoqueService, locaisService, type Transferencia } from '../../services/estoqueService';

const fmtQtd = (v: number) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

interface Produto { id: string; descricao: string; codigo: string; }

export function Transferencias() {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [locais, setLocais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form, setForm] = useState({ produtoId: '', localOrigem: '', localDestino: '', quantidade: '', motivo: '' });

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

  useEffect(() => {
    if (showModal && produtos.length === 0) {
      import('../../services/api').then(({ default: api }) => {
        api.get('/tenant/cadastros/produtos').then(res => {
          setProdutos(res.data.produtos ?? []);
        }).catch(() => {});
      });
    }
  }, [showModal, produtos.length]);

  const handleSave = async () => {
    if (!form.produtoId) { setModalError('Selecione o produto.'); return; }
    if (!form.localOrigem) { setModalError('Informe o local de origem.'); return; }
    if (!form.localDestino) { setModalError('Informe o local de destino.'); return; }
    if (form.localOrigem.toUpperCase() === form.localDestino.toUpperCase()) { setModalError('Origem e destino devem ser diferentes.'); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { setModalError('Informe uma quantidade positiva.'); return; }

    setSaving(true);
    setModalError('');
    try {
      await transferenciasService.create({
        produtoId: form.produtoId,
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
    t.codigo?.toLowerCase().includes(busca.toLowerCase()) ||
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
          onClick={() => setShowModal(true)}
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
                  {['Produto', 'Origem', '', 'Destino', 'Qtd.', 'Motivo', 'Data'].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{t.produto || '—'}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.codigo}</div>
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
                <select value={form.produtoId} onChange={e => setForm(p => ({ ...p, produtoId: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Selecione o produto...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao} ({p.codigo})</option>)}
                </select>
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
