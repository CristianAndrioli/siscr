import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  notasService,
  type NotaFiscal,
  type NFItem,
  type NFStatus,
} from '../../services/faturamentoService';
import { PessoaBusca } from '../../components/PessoaBusca';
import api from '../../services/api';

import { fmtBRL, fmtDate } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const STATUS_STYLE: Record<NFStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pendente_emissao: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  autorizada: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  emitida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  inutilizada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL: Record<NFStatus, string> = {
  rascunho: 'Rascunho',
  pendente_emissao: 'XML gerado',
  autorizada: 'Autorizada (SEFAZ)',
  emitida: 'Faturada (ERP)',
  cancelada: 'Cancelada',
  inutilizada: 'Inutilizada',
};

interface Produto { id: string; descricao: string; codigo: string; unidade: string; preco_venda: number; ncm: string; }

const emptyItem = (): NFItem => ({ descricao: '', quantidade: 1, valorUnitario: 0, desconto: 0, unidade: 'UN', cfop: '5102', ncm: '' });

type ModalMode = 'new' | null;

export function NFVendaPage() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
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
      api
        .get('/tenant/cadastros/produtos', { params: { limit: 200, page: 0 } })
        .then((r) => setProdutos(r.data.produtos ?? []))
        .catch(() => {});
    }
  }, [modalMode, produtos.length]);

  const openNew = () => {
    setForm({ naturezaOperacao: 'Venda de mercadorias', observacoes: '', desconto: 0, itens: [emptyItem()] });
    setDestinatarioId(''); setDestinatarioNome('');
    setModalError(''); setModalMode('new');
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
      const created = await notasService.create({
        tipo: 'nfe',
        destinatarioId: destinatarioId || undefined,
        naturezaOperacao: form.naturezaOperacao || undefined,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        itens: validItens,
      });
      setModalMode(null);
      navigate(`/faturamento/nf-venda/${created.id}`);
    } catch (err) {
      reportError('Erro ao salvar NF-e.', err, 'Faturamento NF-e');
      setModalError((err as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Erro ao salvar. Consulte o log de erros para mais detalhes.');
    } finally { setSaving(false); }
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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/faturamento/nf-venda/nova"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nova NF-e (assistente)
          </Link>
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Criação rápida
          </button>
        </div>
      </div>

      <div className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        <div>
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Fluxo da NF-e neste sistema</p>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 leading-relaxed">
            <strong className="text-brand-800 dark:text-brand-200">XML gerado</strong> →{' '}
            <strong className="text-brand-800 dark:text-brand-200">Autorizada (SEFAZ)</strong> →{' '}
            <strong className="text-brand-800 dark:text-brand-200">Faturada (ERP)</strong> (estoque/financeiro).
            Clique na nota para abrir a tela completa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {([
          ['Total', notas.length],
          ['XML gerado', notas.filter(n => n.status === 'pendente_emissao').length],
          ['Autorizadas', notas.filter(n => n.status === 'autorizada').length],
          ['Faturadas (ERP)', notas.filter(n => n.status === 'emitida').length],
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
                  <tr
                    key={n.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/faturamento/nf-venda/${n.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {n.numero ? `${String(n.numero).padStart(6, '0')}/${n.serie ?? '1'}` : 'Rascunho'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{n.destinatario || <span className="text-slate-400 italic">Sem destinatário</span>}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate">{n.natureza_operacao || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtBRL(n.valor_total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[n.status] ?? STATUS_STYLE.rascunho}`}>{STATUS_LABEL[n.status] ?? n.status}</span>
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
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total faturado (ERP): <span className="text-emerald-600 dark:text-emerald-400">{fmtBRL(totalEmitido)}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {modalMode === 'new' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-3xl my-6 space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova NF-e (Rascunho)</h2>
              <button type="button" onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Destinatário</label>
                <PessoaBusca
                  value={destinatarioId}
                  displayValue={destinatarioNome}
                  onChange={(pid, nome) => { setDestinatarioId(pid); setDestinatarioNome(nome); }}
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
                <button type="button" onClick={() => setForm(f => ({ ...f, itens: [...f.itens, emptyItem()] }))} className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">+ Adicionar</button>
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
                      {form.itens.length > 1 && <button type="button" onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {([['Qtd.', 'quantidade'], ['Unid.', 'unidade'], ['CFOP', 'cfop'], ['NCM', 'ncm']] as const).map(([label, field]) => (
                        <div key={field}>
                          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{label}</label>
                          <input
                            type={field === 'quantidade' ? 'number' : 'text'}
                            value={String((item as unknown as Record<string, unknown>)[field] ?? '')}
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
              <button type="button" onClick={() => setModalMode(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar e abrir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NFVendaPage;
