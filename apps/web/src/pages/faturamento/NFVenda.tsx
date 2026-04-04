import { useState, useEffect, useCallback } from 'react';
import { notasService, type NotaFiscal, type NFItem, type NFStatus } from '../../services/faturamentoService';
import api from '../../services/api';

const fmtBRL = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

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

interface Pessoa { id: string; nome: string; cpf_cnpj: string; }
interface Produto { id: string; descricao: string; codigo: string; unidade: string; preco_venda: number; ncm: string; }

const emptyItem = (): NFItem => ({ descricao: '', quantidade: 1, valorUnitario: 0, desconto: 0, unidade: 'UN', cfop: '5102', ncm: '' });

export function NFVendaPage() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [motivoCancel, setMotivoCancel] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [form, setForm] = useState({ destinatarioId: '', naturezaOperacao: 'Venda de mercadorias', observacoes: '', desconto: 0, itens: [emptyItem()] });
  const [pessoaBusca, setPessoaBusca] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setNotas(await notasService.list({ tipo: 'nfe' })); }
    catch { setError('Erro ao carregar notas fiscais.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal) {
      if (pessoas.length === 0) api.get('/tenant/cadastros/pessoas', { params: { tipo: 'cliente' } }).then(r => setPessoas(r.data.pessoas ?? [])).catch(() => {});
      if (produtos.length === 0) api.get('/tenant/cadastros/produtos').then(r => setProdutos(r.data.produtos ?? [])).catch(() => {});
    }
  }, [showModal, pessoas.length, produtos.length]);

  const openNew = () => {
    setForm({ destinatarioId: '', naturezaOperacao: 'Venda de mercadorias', observacoes: '', desconto: 0, itens: [emptyItem()] });
    setPessoaBusca(''); setModalError(''); setShowModal(true);
  };

  const setItem = (idx: number, field: keyof NFItem, value: string | number) =>
    setForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const fillFromProduto = (idx: number, prodId: string) => {
    const p = produtos.find(x => x.id === prodId);
    if (p) setForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, produtoId: p.id, descricao: p.descricao, valorUnitario: p.preco_venda ?? 0, unidade: p.unidade ?? 'UN', ncm: p.ncm ?? '' } : it) }));
  };

  const calcItemTotal = (item: NFItem) => item.quantidade * item.valorUnitario - (item.desconto ?? 0);
  const subtotal = form.itens.reduce((s, i) => s + calcItemTotal(i), 0);
  const total = subtotal - form.desconto;

  const handleSave = async () => {
    const validItens = form.itens.filter(i => i.descricao.trim());
    if (validItens.length === 0) { setModalError('Adicione pelo menos um item.'); return; }
    setSaving(true); setModalError('');
    try {
      await notasService.create({ tipo: 'nfe', destinatarioId: form.destinatarioId || undefined, naturezaOperacao: form.naturezaOperacao, observacoes: form.observacoes || undefined, desconto: form.desconto, itens: validItens });
      setShowModal(false); load();
    } catch (err: any) {
      setModalError(err?.response?.data?.error || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!showCancelModal) return;
    await notasService.cancelar(showCancelModal, motivoCancel);
    setShowCancelModal(null); setMotivoCancel(''); load();
  };

  const pessoasFiltradas = pessoas.filter(p => !pessoaBusca || p.nome.toLowerCase().includes(pessoaBusca.toLowerCase()) || p.cpf_cnpj?.includes(pessoaBusca));
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

      {/* Banner integração */}
      <div className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        <div>
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Integração com emissor fiscal em breve</p>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">Atualmente você pode registrar as notas em rascunho e gerenciar o cadastro. A emissão eletrônica via SEFAZ será habilitada em uma próxima versão.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['Total', notas.length], ['Emitidas', notas.filter(n => n.status === 'emitida').length], ['Rascunhos', notas.filter(n => n.status === 'rascunho').length], ['Canceladas', notas.filter(n => n.status === 'cancelada').length]].map(([label, val]) => (
          <div key={label as string} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label as string}</p>
            <p className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{val as number}</p>
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
                  {['Número', 'Destinatário', 'Natureza Op.', 'Total', 'Status', 'Emissão', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{n.numero ? `${String(n.numero).padStart(6, '0')}/${n.serie ?? '1'}` : '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{n.destinatario || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate">{n.natureza_operacao || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtBRL(n.valor_total)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[n.status]}`}>{STATUS_LABEL[n.status]}</span></td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(n.data_emissao ?? n.created_at)}</td>
                    <td className="px-4 py-3">
                      {n.status !== 'emitida' && n.status !== 'cancelada' && (
                        <button onClick={() => setShowCancelModal(n.id)} className="text-xs text-red-500 hover:underline font-medium">Cancelar</button>
                      )}
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-3xl my-6 space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova NF-e (Rascunho)</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Destinatário</label>
                <input value={pessoaBusca} onChange={e => setPessoaBusca(e.target.value)} placeholder="Filtrar cliente..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2" />
                <select value={form.destinatarioId} onChange={e => setForm(f => ({ ...f, destinatarioId: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Sem destinatário</option>
                  {pessoasFiltradas.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.cpf_cnpj}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Natureza da Operação</label>
                <input value={form.naturezaOperacao} onChange={e => setForm(f => ({ ...f, naturezaOperacao: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Dados adicionais..."
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
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[140px]">
                        <option value="">Produto...</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                      </select>
                      <input value={item.descricao} onChange={e => setItem(idx, 'descricao', e.target.value)} placeholder="Descrição *"
                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {form.itens.length > 1 && <button onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[['Qtd.', 'quantidade', 'number'], ['Unid.', 'unidade', 'text'], ['CFOP', 'cfop', 'text'], ['NCM', 'ncm', 'text'], ['Vlr. Unit.', 'valorUnitario', 'number']].map(([label, field, type]) => (
                        <div key={field}>
                          <label className="text-xs text-slate-500 dark:text-slate-400">{label}</label>
                          <input type={type} value={(item as any)[field]} onChange={e => setItem(idx, field as keyof NFItem, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                      ))}
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
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Rascunho'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar NF */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cancelar NF-e</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Motivo do cancelamento</label>
              <textarea value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} rows={3} placeholder="Descreva o motivo..."
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Voltar</button>
              <button onClick={handleCancel} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Cancelar NF-e</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NFVendaPage;
