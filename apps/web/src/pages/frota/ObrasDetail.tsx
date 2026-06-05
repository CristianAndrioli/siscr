import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  obrasService, maquinasService, ordensServicoService,
  type Obra, type ObraForm, type ObraMaquina, type ObraResumo, type Medicao, type Maquina, type OrdemServico,
} from '../../services/frota';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { fmtBRL, fmtDateISO } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';

const STATUS_OPTS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];
const EMPTY: ObraForm = { nome: '', clienteId: '', dataInicio: '', dataFim: '', localizacao: '', municipio: '', areaEstimada: '', status: 'em_andamento', observacoes: '' };
const CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

type Tab = 'dados' | 'maquinas' | 'apontamentos' | 'medicoes';

interface ApontRow {
  maquinaId?: string;
  maquina_nome?: string;
  operadorId: string;
  servicoId?: string;
  turnoInicio: string;   // HH:MM
  turnoFim: string;      // HH:MM
  horasDirectas: string; // fallback: horas diretas (string para input controlado)
  valorHora: number;
  incluir: boolean;
}

// Calcula horas a partir de HH:MM início e fim
function calcHorasFromTime(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  if (isNaN(hi) || isNaN(mi) || isNaN(hf) || isNaN(mf)) return 0;
  const mins = hf * 60 + mf - (hi * 60 + mi);
  return Math.max(0, mins / 60);
}

