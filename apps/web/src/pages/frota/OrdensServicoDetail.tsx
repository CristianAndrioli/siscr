import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordensServicoService, maquinasService, obrasService, type OrdemServico, type OrdemServicoForm } from '../../services/frota';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { servicosService, type Servico } from '../../services/cadastros/servicos';
import { fmtBRL, fmtDateISO } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';
import type { Maquina } from '../../services/frota';
import type { Obra } from '../../services/frota';

const STATUS_OPTS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'execucao', label: 'Em execução' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];
const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  execucao: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  concluido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const EMPTY: OrdemServicoForm = { obraId: '', operadorId: '', maquinaId: '', servicoId: '', status: 'pendente', descricao: '', turnoData: new Date().toISOString().slice(0, 10), turnoInicio: '', turnoFim: '', horimetroInicial: 0, horimetroFinal: 0, valorHora: 0, detalhesOperacao: '' };
const CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function OrdensServicoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'nova';
  const { reportError } = useErrorNotification();

  const [record, setRecord] = useState<OrdemServico | null>(null);
  const [form, setForm] = useState<OrdemServicoForm>(EMPTY);
  const [obras, setObras] = useState<Obra[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [faturando, setFaturando] = useState(false);
  const [error, setError] = useState('');
  const [faturadoMsg, setFaturadoMsg] = useState('');

  const set = (f: keyof OrdemServicoForm, v: unknown) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    obrasService.list({ limit: 200, page: 0 }).then(r => setObras(r.obras)).catch(() => {});
    maquinasService.list({ limit: 200, page: 0 }).then(r => setMaquinas(r.maquinas)).catch(() => {});
    pessoasService.list({ search: '', page: 0, limit: 200 }).then(r => setPessoas(r.pessoas)).catch(() => {});
    servicosService.list({ search: '', page: 0, limit: 200 }).then(r => setServicos(r.servicos)).catch(() => {});
    if (isNew) return;
    setLoading(true);
    ordensServicoService.get(id!).then(d => {
      setRecord(d);
      setForm({
        obraId: d.obra_id, operadorId: d.operador_id, maquinaId: d.maquina_id ?? '',
        servicoId: d.servico_id ?? '', status: d.status, descricao: d.descricao ?? '',
        turnoData: d.turno_data, turnoInicio: d.turno_inicio ?? '', turnoFim: d.turno_fim ?? '',
        horimetroInicial: d.horimetro_inicial ?? 0, horimetroFinal: d.horimetro_final ?? 0,
        valorHora: d.valor_hora ?? 0, detalhesOperacao: d.detalhes_operacao ?? '',
      });
    }).catch(() => setError('Erro ao carregar.')).finally(() => setLoading(false));
  }, [id, isNew]);

  // Ao selecionar serviço, preenche valorHora automaticamente
  const handleServicoChange = (servicoId: string) => {
    set('servicoId', servicoId);
    const svc = servicos.find(s => s.id === servicoId);
    if (svc && !form.valorHora) set('valorHora', svc.preco ?? 0);
  };

  const horas = Math.max(0, (form.horimetroFinal ?? 0) - (form.horimetroInicial ?? 0));
  const valorEstimado = horas * (form.valorHora ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.obraId) { setError('Selecione a obra.'); return; }
    if (!form.operadorId) { setError('Selecione o operador.'); return; }
    if (!form.turnoData) { setError('Informe a data do turno.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, maquinaId: form.maquinaId || undefined, servicoId: form.servicoId || undefined };
      if (isNew) { await ordensServicoService.create(payload); navigate('/frota/ordens-servico'); }
      else { await ordensServicoService.update(id!, payload); setIsEditing(false); const u = await ordensServicoService.get(id!); setRecord(u); }
    } catch (err) { const msg = formatApiError(err, 'Erro ao salvar OS.'); reportError(msg, err, 'Frota'); setError(msg); }
    finally { setSaving(false); }
  };

  const handleFaturar = async () => {
    if (!window.confirm('Gerar NFS-e rascunho para esta OS? Você poderá revisar antes de emitir.')) return;
    setFaturando(true); setError('');
    try {
      const res = await ordensServicoService.faturar(id!);
      setFaturadoMsg(res.message);
      const u = await ordensServicoService.get(id!);
      setRecord(u);
    } catch (err) { const msg = formatApiError(err, 'Erro ao faturar OS.'); reportError(msg, err, 'Frota'); setError(msg); }
    finally { setFaturando(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/frota/ordens-servico')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Ordens de Serviço
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isNew ? 'Nova OS' : `OS — ${fmtDateISO(record?.turno_data)}`}</h1>
          {record && <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[record.status] ?? ''}`}>{STATUS_OPTS.find(o => o.value === record.status)?.label ?? record.status}</span>}
        </div>
        {!isNew && !isEditing && record && (
          <div className="flex gap-2 flex-none flex-wrap justify-end">
            {record.status === 'concluido' && !record.nota_fiscal_id && (
              <button onClick={handleFaturar} disabled={faturando}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                {faturando ? 'Gerando NFS-e...' : 'Faturar OS'}
              </button>
            )}
            {record.nota_fiscal_id && (
              <button onClick={() => navigate('/faturamento/nfse')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Ver NFS-e
              </button>
            )}
            <button onClick={() => setIsEditing(true)} className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">Editar</button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {faturadoMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          <span>{faturadoMsg} <button onClick={() => navigate('/faturamento/nfse')} className="underline font-medium ml-1">Ir para NFS-e →</button></span>
        </div>
      )}

      {/* Visualização */}
      {!isNew && !isEditing && record && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Identificação</p>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              {[
                { label: 'Obra', value: record.obra_nome ?? '—' },
                { label: 'Máquina', value: record.maquina_nome ?? '—' },
                { label: 'Operador', value: record.operador_nome ?? '—' },
                { label: 'Serviço', value: record.servico_nome ?? '—' },
                { label: 'Data', value: fmtDateISO(record.turno_data) },
                { label: 'Turno', value: record.turno_inicio && record.turno_fim ? `${record.turno_inicio} – ${record.turno_fim}` : '—' },
              ].map(({ label, value }) => <div key={label}><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd></div>)}
            </dl>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Horímetro e Valores</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Inicial', value: record.horimetro_inicial != null ? `${record.horimetro_inicial.toFixed(1)} h` : '—' },
                { label: 'Final', value: record.horimetro_final != null ? `${record.horimetro_final.toFixed(1)} h` : '—' },
                { label: 'Horas Trabalhadas', value: record.horas_trabalhadas != null ? `${record.horas_trabalhadas.toFixed(1)} h` : '—' },
                { label: 'Valor Total', value: record.valor_total != null ? fmtBRL(record.valor_total) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {record.descricao && <div className="border-t border-slate-100 dark:border-slate-800 pt-4"><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.descricao}</dd></div>}
          {record.nota_fiscal_id && <div className="border-t border-slate-100 dark:border-slate-800 pt-4"><p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>NFS-e gerada — ID: <code className="font-mono text-[10px]">{record.nota_fiscal_id.slice(0, 8)}...</code></p></div>}
        </div>
      )}

      {/* Formulário */}
      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Obra <span className="text-red-500">*</span></label>
              <select value={form.obraId} onChange={e => set('obraId', e.target.value)} className={CLS} required>
                <option value="">Selecione a obra...</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Operador <span className="text-red-500">*</span></label>
              <select value={form.operadorId} onChange={e => set('operadorId', e.target.value)} className={CLS} required>
                <option value="">Selecione o operador...</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Máquina</label>
              <select value={form.maquinaId ?? ''} onChange={e => set('maquinaId', e.target.value)} className={CLS}>
                <option value="">Sem máquina</option>
                {maquinas.map(m => <option key={m.id} value={m.id}>{m.nome}{m.placa ? ` (${m.placa})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Serviço</label>
              <select value={form.servicoId ?? ''} onChange={e => handleServicoChange(e.target.value)} className={CLS}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={CLS}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data do Turno <span className="text-red-500">*</span></label>
              <input type="date" value={form.turnoData} onChange={e => set('turnoData', e.target.value)} className={CLS} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Início do Turno</label>
              <input type="time" value={form.turnoInicio ?? ''} onChange={e => set('turnoInicio', e.target.value)} className={CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fim do Turno</label>
              <input type="time" value={form.turnoFim ?? ''} onChange={e => set('turnoFim', e.target.value)} className={CLS} />
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Horímetro</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Inicial (h)</label>
                  <CurrencyInput value={form.horimetroInicial ?? 0} onChange={v => set('horimetroInicial', v)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Final (h)</label>
                  <CurrencyInput value={form.horimetroFinal ?? 0} onChange={v => set('horimetroFinal', v)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Horas trabalhadas</label>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">{horas.toFixed(1)} h</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor/hora (R$)</label>
              <CurrencyInput value={form.valorHora ?? 0} onChange={v => set('valorHora', v)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor estimado</label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 font-semibold text-brand-600 dark:text-brand-400 tabular-nums">{fmtBRL(valorEstimado)}</div>
            </div>

            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label><textarea rows={2} value={form.descricao ?? ''} onChange={e => set('descricao', e.target.value)} className={`${CLS} resize-none`} /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Detalhes da operação</label><textarea rows={3} value={form.detalhesOperacao ?? ''} onChange={e => set('detalhesOperacao', e.target.value)} className={`${CLS} resize-none`} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => isNew ? navigate('/frota/ordens-servico') : setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 rounded-lg transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
export default OrdensServicoDetail;
