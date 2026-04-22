import { useState, useEffect, useCallback } from 'react';
import { cotacoesService, type Cotacao, type CotacaoItem, type CotacaoStatus } from '../../services/faturamentoService';
import { PessoaBusca } from '../../components/PessoaBusca';
import api from '../../services/api';

import { fmtBRL } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import CurrencyInput from '../../components/common/CurrencyInput';
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

const STATUS_STYLE: Record<CotacaoStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  enviada: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  aprovada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  recusada: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  expirada: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};
const STATUS_LABEL: Record<CotacaoStatus, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', aprovada: 'Aprovada', recusada: 'Recusada', expirada: 'Expirada',
};

interface Produto { id: string; descricao: string; codigo: string; unidade: string; preco_venda: number; }

const emptyItem = (): CotacaoItem => ({ descricao: '', quantidade: 1, valorUnitario: 0, desconto: 0, unidade: 'UN' });

export function CotacoesPage() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pessoaId, setPessoaId] = useState('');
  const [pessoaNome, setPessoaNome] = useState('');
  const [form, setForm] = useState({
    validade: '', observacoes: '', desconto: 0,
    status: 'rascunho' as CotacaoStatus,
    itens: [emptyItem()],
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setCotacoes(await cotacoesService.list()); }
    catch { setError('Erro ao carregar cotações.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal && produtos.length === 0) {
      api
        .get('/tenant/cadastros/produtos', { params: { limit: 200, page: 0 } })
        .then((r) => setProdutos(r.data.produtos ?? []))
        .catch(() => {});
    }
  }, [showModal, produtos.length]);

  const openNew = () => {
    setForm({ validade: '', observacoes: '', desconto: 0, status: 'rascunho', itens: [emptyItem()] });
    setPessoaId(''); setPessoaNome('');
    setEditingId(null); setModalError(''); setShowModal(true);
  };

  const openEdit = async (id: string) => {
    try {
      const c = await cotacoesService.get(id);
      setForm({
        validade: c.validade ?? '',
        observacoes: c.observacoes ?? '',
        desconto: c.desconto,
        status: c.status,
        itens: (c.itens && c.itens.length > 0)
          ? c.itens.map(i => ({ ...i, valorUnitario: i.valorUnitario ?? 0, desconto: i.desconto ?? 0 }))
          : [emptyItem()],
      });
      setPessoaId(c.pessoa_id ?? '');
      setPessoaNome(c.cliente ?? '');
      setEditingId(id); setModalError(''); setShowModal(true);
    } catch { setError('Erro ao carregar cotação.'); }
  };

  const handleSave = async () => {
    const validItens = form.itens.filter(i => i.descricao.trim());
    if (validItens.length === 0) { setModalError('Adicione pelo menos um item.'); return; }
    setSaving(true); setModalError('');
    try {
      const payload = {
        pessoa_id: pessoaId || undefined, // nunca envia string vazia
        validade: form.validade || undefined,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        status: form.status,
        itens: validItens,
      };
      if (editingId) await cotacoesService.update(editingId, payload as any);
      else await cotacoesService.create(payload as any);
      setShowModal(false); load();
    } catch (err: unknown) {
      setModalError(formatApiError(err, 'Erro ao salvar cotação.'));
    } finally { setSaving(false); }
  };

  const calcItemTotal = (item: CotacaoItem) => item.quantidade * item.valorUnitario - (item.desconto ?? 0);
  const subtotal = form.itens.reduce((s, i) => s + calcItemTotal(i), 0);
  const totalFinal = subtotal - form.desconto;

  const setItem = (idx: number, field: keyof CotacaoItem, value: string | number) =>
    setForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const fillItemFromProduto = (idx: number, prodId: string) => {
    const p = produtos.find(x => x.id === prodId);
    if (p) setForm(f => ({
      ...f, itens: f.itens.map((it, i) => i === idx
        ? { ...it, produtoId: p.id, descricao: p.descricao, valorUnitario: p.preco_venda ?? 0, unidade: p.unidade ?? 'UN' }
        : it),
    }));
  };

  const filtered = cotacoes.filter(c => {
    const matchBusca = !busca || c.cliente?.toLowerCase().includes(busca.toLowerCase()) || c.numero?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !statusFiltro || c.status === statusFiltro;
    return matchBusca && matchStatus;
  });

  const totAprovadas = cotacoes.filter(c => c.status === 'aprovada').reduce((s, c) => s + (c.valor_total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Cotações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Propostas comerciais para clientes</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          ['Total', cotacoes.length, ''],
          ['Aprovadas', fmtBRL(totAprovadas), 'text-emerald-600 dark:text-emerald-400'],
          ['Aguardando', cotacoes.filter(c => c.status === 'enviada').length, 'text-blue-600 dark:text-blue-400'],
          ['Rascunhos', cotacoes.filter(c => c.status === 'rascunho').length, ''],
        ] as const).map(([label, val, cls]) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold mt-1 text-slate-800 dark:text-slate-100 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente ou número..."
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Nenhuma cotação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Número', 'Cliente', 'Validade', 'Total', 'Status', 'Criado em', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => openEdit(c.id)}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{c.numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.cliente || <span className="text-slate-400 italic">Sem cliente</span>}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtDate(c.validade)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtBRL(c.valor_total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDeleteConfirm(c.id)} className="text-xs text-red-500 hover:underline font-medium">Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cotação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-3xl my-6 space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingId ? 'Editar Cotação' : 'Nova Cotação'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente</label>
                <PessoaBusca
                  value={pessoaId}
                  displayValue={pessoaNome}
                  onChange={(id, nome) => { setPessoaId(id); setPessoaNome(nome); }}
                  tipoCadastro="cliente"
                  placeholder="Buscar cliente por nome ou CPF/CNPJ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Validade</label>
                <input type="date" value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CotacaoStatus }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Itens</h3>
                <button onClick={() => setForm(f => ({ ...f, itens: [...f.itens, emptyItem()] }))} className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">+ Adicionar item</button>
              </div>
              <div className="space-y-2">
                {form.itens.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <select onChange={e => fillItemFromProduto(idx, e.target.value)} value={item.produtoId ?? ''}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[150px]">
                        <option value="">Selec. produto...</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                      </select>
                      <input value={item.descricao} onChange={e => setItem(idx, 'descricao', e.target.value)} placeholder="Descrição do item *"
                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {form.itens.length > 1 && (
                        <button onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Qtd.</label>
                        <input type="number" min="0.001" step="0.001" value={item.quantidade} onChange={e => setItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Unid.</label>
                        <input value={item.unidade} onChange={e => setItem(idx, 'unidade', e.target.value.toUpperCase())}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Vlr. Unit.</label>
                        <CurrencyInput value={item.valorUnitario} onChange={v => setItem(idx, 'valorUnitario', v)}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right tabular-nums" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Desc. item</label>
                        <CurrencyInput value={item.desconto} onChange={v => setItem(idx, 'desconto', v)}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right tabular-nums" />
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">Subtotal item: {fmtBRL(calcItemTotal(item))}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3}
                  placeholder="Condições comerciais, prazo de entrega..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <div className="flex flex-col gap-2 text-sm pt-1">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal:</span><span>{fmtBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Desconto geral:</span>
                  <CurrencyInput value={form.desconto} onChange={v => setForm(f => ({ ...f, desconto: v }))}
                    className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right tabular-nums" />
                </div>
                <div className="flex justify-between font-bold text-base border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-800 dark:text-slate-100">
                  <span>Total:</span><span className="text-brand-600 dark:text-brand-400">{fmtBRL(totalFinal)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar Cotação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir cotação?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={async () => { await cotacoesService.delete(deleteConfirm!); setDeleteConfirm(null); load(); }} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CotacoesPage;
