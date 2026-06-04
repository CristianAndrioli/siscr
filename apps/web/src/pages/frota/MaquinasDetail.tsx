import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { maquinasService, type Maquina, type MaquinaForm } from '../../services/frota';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_OPTS = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'inativa', label: 'Inativa' },
];

const EMPTY: MaquinaForm = { nome: '', modelo: '', placa: '', numeroSerie: '', anoFabricacao: undefined, capacidade: '', status: 'operacional', horimetroAtual: 0, observacoes: '' };
const CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function MaquinasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'nova';
  const { reportError } = useErrorNotification();
  const [record, setRecord] = useState<Maquina | null>(null);
  const [form, setForm] = useState<MaquinaForm>(EMPTY);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (f: keyof MaquinaForm, v: unknown) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    maquinasService.get(id!).then(d => {
      setRecord(d);
      setForm({ nome: d.nome, modelo: d.modelo ?? '', placa: d.placa ?? '', numeroSerie: d.numero_serie ?? '', anoFabricacao: d.ano_fabricacao, capacidade: d.capacidade ?? '', status: d.status, horimetroAtual: d.horimetro_atual, observacoes: d.observacoes ?? '' });
    }).catch(() => setError('Erro ao carregar.')).finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) { setError('Informe o nome da máquina.'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) { await maquinasService.create(form); navigate('/frota/maquinas'); }
      else { await maquinasService.update(id!, form); setIsEditing(false); const u = await maquinasService.get(id!); setRecord(u); }
    } catch (err) { const msg = formatApiError(err, 'Erro ao salvar.'); reportError(msg, err, 'Frota'); setError(msg); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Desativar esta máquina?')) return;
    try { await maquinasService.delete(id!); navigate('/frota/maquinas'); }
    catch (err) { const msg = formatApiError(err, 'Erro ao remover.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/frota/maquinas')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Máquinas
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isNew ? 'Nova Máquina' : (record?.nome ?? 'Detalhe')}</h1>
        </div>
        {!isNew && !isEditing && (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(true)} className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">Editar</button>
            <button onClick={handleDelete} className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors">Excluir</button>
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {!isNew && !isEditing && record && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {[
              { label: 'Nome', value: record.nome },
              { label: 'Modelo', value: record.modelo ?? '—' },
              { label: 'Placa', value: record.placa ?? '—' },
              { label: 'Nº Série', value: record.numero_serie ?? '—' },
              { label: 'Ano', value: record.ano_fabricacao ?? '—' },
              { label: 'Capacidade', value: record.capacidade ?? '—' },
              { label: 'Horímetro', value: `${(record.horimetro_atual ?? 0).toFixed(1)} h` },
              { label: 'Status', value: record.status === 'operacional' ? '🟢 Operacional' : record.status === 'manutencao' ? '🟡 Manutenção' : '⚫ Inativa' },
            ].map(({ label, value }) => (
              <div key={label}><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{String(value)}</dd></div>
            ))}
            {record.observacoes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observações</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.observacoes}</dd></div>}
          </dl>
        </div>
      )}

      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome <span className="text-red-500">*</span></label>
              <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Trator John Deere" className={CLS} required />
            </div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label><input type="text" value={form.modelo ?? ''} onChange={e => set('modelo', e.target.value)} className={CLS} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa</label><input type="text" value={form.placa ?? ''} onChange={e => set('placa', e.target.value.toUpperCase())} className={CLS} placeholder="ABC-1234" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nº de Série</label><input type="text" value={form.numeroSerie ?? ''} onChange={e => set('numeroSerie', e.target.value)} className={CLS} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ano de Fabricação</label><input type="number" value={form.anoFabricacao ?? ''} onChange={e => set('anoFabricacao', e.target.value ? Number(e.target.value) : undefined)} className={CLS} placeholder="2020" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capacidade</label><input type="text" value={form.capacidade ?? ''} onChange={e => set('capacidade', e.target.value)} className={CLS} placeholder="Ex.: 120 HP" /></div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={CLS}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Horímetro atual (h)</label>
              <CurrencyInput value={form.horimetroAtual} onChange={v => set('horimetroAtual', v)} placeholder="0,00" />
            </div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label><textarea rows={3} value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} className={`${CLS} resize-none`} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => isNew ? navigate('/frota/maquinas') : setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 rounded-lg transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
export default MaquinasDetail;
