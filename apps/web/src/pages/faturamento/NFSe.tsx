import { useState, useEffect, useCallback } from 'react';
import { notasService, type NotaFiscal, type NFStatus } from '../../services/faturamentoService';
import api from '../../services/api';

const fmtBRL = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const fmtPct = (v?: number) => v != null ? `${v}%` : '—';

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
interface Servico { id: string; descricao: string; preco: number; }

export function NFSePage() {
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
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [pessoaBusca, setPessoaBusca] = useState('');
  const [form, setForm] = useState({
    destinatarioId: '',
    descricaoServico: '',
    codigoServico: '',
    aliquotaIss: 2,
    observacoes: '',
    desconto: 0,
    valor: 0,
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setNotas(await notasService.list({ tipo: 'nfse' })); }
    catch { setError('Erro ao carregar NFS-e.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal) {
      if (pessoas.length === 0) api.get('/tenant/cadastros/pessoas', { params: { tipo: 'cliente' } }).then(r => setPessoas(r.data.pessoas ?? [])).catch(() => {});
      if (servicos.length === 0) api.get('/tenant/cadastros/servicos').then(r => setServicos(r.data.servicos ?? [])).catch(() => {});
    }
  }, [showModal, pessoas.length, servicos.length]);

  const openNew = () => {
    setForm({ destinatarioId: '', descricaoServico: '', codigoServico: '', aliquotaIss: 2, observacoes: '', desconto: 0, valor: 0 });
    setPessoaBusca(''); setModalError(''); setShowModal(true);
  };

  const fillFromServico = (id: string) => {
    const s = servicos.find(x => x.id === id);
    if (s) setForm(f => ({ ...f, descricaoServico: s.descricao, valor: s.preco ?? 0 }));
  };

  const valorIss = form.valor * (form.aliquotaIss / 100);
  const totalFinal = form.valor - form.desconto;

  const handleSave = async () => {
    if (!form.descricaoServico.trim()) { setModalError('Informe a descrição do serviço.'); return; }
    if (form.valor <= 0) { setModalError('Informe o valor do serviço.'); return; }
    setSaving(true); setModalError('');
    try {
      await notasService.create({
        tipo: 'nfse',
        destinatarioId: form.destinatarioId || undefined,
        descricaoServico: form.descricaoServico,
        codigoServico: form.codigoServico || undefined,
        aliquotaIss: form.aliquotaIss,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        itens: [{
          descricao: form.descricaoServico,
          quantidade: 1,
          valorUnitario: form.valor,
          desconto: form.desconto,
          unidade: 'SV',
        }],
      });
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
    const matchBusca = !busca || n.destinatario?.toLowerCase().includes(busca.toLowerCase()) || String(n.numero ?? '').includes(busca) || n.descricao_servico?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !statusFiltro || n.status === statusFiltro;
    return matchBusca && matchStatus;
  });

  const totalEmitido = notas.filter(n => n.status === 'emitida').reduce((s, n) => s + (n.valor_total ?? 0), 0);
  const totalIssEmitido = notas.filter(n => n.status === 'emitida').reduce((s, n) => s + (n.valor_iss ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">NFS-e</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Notas fiscais eletrônicas de serviços</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova NFS-e
        </button>
      </div>

      {/* Banner integração */}
      <div className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 flex gap-3 items-start">
        <svg className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        <div>
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">Integração com prefeitura em breve</p>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">A emissão eletrônica via prefeitura será habilitada em uma próxima versão. Registre as notas em rascunho e gerencie o cadastro agora.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[['Total NFS-e', notas.length, ''], ['Emitidas', notas.filter(n => n.status === 'emitida').length, ''], ['Valor emitido', fmtBRL(totalEmitido), 'text-emerald-600 dark:text-emerald-400'], ['ISS retido', fmtBRL(totalIssEmitido), 'text-amber-600 dark:text-amber-400']].map(([label, val, cls]) => (
          <div key={label as string} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label as string}</p>
            <p className={`text-xl font-bold mt-1 text-slate-800 dark:text-slate-100 ${cls as string}`}>{val as string | number}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por tomador, número ou serviço..."
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
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Nenhuma NFS-e encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  {['Número', 'Tomador', 'Serviço', 'Alíq. ISS', 'Valor', 'Status', 'Emissão', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{n.numero ? String(n.numero).padStart(6, '0') : '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{n.destinatario || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate">{n.descricao_servico || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{fmtPct(n.aliquota_iss)}</td>
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
          </div>
        )}
      </div>

      {/* Modal Nova NFS-e */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg my-6 space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nova NFS-e (Rascunho)</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tomador (cliente)</label>
                <input value={pessoaBusca} onChange={e => setPessoaBusca(e.target.value)} placeholder="Filtrar..." className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2" />
                <select value={form.destinatarioId} onChange={e => setForm(f => ({ ...f, destinatarioId: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Sem tomador</option>
                  {pessoasFiltradas.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.cpf_cnpj}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Serviço</label>
                <select onChange={e => fillFromServico(e.target.value)} value=""
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2">
                  <option value="">Selecionar serviço cadastrado (opcional)...</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.descricao}</option>)}
                </select>
                <textarea value={form.descricaoServico} onChange={e => setForm(f => ({ ...f, descricaoServico: e.target.value }))} rows={3}
                  placeholder="Descrição detalhada do serviço prestado... *"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Código do Serviço (LC 116)</label>
                  <input value={form.codigoServico} onChange={e => setForm(f => ({ ...f, codigoServico: e.target.value }))} placeholder="Ex: 01.01"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Alíquota ISS (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.aliquotaIss} onChange={e => setForm(f => ({ ...f, aliquotaIss: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Valor do Serviço (R$) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Desconto (R$)</label>
                  <input type="number" min="0" step="0.01" value={form.desconto} onChange={e => setForm(f => ({ ...f, desconto: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Valor do serviço:</span><span>{fmtBRL(form.valor)}</span></div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>ISS ({form.aliquotaIss}%):</span><span>{fmtBRL(valorIss)}</span></div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Desconto:</span><span>-{fmtBRL(form.desconto)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>Total:</span><span>{fmtBRL(totalFinal)}</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações adicionais..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Rascunho'}</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cancelar NFS-e</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Motivo</label>
              <textarea value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} rows={3} placeholder="Descreva o motivo..."
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Voltar</button>
              <button onClick={handleCancel} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Cancelar NFS-e</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NFSePage;
