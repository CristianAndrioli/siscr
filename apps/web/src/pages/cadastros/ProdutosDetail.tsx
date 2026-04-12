import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { produtosService, type Produto, type ProdutoForm } from '../../services/cadastros/produtos';
import { fmtBRL } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { FieldHelp } from '../../components/cadastros/FieldHelp';
import { NcmSearchInput } from '../../components/cadastros/NcmSearchInput';
import {
  ORIGEM_MERCADORIA,
  ICMS_CST_SUGESTOES,
  ICMS_CSOSN_SUGESTOES,
  PIS_COFINS_CST_SUGESTOES,
  labelOrigemMercadoria,
} from '../../utils/nfeProdutoTaxOptions';

const UNIDADES = ['UN', 'CX', 'KG', 'LT', 'MT', 'PC', 'PAR', 'RL', 'SC', 'TON'];

const INPUT_CLS =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

const STEPS = [
  { id: 0, title: 'Dados básicos', subtitle: 'Identificação, unidade e preços' },
  { id: 1, title: 'Classificação fiscal', subtitle: 'NCM e origem da mercadoria' },
  { id: 2, title: 'ICMS', subtitle: 'CST e CSOSN conforme o regime tributário' },
  { id: 3, title: 'PIS, COFINS e CEST', subtitle: 'Contribuições e substituição tributária' },
] as const;

const KNOWN_ICMS_CST = new Set(ICMS_CST_SUGESTOES.map((o) => o.value).filter(Boolean));
const KNOWN_CSOSN = new Set(ICMS_CSOSN_SUGESTOES.map((o) => o.value).filter(Boolean));

function selectValueIcmsCst(v: string) {
  if (!v) return '';
  return KNOWN_ICMS_CST.has(v) ? v : '__custom__';
}

function selectValueCsosn(v: string) {
  if (!v) return '';
  return KNOWN_CSOSN.has(v) ? v : '__custom__';
}

const EMPTY: ProdutoForm = {
  sku: '',
  descricao: '',
  unidade: 'UN',
  precoVenda: 0,
  precoCusto: 0,
  ncm: '',
  origem: 0,
  cest: '',
  icmsCst: '',
  icmsCsosn: '',
  pisCst: '07',
  cofinsCst: '07',
  ativo: true,
};

