import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obrasService, type Obra, type ObraForm } from '../../services/frota';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { fmtDateISO } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_OPTS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];
const EMPTY: ObraForm = { nome: '', clienteId: '', dataInicio: '', dataFim: '', localizacao: '', municipio: '', areaEstimada: '', status: 'em_andamento', observacoes: '' };
const CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function ObrasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'nova';
  const { reportError } = useErrorNotification();
  const [record, setRecord] = useState<Obra | null>(null);
  const [form, setForm] = useState<ObraForm>(EMPTY);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (f: keyof ObraForm, v: string) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    pessoasService.list({ search: '', page: 0, limit: 200 }).then(r => setPessoas(r.pessoas)).catch(() => {});
    if (isNew) return;
    setLoading(true);
    obrasService.get(id!).then(d => {
      setRecord(d);
      setForm({ nome: d.nome, clienteId: d.cliente_id ?? '', dataInicio: d.data_inicio ?? '', dataFim: d.data_fim ?? '', localizacao: d.localizacao ?? '', municipio: d.municipio ?? '', areaEstimada: d.area_estimada ?? '', status: d.status, observacoes: d.observacoes ?? '' });
    }).catch(() => setError('Erro ao carregar.')).finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) { setError('Informe o nome da obra.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, clienteId: form.clienteId || undefined };
      if (isNew) { await obrasService.create(payload); navigate('/frota/obras'); }
      else { await obrasService.update(id!, payload); setIsEditing(false); const u = await obrasService.get(id!); setRecord(u); }
    } catch (err) { const msg = formatApiError(err, 'Erro ao salvar.'); reportError(msg, err, 'Frota'); setError(msg); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Desativar esta obra?')) return;
    try { await obrasService.delete(id!); navigate('/frota/obras'); }
    catch (err) { const msg = formatApiError(err, 'Erro ao remover.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/frota/obras')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Obras
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isNew ? 'Nova Obra' : (record?.nome ?? 'Detalhe')}</h1>
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
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              { label: 'Nome', value: record.nome },
              { label: 'Cliente', value: record.cliente_nome ?? '—' },
              { label: 'Município', value: record.municipio ?? '—' },
              { label: 'Área Estimada', value: record.area_estimada ?? '—' },
              { label: 'Início', value: fmtDateISO(record.data_inicio) },
              { label: 'Fim', value: fmtDateISO(record.data_fim) },
              { label: 'Localização', value: record.localizacao ?? '—' },
              { label: 'Status', value: record.status === 'em_andamento' ? '🔵 Em andamento' : record.status === 'concluida' ? '🟢 Concluída' : '⚫ Cancelada' },
            ].map(({ label, value }) => (
              <div key={label}><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd></div>
            ))}
            {record.observacoes && <div className="col-span-2"><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observações</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.observacoes}</dd></div>}
          </dl>
        </div>
      )}

      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Obra <span className="text-red-500">*</span></label>
              <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={CLS} placeholder="Ex.: Terraplanagem Fazenda São João" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
              <select value={form.clienteId ?? ''} onChange={e => set('clienteId', e.target.value)} className={CLS}>
                <option value="">Sem cliente vinculado</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Início</label><input type="date" value={form.dataInicio ?? ''} onChange={e => set('dataInicio', e.target.value)} className={CLS} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Fim</label><input type="date" value={form.dataFim ?? ''} onChange={e => set('dataFim', e.target.value)} className={CLS} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Município</label><input type="text" value={form.municipio ?? ''} onChange={e => set('municipio', e.target.value)} className={CLS} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Área Estimada</label><input type="text" value={form.areaEstimada ?? ''} onChange={e => set('areaEstimada', e.target.value)} className={CLS} placeholder="Ex.: 50 ha" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Localização</label><input type="text" value={form.localizacao ?? ''} onChange={e => set('localizacao', e.target.value)} className={CLS} /></div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={CLS}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label><textarea rows={3} value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} className={`${CLS} resize-none`} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => isNew ? navigate('/frota/obras') : setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 rounded-lg transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
export default ObrasDetail;
