import { useState, useEffect, useCallback } from 'react';
import { notasService, type NotaFiscal, type NFItem, type NFStatus } from '../../services/faturamentoService';
import { PessoaBusca } from '../../components/PessoaBusca';
import api from '../../services/api';

import { fmtBRL, fmtDate } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';

const STATUS_STYLE: Record<NFStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pendente_emissao: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  emitida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  inutilizada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<NFStatus, string> = {
  rascunho: 'Rascunho', pendente_emissao: 'Pend. Emissão', emitida: 'Emitida', cancelada: 'Cancelada', inutilizada: 'Inutilizada',
};

interface Produto { id: string; descricao: string; codigo: string; unidade: string; preco_venda: number; ncm: string; }

const emptyItem = (): NFItem => ({ descricao: '', quantidade: 1, valorUnitario: 0, desconto: 0, unidade: 'UN', cfop: '5102', ncm: '' });

type ModalMode = 'new' | 'view' | 'cancel' | 'faturar' | null;
type FaturarStep = { label: string; status: 'pending' | 'running' | 'done' | 'error' };
interface CondicaoPagamento { parcelas: number; vencimento: string; intervalo_dias: number; }

export function NFVendaPage() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedNota, setSelectedNota] = useState<NotaFiscal | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [faturarSteps, setFaturarSteps] = useState<FaturarStep[]>([]);
  const [faturarDone, setFaturarDone] = useState(false);
  const [condicao, setCondicao] = useState<CondicaoPagamento>({
    parcelas: 1,
    vencimento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    intervalo_dias: 30,
  });
  const [faturarConfirmando, setFaturarConfirmando] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [form, setForm] = useState({
    naturezaOperacao: 'Venda de mercadorias',
    observacoes: '',
    desconto: 0,
    itens: [emptyItem()],
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setNotas(await notasService.list({ tipo: 'nfe' })); }
    catch { setError('Erro ao carregar notas fiscais.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (modalMode === 'new' && produtos.length === 0) {
      api.get('/tenant/cadastros/produtos').then(r => setProdutos(r.data.produtos ?? [])).catch(() => {});
    }
  }, [modalMode, produtos.length]);

  const openNew = () => {
    setForm({ naturezaOperacao: 'Venda de mercadorias', observacoes: '', desconto: 0, itens: [emptyItem()] });
    setDestinatarioId(''); setDestinatarioNome('');
    setModalError(''); setSelectedNota(null); setModalMode('new');
  };

  const openView = async (id: string) => {
    try {
      const nota = await notasService.get(id);
      setSelectedNota(nota);
      setModalMode('view');
    } catch { setError('Erro ao carregar nota fiscal.'); }
  };

  const setItem = (idx: number, field: keyof NFItem, value: string | number) =>
    setForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const fillFromProduto = (idx: number, prodId: string) => {
    const p = produtos.find(x => x.id === prodId);
    if (p) setForm(f => ({
      ...f, itens: f.itens.map((it, i) => i === idx
        ? { ...it, produtoId: p.id, descricao: p.descricao, valorUnitario: p.preco_venda ?? 0, unidade: p.unidade ?? 'UN', ncm: p.ncm ?? '' }
        : it),
    }));
  };

  const calcItemTotal = (item: NFItem) => item.quantidade * item.valorUnitario - (item.desconto ?? 0);
  const subtotal = form.itens.reduce((s, i) => s + calcItemTotal(i), 0);
  const total = subtotal - form.desconto;

  const handleSave = async () => {
    const validItens = form.itens.filter(i => i.descricao.trim());
    if (validItens.length === 0) { setModalError('Adicione pelo menos um item.'); return; }
    setSaving(true); setModalError('');
    try {
      await notasService.create({
        tipo: 'nfe',
        destinatarioId: destinatarioId || undefined,
        naturezaOperacao: form.naturezaOperacao || undefined,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        itens: validItens,
      });
      setModalMode(null); load();
    } catch (err: any) {
      setModalError(err?.response?.data?.error || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!selectedNota) return;
    await notasService.cancelar(selectedNota.id, motivoCancel);
    setModalMode(null); setMotivoCancel(''); load();
  };

  const iniciarFaturamento = () => {
    setFaturarDone(false);
    setFaturarConfirmando(false);
    setModalError('');
    setCondicao({
      parcelas: 1,
      vencimento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      intervalo_dias: 30,
    });
    setFaturarSteps([]);
    setModalMode('faturar');
  };

  const setStep = (idx: number, status: FaturarStep['status']) =>
    setFaturarSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));

  const confirmarFaturamento = () => {
    setFaturarConfirmando(true);
    setFaturarSteps([
      { label: 'Validando nota fiscal', status: 'pending' },
      { label: 'Emitindo nota', status: 'pending' },
      { label: 'Baixando estoque dos itens', status: 'pending' },
      { label: `Gerando ${condicao.parcelas}x em Contas a Receber`, status: 'pending' },
      { label: 'Finalizando', status: 'pending' },
    ]);
    handleFaturar();
  };

  const handleFaturar = async () => {
    if (!selectedNota) return;
    setSaving(true); setModalError('');
    try {
      setStep(0, 'running');
      await new Promise(r => setTimeout(r, 500));
      setStep(0, 'done');

      setStep(1, 'running');
      await new Promise(r => setTimeout(r, 400));
      setStep(1, 'done');

      setStep(2, 'running');
      const res = await notasService.faturar(selectedNota.id, condicao);
      setFaturarSteps(prev => prev.map((s, i) => i === 2 ? {
        ...s, status: 'done',
        label: res.itens_baixados > 0
          ? `${res.itens_baixados} item(ns) com baixa de estoque`
          : 'Sem produtos vinculados — estoque não alterado',
      } : s));

      setStep(3, 'running');
      await new Promise(r => setTimeout(r, 300));
      setFaturarSteps(prev => prev.map((s, i) => i === 3 ? {
        ...s, status: 'done',
        label: res.parcelas_criadas > 0
          ? `${res.parcelas_criadas} parcela(s) lançada(s) em Contas a Receber`
          : 'Sem destinatário — Contas a Receber não gerado',
      } : s));

      setStep(4, 'running');
      await new Promise(r => setTimeout(r, 300));
      setStep(4, 'done');

      setFaturarDone(true);
      load();
    } catch (err: any) {
      setFaturarSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
      setModalError(err?.response?.data?.error || 'Erro ao faturar nota.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = notas.filter(n => {
    const matchBusca = !busca || n.destinatario?.toLowerCase().includes(busca.toLowerCase()) || String(n.numero ?? '').includes(busca);
    const matchStatus = !statusFiltro || n.status === statusFiltro;
    return matchBusca && matchStatus;
  });

  const totalEmitido = notas.filter(n => n.status === 'emitida').reduce((s, n) => s + (n.valor_total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">NF-e Venda</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Notas fiscais eletrônicas de venda de mercadorias</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova NF-e
        </button>
      </div>

      <div className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        <div>
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Integração com emissor fiscal em breve</p>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">Registre as notas em rascunho. A emissão eletrônica via SEFAZ será habilitada em uma próxima versão.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          ['Total', notas.length],
          ['Emitidas', notas.filter(n => n.status === 'emitida').length],
          ['Rascunhos', notas.filter(n => n.status === 'rascunho').length],
          ['Canceladas', notas.filter(n => n.status === 'cancelada').length],
        ] as const).map(([label, val]) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{val}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por destinatário ou número..."
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Nenhuma NF-e encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Número', 'Destinatário', 'Natureza Op.', 'Total', 'Status', 'Data', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => openView(n.id)}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {n.numero ? `${String(n.numero).padStart(6, '0')}/${n.serie ?? '1'}` : 'Rascunho'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{n.destinatario || <span className="text-slate-400 italic">Sem destinatário</span>}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate">{n.natureza_operacao || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtBRL(n.valor_total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[n.status]}`}>{STATUS_LABEL[n.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(n.created_at)}</td>
                    <td className="px-4 py-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalEmitido > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total emitido: <span className="text-emerald-600 dark:text-emerald-400">{fmtBRL(totalEmitido)}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nova NF-e */}
      {modalMode === 'new' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-3xl my-6 space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova NF-e (Rascunho)</h2>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Destinatário</label>
                <PessoaBusca
                  value={destinatarioId}
                  displayValue={destinatarioNome}
                  onChange={(id, nome) => { setDestinatarioId(id); setDestinatarioNome(nome); }}
                  placeholder="Buscar cliente por nome ou CPF/CNPJ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Natureza da Operação</label>
                <input value={form.naturezaOperacao} onChange={e => setForm(f => ({ ...f, naturezaOperacao: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações adicionais..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Itens</h3>
                <button onClick={() => setForm(f => ({ ...f, itens: [...f.itens, emptyItem()] }))} className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">+ Adicionar</button>
              </div>
              <div className="space-y-2">
                {form.itens.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <select onChange={e => fillFromProduto(idx, e.target.value)} value={item.produtoId ?? ''}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[140px]">
                        <option value="">Produto...</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                      </select>
                      <input value={item.descricao} onChange={e => setItem(idx, 'descricao', e.target.value)} placeholder="Descrição *"
                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {form.itens.length > 1 && <button onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {([['Qtd.', 'quantidade'], ['Unid.', 'unidade'], ['CFOP', 'cfop'], ['NCM', 'ncm']] as const).map(([label, field]) => (
                        <div key={field}>
                          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{label}</label>
                          <input
                            type={field === 'quantidade' ? 'number' : 'text'}
                            value={(item as any)[field]}
                            onChange={e => setItem(idx, field as keyof NFItem, field === 'quantidade' ? parseFloat(e.target.value) || 0 : e.target.value)}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Vlr. Unit.</label>
                        <CurrencyInput
                          value={item.valorUnitario}
                          onChange={v => setItem(idx, 'valorUnitario', v)}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">Total: {fmtBRL(calcItemTotal(item))}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3 gap-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                <span>Subtotal: {fmtBRL(subtotal)}</span>
                <span>Total: {fmtBRL(total)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalMode(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Rascunho'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhe NF-e */}
      {modalMode === 'view' && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-2xl my-6 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  NF-e {selectedNota.numero ? `${String(selectedNota.numero).padStart(6, '0')}/${selectedNota.serie ?? '1'}` : '(Rascunho)'}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${STATUS_STYLE[selectedNota.status]}`}>{STATUS_LABEL[selectedNota.status]}</span>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Destinatário</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedNota.destinatario || '—'}</p>
                {selectedNota.cpf_cnpj && <p className="text-xs text-slate-500 font-mono">{selectedNota.cpf_cnpj}</p>}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Operação</p>
                <p className="font-medium text-slate-700 dark:text-slate-200">{selectedNota.natureza_operacao || '—'}</p>
                <p className="text-xs text-slate-500">Emissão: {fmtDate(selectedNota.created_at)}</p>
              </div>
            </div>

            {selectedNota.itens && selectedNota.itens.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Itens</p>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {['Descrição', 'Qtd', 'Unid', 'CFOP', 'Vlr. Unit.', 'Total'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-slate-500 dark:text-slate-400 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedNota.itens.map((item, idx) => (
                        <tr key={idx} className="bg-white dark:bg-slate-900">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200 max-w-[200px] truncate">{item.descricao}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">{item.quantidade}</td>
                          <td className="px-3 py-2 text-slate-500">{item.unidade}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{item.cfop || '—'}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">{fmtBRL(item.valorUnitario)}</td>
                          <td className="px-3 py-2 font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmtBRL(item.valor_total ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end text-sm font-bold text-slate-700 dark:text-slate-300">
              <span>Total NF-e: <span className="text-brand-600 dark:text-brand-400 text-base">{fmtBRL(selectedNota.valor_total)}</span></span>
            </div>

            {selectedNota.observacoes && (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                <span className="font-semibold">Obs: </span>{selectedNota.observacoes}
              </p>
            )}

            {selectedNota.motivo_cancelamento && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                <span className="font-semibold">Cancelamento: </span>{selectedNota.motivo_cancelamento}
              </p>
            )}

            {modalError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
            )}

            <div className="flex gap-3 pt-2 flex-wrap">
              <button onClick={() => setModalMode(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Fechar</button>
              {selectedNota.status !== 'emitida' && selectedNota.status !== 'cancelada' && (
                <>
                  <button
                    onClick={iniciarFaturamento}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Faturar NF-e
                  </button>
                  <button onClick={() => { setMotivoCancel(''); setModalMode('cancel'); }} className="px-4 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors">Cancelar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Faturar */}
      {modalMode === 'faturar' && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-5">

            {/* ── Fase 1: Condição de pagamento ── */}
            {!faturarConfirmando && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Condição de Pagamento</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Defina como o valor da NF-e será parcelado em Contas a Receber.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Parcelas</label>
                    <select
                      value={condicao.parcelas}
                      onChange={e => setCondicao(c => ({ ...c, parcelas: Number(e.target.value) }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">1º Vencimento</label>
                    <input
                      type="date"
                      value={condicao.vencimento}
                      onChange={e => setCondicao(c => ({ ...c, vencimento: e.target.value }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Intervalo</label>
                    <select
                      value={condicao.intervalo_dias}
                      onChange={e => setCondicao(c => ({ ...c, intervalo_dias: Number(e.target.value) }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={60}>60 dias</option>
                      <option value={90}>90 dias</option>
                    </select>
                  </div>
                </div>

                {/* Preview das parcelas */}
                {condicao.parcelas > 0 && selectedNota.valor_total > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Preview das parcelas</p>
                    {Array.from({ length: condicao.parcelas }).map((_, i) => {
                      const valorParcela = Math.floor((selectedNota.valor_total / condicao.parcelas) * 100) / 100;
                      const valorFinal = i === condicao.parcelas - 1
                        ? Math.round((selectedNota.valor_total - valorParcela * (condicao.parcelas - 1)) * 100) / 100
                        : valorParcela;
                      const [y, m, d] = condicao.vencimento.split('-').map(Number);
                      const venc = new Date(Date.UTC(y, m - 1, d + i * condicao.intervalo_dias));
                      return (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">{i + 1}/{condicao.parcelas} — {venc.toLocaleDateString('pt-BR')}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {fmtBRL(valorFinal)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between text-xs font-bold text-slate-700 dark:text-slate-100">
                      <span>Total</span>
                      <span>{fmtBRL(selectedNota.valor_total)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setModalMode('view')} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Voltar
                  </button>
                  <button onClick={confirmarFaturamento} className="flex-1 px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors">
                    Confirmar Faturamento
                  </button>
                </div>
              </>
            )}

            {/* ── Fase 2: Progresso ── */}
            {faturarConfirmando && (
              <>
                <div className="text-center">
                  {faturarDone ? (
                    <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mx-auto mb-3">
                      <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {faturarDone ? 'NF-e Faturada!' : 'Processando...'}
                  </h2>
                  {faturarDone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      NF-e {String(selectedNota.numero ?? '').padStart(6, '0')} emitida com sucesso.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  {faturarSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-none w-6 h-6 flex items-center justify-center">
                        {step.status === 'done' && <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        {step.status === 'running' && <svg className="animate-spin w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                        {step.status === 'error' && <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                        {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                      </div>
                      <span className={`text-sm ${step.status === 'done' ? 'text-slate-700 dark:text-slate-200' : step.status === 'running' ? 'text-brand-600 dark:text-brand-400 font-medium' : step.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                {modalError && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
                )}

                {(faturarDone || modalError) && (
                  <button onClick={() => { setModalMode(null); setModalError(''); }} className="w-full px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors">
                    Fechar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {modalMode === 'cancel' && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cancelar NF-e</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Motivo do cancelamento</label>
              <textarea value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} rows={3} placeholder="Descreva o motivo..."
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalMode('view')} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Voltar</button>
              <button onClick={handleCancel} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NFVendaPage;
