import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  reguaCobrancaService,
  type ReguaCobrancaForm,
  type ReguaCobrancaFormEtapa,
  type ReguaPerfil,
} from '../../services/financeiro';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const PERFIL_OPTIONS: { value: ReguaPerfil; label: string }[] = [
  { value: 'geral', label: 'Geral' },
  { value: 'novo_cliente', label: 'Novo cliente' },
  { value: 'bom_pagador', label: 'Bom pagador' },
  { value: 'pagador_duvidoso', label: 'Pagador duvidoso' },
  { value: 'mau_pagador', label: 'Mau pagador' },
];

const CANAIS: { value: ReguaCobrancaFormEtapa['canal']; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

function emptyEtapa(ordem: number): ReguaCobrancaFormEtapa {
  return {
    ordem,
    offsetDias: ordem === 1 ? -5 : (ordem - 1) * 5,
    canal: 'email',
    mensagemTemplate:
      'Olá {cliente}, referente ao título {descricao} (venc. {vencimento}). Variáveis: {valor}, {empresa}.',
  };
}

const EMPTY_FORM: ReguaCobrancaForm = {
  nome: '',
  perfil: 'geral',
  descricao: '',
  ativo: true,
  ehPadrao: false,
  etapas: [emptyEtapa(1), { ...emptyEtapa(2), ordem: 2, offsetDias: 0, canal: 'email' }],
};

function offsetLabel(d: number): string {
  if (d < 0) return `${Math.abs(d)} dia(s) antes do vencimento`;
  if (d === 0) return 'No dia do vencimento';
  return `${d} dia(s) após o vencimento`;
}

function canalIcon(canal: ReguaCobrancaFormEtapa['canal']) {
  if (canal === 'email') {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    );
  }
  if (canal === 'sms') {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.24 1.003 2.25 2.25 2.25h13.5c1.246 0 2.25-1.01 2.25-2.25V6.75c0-1.24-1.004-2.25-2.25-2.25H5.25c-1.247 0-2.25 1.01-2.25 2.25v12.002z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm7.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm5.25 0c0 5.385-4.365 9.75-9.75 9.75S2.625 17.385 2.625 12 6.99 2.25 12.375 2.25c1.134 0 2.223.194 3.243.546M16.5 6.75v4.5m0 0v4.5m0-4.5h4.5m-4.5 0h-4.5" />
    </svg>
  );
}