export function ProdutosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';
  const { reportError } = useErrorNotification();

  const [form, setForm] = useState<ProdutoForm>(EMPTY);
  const [record, setRecord] = useState<Produto | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    produtosService
      .get(id!)
      .then((data) => {
        setRecord(data);
        setForm({
          sku: data.sku ?? '',
          descricao: data.descricao,
          unidade: data.unidade,
          precoVenda: data.preco_venda,
          precoCusto: data.preco_custo ?? 0,
          ncm: data.ncm ?? '',
          origem: data.origem ?? 0,
          cest: data.cest ?? '',
          icmsCst: data.icms_cst ?? '',
          icmsCsosn: data.icms_csosn ?? '',
          pisCst: data.pis_cst ?? '07',
          cofinsCst: data.cofins_cst ?? '07',
          ativo: data.ativo === 1,
        });
      })
      .catch(() => setError('Erro ao carregar produto.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = <K extends keyof ProdutoForm>(field: K, value: ProdutoForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validateStep0 = () => {
    if (!form.descricao.trim()) {
      setError('Informe a descrição do produto.');
      return false;
    }
    if (form.precoVenda < 0) {
      setError('Preço de venda inválido.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep0()) return;
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await produtosService.create(form);
        navigate('/cadastros/produtos');
      } else {
        await produtosService.update(id!, form);
        setIsEditing(false);
        setStep(0);
        const updated = await produtosService.get(id!);
        setRecord(updated);
      }
    } catch (err) {
      reportError('Erro ao salvar produto. Verifique os dados e tente novamente.', err, 'Cadastro de Produto');
      setError('Erro ao salvar. Consulte o log de erros para mais detalhes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Deseja excluir este produto?')) return;
    try {
      await produtosService.delete(id!);
      navigate('/cadastros/produtos');
    } catch (err) {
      reportError('Erro ao excluir produto.', err, 'Cadastro de Produto');
      setError('Erro ao excluir. Consulte o log de erros para mais detalhes.');
    }
  };

  const origemLabel = useMemo(() => labelOrigemMercadoria(form.origem ?? 0), [form.origem]);

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
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/cadastros/produtos')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Produtos
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isNew ? 'Novo Produto' : (record?.descricao ?? 'Detalhe')}
          </h1>
        </div>
        {!isNew && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(true);
                setStep(0);
              }}
              className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Editar
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Excluir
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!isNew && !isEditing && record && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold">
              # {record.codigo}
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {[
              { label: 'SKU', value: record.sku || '—' },
              { label: 'Unidade', value: record.unidade },
              { label: 'Descrição', value: record.descricao },
              { label: 'NCM', value: record.ncm ?? '—' },
              { label: 'Origem', value: labelOrigemMercadoria(record.origem ?? 0) },
              { label: 'CEST', value: record.cest ?? '—' },
              { label: 'ICMS CST', value: record.icms_cst ?? '—' },
              { label: 'ICMS CSOSN', value: record.icms_csosn ?? '—' },
              { label: 'PIS CST', value: record.pis_cst ?? '—' },
              { label: 'COFINS CST', value: record.cofins_cst ?? '—' },
              { label: 'Preço de Venda', value: record.preco_venda != null ? fmtBRL(record.preco_venda) : '—' },
              { label: 'Preço de Custo', value: record.preco_custo != null ? fmtBRL(record.preco_custo) : '—' },
              { label: 'Situação', value: record.ativo === 1 ? 'Ativo' : 'Inativo' },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isNew && record && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Código:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">#{record.codigo}</span>
            </div>
          )}

          <nav aria-label="Etapas do cadastro" className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => i <= step && setStep(i)}
                className={`flex-1 min-w-[140px] text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  i === step
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-1 ring-brand-500/30'
                    : i < step
                      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-70'
                }`}
              >
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Passo {i + 1}</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{s.subtitle}</p>
              </button>
            ))}
          </nav>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
            {step === 0 && (
              <>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Identificação e preços</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SKU
                      <FieldHelp text="Código interno opcional (SKU). Útil para integrações e etiquetas; não substitui o código numérico do sistema." />
                    </label>
                    <input
                      type="text"
                      value={form.sku ?? ''}
                      onChange={(e) => set('sku', e.target.value)}
                      placeholder="Ex: MESA-G-NAT, REF-001"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Unidade <span className="text-red-500">*</span>
                      <FieldHelp text="Unidade de medida comercializada (UN, KG, CX…). Será enviada nos itens da NF-e." />
                    </label>
                    <select
                      value={form.unidade}
                      onChange={(e) => set('unidade', e.target.value)}
                      required
                      className={INPUT_CLS}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Descrição <span className="text-red-500">*</span>
                      <FieldHelp text="Nome do produto como aparecerá na nota fiscal e nos relatórios." />
                    </label>
                    <input
                      type="text"
                      value={form.descricao}
                      onChange={(e) => set('descricao', e.target.value)}
                      required
                      placeholder="Descrição do produto"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Preço de Venda <span className="text-red-500">*</span>
                      <FieldHelp text="Valor de referência para vendas. Pode ser ajustado no momento da emissão da NF-e." />
                    </label>
                    <CurrencyInput value={form.precoVenda} onChange={(v) => set('precoVenda', v)} required />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Preço de Custo
                      <FieldHelp text="Custo de aquisição ou produção — uso interno e margem; não é enviado na NF-e de venda." />
                    </label>
                    <CurrencyInput value={form.precoCusto} onChange={(v) => set('precoCusto', v)} />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={form.ativo}
                      onChange={(e) => set('ativo', e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                    />
                    <label htmlFor="ativo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Produto ativo
                      <FieldHelp text="Desmarque para inativar o cadastro sem apagar o histórico." />
                    </label>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">NCM e origem</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  O NCM classifica a mercadoria para a NF-e; a origem indica se o item é nacional ou importado. Os valores
                  gravados são os códigos exigidos pela SEFAZ.
                </p>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NCM (8 dígitos)
                    <FieldHelp text="Nomenclatura Comum do Mercosul. Use a pesquisa à direita para localizar pelo texto oficial da tabela — o sistema grava só os 8 dígitos." />
                  </label>
                  <NcmSearchInput value={form.ncm ?? ''} onChange={(ncm) => set('ncm', ncm)} />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Origem da mercadoria
                    <FieldHelp text="Campo de origem da NF-e (código 0 a 8). Na nota é enviado apenas o número; escolha pela descrição abaixo." />
                  </label>
                  <select
                    value={form.origem ?? 0}
                    onChange={(e) => set('origem', Number(e.target.value))}
                    className={INPUT_CLS}
                  >
                    {ORIGEM_MERCADORIA.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Valor gravado: {form.origem ?? 0} — {origemLabel}</p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">ICMS no produto</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Empresas no <strong>Lucro Presumido/Real</strong> usam em geral <strong>CST</strong>; no{' '}
                  <strong>Simples Nacional</strong> usa-se <strong>CSOSN</strong>. Preencha o que o seu contador indicar — os
                  códigos são os da NF-e.
                </p>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ICMS — CST (situação tributária)
                    <FieldHelp text="Código de Situação Tributária do ICMS (até 3 caracteres). Escolha uma sugestão comum ou informe outro código válido para a operação." />
                  </label>
                  <select
                    value={selectValueIcmsCst(form.icmsCst ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') set('icmsCst', '');
                      else set('icmsCst', v);
                    }}
                    className={INPUT_CLS}
                  >
                    {ICMS_CST_SUGESTOES.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    <option value="__custom__">Outro código (digitar)</option>
                  </select>
                  {selectValueIcmsCst(form.icmsCst ?? '') === '__custom__' && (
                    <input
                      type="text"
                      value={form.icmsCst ?? ''}
                      onChange={(e) => set('icmsCst', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 3))}
                      placeholder="Ex.: 61"
                      className={`${INPUT_CLS} mt-2 font-mono`}
                    />
                  )}
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ICMS — CSOSN (Simples Nacional)
                    <FieldHelp text="Código de Situação da Operação — Simples Nacional (3 dígitos). Deixe em branco se a empresa não estiver no Simples." />
                  </label>
                  <select
                    value={selectValueCsosn(form.icmsCsosn ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') set('icmsCsosn', '');
                      else set('icmsCsosn', v);
                    }}
                    className={INPUT_CLS}
                  >
                    {ICMS_CSOSN_SUGESTOES.map((o) => (
                      <option key={o.value || 'empty-cs'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    <option value="__custom__">Outro código (digitar)</option>
                  </select>
                  {selectValueCsosn(form.icmsCsosn ?? '') === '__custom__' && (
                    <input
                      type="text"
                      value={form.icmsCsosn ?? ''}
                      onChange={(e) => set('icmsCsosn', e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="Ex.: 102"
                      className={`${INPUT_CLS} mt-2 font-mono`}
                    />
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">PIS, COFINS e CEST</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  PIS e COFINS usam CST próprio na NF-e. O CEST identifica mercadorias sujeitas à substituição tributária de
                  ICMS/ST quando aplicável.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      PIS — CST
                      <FieldHelp text="Código de Situação Tributária do PIS (2 dígitos). O valor gravado é o enviado na NF-e." />
                    </label>
                    <select
                      value={form.pisCst ?? '07'}
                      onChange={(e) => set('pisCst', e.target.value)}
                      className={INPUT_CLS}
                    >
                      {PIS_COFINS_CST_SUGESTOES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      COFINS — CST
                      <FieldHelp text="Código de Situação Tributária da COFINS (2 dígitos). Em muitos casos acompanha o PIS." />
                    </label>
                    <select
                      value={form.cofinsCst ?? '07'}
                      onChange={(e) => set('cofinsCst', e.target.value)}
                      className={INPUT_CLS}
                    >
                      {PIS_COFINS_CST_SUGESTOES.map((o) => (
                        <option key={`c-${o.value}`} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CEST
                      <FieldHelp text="Código Especificador da ST (7 dígitos). Obrigatório apenas para mercadorias sujeitas à substituição tributária conforme convenções estaduais. Consulte a tabela do seu estado." />
                    </label>
                    <input
                      type="text"
                      value={form.cest ?? ''}
                      onChange={(e) => set('cest', e.target.value.replace(/\D/g, '').slice(0, 7))}
                      maxLength={7}
                      placeholder="7 dígitos (se aplicável)"
                      className={`${INPUT_CLS} font-mono`}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => isNew ? navigate('/cadastros/produtos') : setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
              <div className="flex gap-2">
                {step < STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 0 && !validateStep0()) return;
                      setError('');
                      setStep((s) => s + 1);
                    }}
                    className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
                  >
                    Continuar
                  </button>
                )}
                {step === STEPS.length - 1 && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 rounded-lg"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default ProdutosDetail;