export function ObrasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'nova';
  const { reportError } = useErrorNotification();

  const [tab, setTab] = useState<Tab>('dados');
  const [record, setRecord] = useState<Obra | null>(null);
  const [form, setForm] = useState<ObraForm>(EMPTY);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [finalizarAviso, setFinalizarAviso] = useState<{ pendentes: number; valor: string } | null>(null);
  const set = (f: keyof ObraForm, v: string) => setForm(p => ({ ...p, [f]: v }));

  // Máquinas alocadas
  const [obraMaquinas, setObraMaquinas] = useState<ObraMaquina[]>([]);
  const [allMaquinas, setAllMaquinas] = useState<Maquina[]>([]);
  const [addMaquinaId, setAddMaquinaId] = useState('');
  const [addValorHora, setAddValorHora] = useState(0);

  // Apontamentos
  const [turnoData, setTurnoData] = useState(new Date().toISOString().slice(0, 10));
  const [apontRows, setApontRows] = useState<ApontRow[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);

  // Medições / resumo
  const [resumo, setResumo] = useState<ObraResumo | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [gerando, setGerando] = useState(false);

  const reloadObraData = useCallback(async () => {
    if (isNew || !id) return;
    const [mq, rs, md, os] = await Promise.all([
      obrasService.maquinas(id).catch(() => []),
      obrasService.resumo(id).catch(() => null),
      obrasService.medicoes(id).catch(() => []),
      ordensServicoService.list({ obraId: id, limit: 100, page: 0 }).then(r => r.ordens).catch(() => []),
    ]);
    setObraMaquinas(mq);
    setResumo(rs);
    setMedicoes(md);
    setOrdens(os);
  }, [id, isNew]);

  useEffect(() => {
    pessoasService.list({ search: '', page: 0, limit: 200 }).then(r => setPessoas(r.pessoas)).catch(() => {});
    maquinasService.list({ limit: 200, page: 0 }).then(r => setAllMaquinas(r.maquinas)).catch(() => {});
    if (isNew) return;
    setLoading(true);
    obrasService.get(id!).then(d => {
      setRecord(d);
      setForm({ nome: d.nome, clienteId: d.cliente_id ?? '', dataInicio: d.data_inicio ?? '', dataFim: d.data_fim ?? '', localizacao: d.localizacao ?? '', municipio: d.municipio ?? '', areaEstimada: d.area_estimada ?? '', status: d.status, observacoes: d.observacoes ?? '' });
    }).catch(() => setError('Erro ao carregar.')).finally(() => setLoading(false));
    reloadObraData();
  }, [id, isNew, reloadObraData]);

  // Monta as linhas de apontamento a partir das máquinas alocadas
  useEffect(() => {
    setApontRows(obraMaquinas.map(om => ({
      maquinaId: om.maquina_id,
      maquina_nome: om.maquina_nome,
      operadorId: '',
      turnoInicio: '',
      turnoFim: '',
      horasDirectas: '',
      valorHora: om.valor_hora ?? 0,
      incluir: false,
    })));
  }, [obraMaquinas]);

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

  const handleFinalizar = async () => {
    if (!window.confirm('Finalizar esta obra? Ela será marcada como concluída.')) return;
    setError(''); setInfo(''); setFinalizarAviso(null);
    try {
      const res = await obrasService.finalizar(id!);
      const u = await obrasService.get(id!); setRecord(u);
      if (res.apontamentos_pendentes > 0) {
        const valorFormatado = fmtBRL(Number((res.aviso ?? '').match(/R\$\s*([\d.,]+)/)?.[0]?.replace('R$', '').replace(/\./g, '').replace(',', '.') ?? 0));
        setFinalizarAviso({ pendentes: res.apontamentos_pendentes, valor: valorFormatado });
        setTab('medicoes');
      }
    } catch (err) { const msg = formatApiError(err, 'Erro ao finalizar.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  const handleAlocar = async () => {
    if (!addMaquinaId) { setError('Selecione uma máquina para alocar.'); return; }
    setError('');
    try {
      await obrasService.alocarMaquina(id!, { maquinaId: addMaquinaId, valorHora: addValorHora || undefined });
      setAddMaquinaId(''); setAddValorHora(0);
      await reloadObraData();
    } catch (err) { const msg = formatApiError(err, 'Erro ao alocar máquina.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  const handleRemoverMaquina = async (maquinaId: string, nome?: string) => {
    if (!window.confirm(`Remover "${nome ?? 'máquina'}" desta obra?`)) return;
    try { await obrasService.removerMaquina(id!, maquinaId); await reloadObraData(); }
    catch (err) { const msg = formatApiError(err, 'Erro ao remover máquina.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  const setRow = (idx: number, patch: Partial<ApontRow>) => setApontRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const handleApontar = async () => {
    const selecionadas = apontRows.filter(r => r.incluir);
    if (selecionadas.length === 0) { setError('Marque ao menos uma máquina para apontar.'); return; }
    if (selecionadas.some(r => !r.operadorId)) { setError('Selecione o operador de cada linha marcada.'); return; }

    const linhas: ApontamentoLinha[] = selecionadas.map(r => {
      const horasPorHorario = calcHorasFromTime(r.turnoInicio, r.turnoFim);
      const horasDiretas = r.horasDirectas !== '' ? Number(r.horasDirectas) : undefined;
      const horas = horasPorHorario > 0 ? horasPorHorario : horasDiretas;
      return {
        maquinaId: r.maquinaId,
        operadorId: r.operadorId,
        servicoId: r.servicoId,
        horas,
        valorHora: r.valorHora,
      };
    });

    if (linhas.some(l => !l.horas || l.horas <= 0)) {
      setError('Informe o horário (início e fim) ou as horas trabalhadas em cada linha marcada.');
      return;
    }

    setError(''); setInfo('');
    try {
      const res = await obrasService.apontarHoras(id!, { turnoData, turnoInicio: selecionadas[0]?.turnoInicio || undefined, turnoFim: selecionadas[0]?.turnoFim || undefined, linhas });
      setInfo(res.message);
      await reloadObraData();
    } catch (err) { const msg = formatApiError(err, 'Erro ao apontar horas.'); reportError(msg, err, 'Frota'); setError(msg); }
  };

  const handleGerarMedicao = async () => {
    const isConcluida = record?.status === 'concluida';
    const label = isConcluida ? 'nota fiscal final' : 'nota parcial';
    if (!window.confirm(`Gerar ${label} com todos os apontamentos concluídos ainda não faturados?`)) return;
    setGerando(true); setError(''); setInfo('');
    try {
      const res = await obrasService.gerarMedicao(id!);
      setInfo(res.message);
      await reloadObraData();
    } catch (err) { const msg = formatApiError(err, 'Erro ao gerar medição.'); reportError(msg, err, 'Frota'); setError(msg); }
    finally { setGerando(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  const maquinasDisponiveis = allMaquinas.filter(m => !obraMaquinas.some(om => om.maquina_id === m.id));
  const statusBadge = record?.status === 'em_andamento' ? '🔵 Em andamento' : record?.status === 'concluida' ? '🟢 Concluída' : '⚫ Cancelada';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/frota/obras')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Obras
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isNew ? 'Nova Obra' : (record?.nome ?? 'Detalhe')}</h1>
          {!isNew && record && <span className="mt-1 inline-block text-xs font-medium text-slate-500 dark:text-slate-400">{statusBadge}{record.data_conclusao ? ` · finalizada em ${fmtDateISO(record.data_conclusao)}` : ''}</span>}
        </div>
        {!isNew && !isEditing && record && (
          <div className="flex gap-2 flex-wrap justify-end">
            {record.status === 'em_andamento' && (
              <button onClick={handleFinalizar} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Finalizar obra
              </button>
            )}
            <button onClick={() => setIsEditing(true)} className="border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">Editar</button>
            <button onClick={handleDelete} className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors">Excluir</button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Aviso pós-finalização: há saldo a faturar, já foi redirecionado para aba Medições */}
      {finalizarAviso && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <span>
            Obra finalizada. Há <strong>{finalizarAviso.pendentes} apontamento(s)</strong> concluído(s) ainda não faturados. Gere a medição final para criar a nota fiscal.
            {' '}<button onClick={() => setFinalizarAviso(null)} className="underline font-medium ml-1 text-amber-700 dark:text-amber-400">Dispensar</button>
          </span>
        </div>
      )}

      {/* Balão de sucesso após gerar medição/apontamento */}
      {info && (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          <span>
            {info}
            {' '}<button onClick={() => navigate('/faturamento/nfsservice')} className="underline font-medium ml-1">Ver NFS-e em Faturamento →</button>
            {' '}<button onClick={() => setInfo('')} className="underline text-xs ml-2 opacity-60">Fechar</button>
          </span>
        </div>
      )}

      {/* Abas (só quando a obra já existe) */}
      {!isNew && !isEditing && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {([
            { k: 'dados', label: 'Dados' },
            { k: 'maquinas', label: `Máquinas (${obraMaquinas.length})` },
            { k: 'apontamentos', label: 'Apontamentos' },
            { k: 'medicoes', label: `Medições (${medicoes.length})` },
          ] as { k: Tab; label: string }[]).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.k ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Aba Dados (visualização) ── */}
      {!isNew && !isEditing && record && tab === 'dados' && (
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
              { label: 'Status', value: statusBadge },
            ].map(({ label, value }) => (
              <div key={label}><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd></div>
            ))}
            {record.observacoes && <div className="col-span-2"><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observações</dt><dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.observacoes}</dd></div>}
          </dl>
        </div>
      )}

      {/* ── Aba Máquinas ── */}
      {!isNew && !isEditing && tab === 'maquinas' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Alocar máquina</p>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Máquina</label>
                <select value={addMaquinaId} onChange={e => setAddMaquinaId(e.target.value)} className={CLS}>
                  <option value="">Selecione...</option>
                  {maquinasDisponiveis.map(m => <option key={m.id} value={m.id}>{m.nome}{m.placa ? ` (${m.placa})` : ''}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Valor/hora (R$)</label>
                <CurrencyInput value={addValorHora} onChange={setAddValorHora} />
              </div>
              <button onClick={handleAlocar} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">Alocar</button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {obraMaquinas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 p-6 text-center">Nenhuma máquina alocada nesta obra.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr><th className="text-left px-4 py-2 font-semibold">Máquina</th><th className="text-left px-4 py-2 font-semibold">Placa</th><th className="text-right px-4 py-2 font-semibold">Valor/hora</th><th className="text-left px-4 py-2 font-semibold">Alocada em</th><th className="px-4 py-2"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {obraMaquinas.map(om => (
                    <tr key={om.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-4 py-2 font-medium">{om.maquina_nome ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{om.maquina_placa ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{om.valor_hora != null ? fmtBRL(om.valor_hora) : '—'}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{fmtDateISO(om.data_alocacao)}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleRemoverMaquina(om.maquina_id, om.maquina_nome)} className="text-red-500 hover:text-red-700 text-xs font-medium">Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Aba Apontamentos ── */}
      {!isNew && !isEditing && tab === 'apontamentos' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Apontamento rápido</p>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Data do turno</label>
                <input type="date" value={turnoData} onChange={e => setTurnoData(e.target.value)} className={`${CLS} w-44`} />
              </div>
              <button onClick={handleApontar} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Registrar apontamentos</button>
            </div>

            {apontRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Aloque máquinas na aba "Máquinas" para apontar horas rapidamente.</p>
            ) : (
              <>
                <p className="text-xs text-slate-400 dark:text-slate-500">Informe o horário de início e fim <strong className="text-slate-500 dark:text-slate-400">ou</strong> as horas diretamente. O total é calculado automaticamente.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-2 py-2 w-8"></th>
                        <th className="text-left px-2 py-2 font-semibold">Máquina</th>
                        <th className="text-left px-2 py-2 font-semibold">Operador</th>
                        <th className="text-center px-2 py-2 font-semibold">Início</th>
                        <th className="text-center px-2 py-2 font-semibold">Fim</th>
                        <th className="text-center px-2 py-2 font-semibold">Horas</th>
                        <th className="text-right px-2 py-2 font-semibold">Valor/h</th>
                        <th className="text-right px-2 py-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {apontRows.map((r, idx) => {
                        const horasPorHorario = calcHorasFromTime(r.turnoInicio, r.turnoFim);
                        const horasDiretas = r.horasDirectas !== '' ? Number(r.horasDirectas) : 0;
                        const horas = horasPorHorario > 0 ? horasPorHorario : horasDiretas;
                        const total = horas * (r.valorHora ?? 0);
                        const usandoHorario = r.turnoInicio !== '' || r.turnoFim !== '';
                        return (
                          <tr key={r.maquinaId ?? idx} className={r.incluir ? '' : 'opacity-50'}>
                            <td className="px-2 py-2">
                              <input type="checkbox" checked={r.incluir} onChange={e => setRow(idx, { incluir: e.target.checked })} className="rounded border-slate-300" />
                            </td>
                            <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.maquina_nome ?? '—'}</td>
                            <td className="px-2 py-2">
                              <select value={r.operadorId} onChange={e => setRow(idx, { operadorId: e.target.value })} className={`${CLS} min-w-36`}>
                                <option value="">Operador...</option>
                                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2 w-28">
                              <input type="time" value={r.turnoInicio} onChange={e => setRow(idx, { turnoInicio: e.target.value, horasDirectas: '' })} className={CLS} />
                            </td>
                            <td className="px-2 py-2 w-28">
                              <input type="time" value={r.turnoFim} onChange={e => setRow(idx, { turnoFim: e.target.value, horasDirectas: '' })} className={CLS} />
                            </td>
                            <td className="px-2 py-2 w-24">
                              {usandoHorario ? (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-center tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                                  {horas.toFixed(1)} h
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" min="0" step="0.5"
                                    value={r.horasDirectas}
                                    onChange={e => setRow(idx, { horasDirectas: e.target.value, turnoInicio: '', turnoFim: '' })}
                                    placeholder="0"
                                    className={`${CLS} text-center`}
                                  />
                                  <span className="text-xs text-slate-400 whitespace-nowrap">h</span>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 w-28">
                              <CurrencyInput value={r.valorHora ?? 0} onChange={v => setRow(idx, { valorHora: v })} />
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                              {fmtBRL(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Histórico de apontamentos/OS da obra */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest p-4 pb-2">Apontamentos registrados</p>
            {ordens.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-4 pb-4">Nenhum apontamento ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr><th className="text-left px-4 py-2 font-semibold">Data</th><th className="text-left px-4 py-2 font-semibold">Máquina</th><th className="text-left px-4 py-2 font-semibold">Operador</th><th className="text-right px-4 py-2 font-semibold">Horas</th><th className="text-right px-4 py-2 font-semibold">Total</th><th className="text-left px-4 py-2 font-semibold">Faturado</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ordens.map(o => (
                    <tr key={o.id} className="text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate(`/frota/ordens-servico/${o.id}`)}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDateISO(o.turno_data)}</td>
                      <td className="px-4 py-2">{o.maquina_nome ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{o.operador_nome ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.horas_trabalhadas != null ? `${o.horas_trabalhadas.toFixed(1)} h` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.valor_total != null ? fmtBRL(o.valor_total) : '—'}</td>
                      <td className="px-4 py-2">{o.nota_fiscal_id ? <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓ Faturado</span> : <span className="text-amber-600 dark:text-amber-400 text-xs">Pendente</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Aba Medições ── */}
      {!isNew && !isEditing && tab === 'medicoes' && (
        <div className="space-y-4">
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total apontado', value: fmtBRL(resumo.total_valor), sub: `${resumo.total_horas.toFixed(1)} h` },
                { label: 'Faturado', value: fmtBRL(resumo.faturado), sub: `${resumo.total_medicoes} medição(ões)` },
                { label: 'A faturar', value: fmtBRL(resumo.a_faturar), sub: `${resumo.horas_a_faturar.toFixed(1)} h pendentes`, highlight: true },
                { label: 'Máquinas', value: String(resumo.maquinas_alocadas), sub: 'alocadas' },
              ].map(card => (
                <div key={card.label} className={`rounded-xl border p-4 ${card.highlight ? 'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">{card.label}</p>
                  <p className={`text-lg font-bold mt-1 ${card.highlight ? 'text-brand-600 dark:text-brand-400' : 'text-slate-800 dark:text-slate-100'}`}>{card.value}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleGerarMedicao} disabled={gerando || !resumo || resumo.a_faturar <= 0}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              {gerando ? 'Gerando...' : record?.status === 'concluida' ? 'Gerar Nota Fiscal Final' : 'Gerar Nota Parcial'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {medicoes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 p-6 text-center">Nenhuma medição gerada ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr><th className="text-left px-4 py-2 font-semibold">Nº</th><th className="text-left px-4 py-2 font-semibold">Período</th><th className="text-right px-4 py-2 font-semibold">Horas</th><th className="text-right px-4 py-2 font-semibold">Valor</th><th className="text-left px-4 py-2 font-semibold">Status</th><th className="px-4 py-2"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {medicoes.map(m => (
                    <tr key={m.id} className="text-slate-700 dark:text-slate-200">
                      <td className="px-4 py-2 font-medium">#{m.numero}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{fmtDateISO(m.periodo_inicio)} – {fmtDateISO(m.periodo_fim)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.total_horas != null ? `${m.total_horas.toFixed(1)} h` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{m.valor_total != null ? fmtBRL(m.valor_total) : '—'}</td>
                      <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{m.status}</span></td>
                      <td className="px-4 py-2 text-right">
                        {m.nota_fiscal_id && <button onClick={() => navigate('/faturamento/nfsservice')} className="text-brand-600 dark:text-brand-400 hover:underline text-xs font-medium">Ver NFS-e</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Formulário (novo ou edição) ── */}
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