export default function ReguaCobrancaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'nova';
  const { reportError } = useErrorNotification();

  const [form, setForm] = useState<ReguaCobrancaForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew || !id) return;
    reguaCobrancaService
      .get(id)
      .then((r) => {
        const etapas =
          r.etapas?.map((e, i) => ({
            ordem: e.ordem ?? i + 1,
            offsetDias: e.offset_dias,
            canal: e.canal,
            mensagemTemplate: e.mensagem_template ?? '',
          })) ?? [];
        setForm({
          nome: r.nome,
          perfil: r.perfil,
          descricao: r.descricao ?? '',
          ativo: r.ativo === 1,
          ehPadrao: r.eh_padrao === 1,
          etapas: etapas.length > 0 ? etapas : [emptyEtapa(1)],
        });
      })
      .catch(() => setError('Erro ao carregar régua.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const sortedPreview = useMemo(() => {
    return [...form.etapas].sort((a, b) => a.offsetDias - b.offsetDias || a.ordem - b.ordem);
  }, [form.etapas]);

  const setField = <K extends keyof ReguaCobrancaForm>(key: K, value: ReguaCobrancaForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateEtapa = (index: number, patch: Partial<ReguaCobrancaFormEtapa>) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const addEtapa = () => {
    setForm((prev) => {
      const nextOrdem = prev.etapas.length + 1;
      return { ...prev, etapas: [...prev.etapas, emptyEtapa(nextOrdem)] };
    });
  };

  const removeEtapa = (index: number) => {
    setForm((prev) => ({
      ...prev,
      etapas: prev.etapas.filter((_, i) => i !== index).map((e, i) => ({ ...e, ordem: i + 1 })),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setError('Informe o nome da régua.');
      return;
    }
    const payload: ReguaCobrancaForm = {
      ...form,
      etapas: form.etapas.map((row, i) => ({
        ...row,
        ordem: i + 1,
      })),
    };
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const { id: newId } = await reguaCobrancaService.create(payload);
        navigate(`/financeiro/regua-cobranca/${newId}`, { replace: true });
      } else {
        await reguaCobrancaService.update(id!, payload);
      }
    } catch (err) {
      reportError('Erro ao salvar régua de cobrança.', err, 'Régua de cobrança');
      setError('Não foi possível salvar. Verifique os dados ou o log de erros.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    if (!window.confirm('Excluir esta régua? Títulos que a usavam ficarão sem régua específica.')) return;
    try {
      await reguaCobrancaService.remove(id);
      navigate('/financeiro/regua-cobranca');
    } catch (err) {
      reportError('Erro ao excluir régua.', err, 'Régua de cobrança');
      setError('Não foi possível excluir.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/financeiro/regua-cobranca')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Régua de cobrança
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
            {isNew ? 'Nova régua' : form.nome || 'Editar régua'}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:underline flex-none"
          >
            Excluir
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identificação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setField('nome', e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                placeholder="Ex.: Novos clientes — lembrete suave"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Perfil</label>
              <select
                value={form.perfil}
                onChange={(e) => setField('perfil', e.target.value as ReguaPerfil)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
              >
                {PERFIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setField('ativo', e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Régua ativa
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ehPadrao}
                  onChange={(e) => setField('ehPadrao', e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Usar como régua padrão do tenant
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Títulos sem régua específica podem usar a marcada como padrão quando houver automação.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição (opcional)</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setField('descricao', e.target.value)}
                rows={2}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                placeholder="Objetivo desta régua..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Etapas</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Número negativo = antes do vencimento; zero = no dia; positivo = após o vencimento.
              </p>
            </div>
            <button
              type="button"
              onClick={addEtapa}
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              + Adicionar etapa
            </button>
          </div>

          <div className="space-y-4">
            {form.etapas.map((row, index) => (
              <div
                key={index}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">Etapa {index + 1}</span>
                  {form.etapas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEtapa(index)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Offset (dias)</label>
                    <input
                      type="number"
                      value={row.offsetDias}
                      onChange={(e) => updateEtapa(index, { offsetDias: Number(e.target.value) })}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">{offsetLabel(row.offsetDias)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Canal</label>
                    <select
                      value={row.canal}
                      onChange={(e) =>
                        updateEtapa(index, { canal: e.target.value as ReguaCobrancaFormEtapa['canal'] })
                      }
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                    >
                      {CANAIS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mensagem (template)</label>
                  <textarea
                    value={row.mensagemTemplate}
                    onChange={(e) => updateEtapa(index, { mensagemTemplate: e.target.value })}
                    rows={3}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Pré-visualização da linha do tempo</p>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max items-stretch">
              {sortedPreview.map((row, i) => (
                <div key={`${row.ordem}-${row.offsetDias}-${i}`} className="flex items-center gap-3 shrink-0">
                  <div className="w-28 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-3 text-center shadow-sm">
                    <div className="text-[10px] font-mono text-slate-400 mb-1">{row.offsetDias}</div>
                    <div className="text-slate-600 dark:text-slate-300 flex justify-center">{canalIcon(row.canal)}</div>
                    <div className="text-[10px] mt-1 text-slate-500 truncate max-w-full">{row.canal}</div>
                  </div>
                  {i < sortedPreview.length - 1 && (
                    <span className="text-slate-300 dark:text-slate-600 select-none" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Ordem visual por offset (do mais cedo para o mais tarde em relação ao vencimento).
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/financeiro/regua-cobranca')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
