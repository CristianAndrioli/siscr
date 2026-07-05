import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PessoaBusca } from '../../components/PessoaBusca';
import api from '../../services/api';
import { notasService, type NFItem } from '../../services/faturamentoService';
import { fmtBRL } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

/** Passos alinhados ao fluxo comum em ERPs brasileiros (emitente → destinatário → itens → condições → conferência). */
const STEPS = [
  { id: 0, title: 'Emitente', subtitle: 'Empresa e filial que emitem a nota' },
  { id: 1, title: 'Destinatário', subtitle: 'Cliente e dados fiscais básicos' },
  { id: 2, title: 'Produtos e serviços', subtitle: 'Itens da NF-e' },
  { id: 3, title: 'Condições', subtitle: 'Natureza da operação, frete e pagamento' },
  { id: 4, title: 'Conferência', subtitle: 'Revise e salve o rascunho' },
] as const;

const FORMA_PG_OPTIONS: { v: string; l: string }[] = [
  { v: '01', l: '01 — Dinheiro' },
  { v: '03', l: '03 — Cartão de crédito' },
  { v: '04', l: '04 — Cartão de débito' },
  { v: '15', l: '15 — Boleto bancário' },
  { v: '17', l: '17 — PIX' },
  { v: '99', l: '99 — Outros' },
];

const MOD_FRETE_OPTIONS: { v: number; l: string }[] = [
  { v: 0, l: '0 — Por conta do emitente (CIF)' },
  { v: 1, l: '1 — Por conta do destinatário (FOB)' },
  { v: 9, l: '9 — Sem frete' },
];

interface EmpresaRow {
  id: string;
  razao_social: string;
  cnpj?: string;
  codigo_municipio?: string | null;
  crt?: string | null;
  a1_cert_uploaded_at?: string | null;
  nfe_serie?: string | null;
  nfe_ambiente?: number | null;
}

interface FilialRow {
  id: string;
  nome: string;
  empresa_id: string;
  codigo_municipio?: string | null;
}

interface Produto {
  id: string;
  descricao: string;
  codigo: string;
  unidade: string;
  preco_venda: number;
  ncm: string | null;
  origem?: number | null;
  icms_cst?: string | null;
  icms_csosn?: string | null;
  pis_cst?: string | null;
  cofins_cst?: string | null;
}

const emptyItem = (): NFItem => ({
  descricao: '',
  quantidade: 1,
  valorUnitario: 0,
  desconto: 0,
  unidade: 'UN',
  cfop: '5102',
  ncm: '',
});

export function NfeNovaWizardPage() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [step, setStep] = useState(0);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [pessoaIe, setPessoaIe] = useState('');
  const [pessoaIndIe, setPessoaIndIe] = useState('9');
  const [pessoaCodMun, setPessoaCodMun] = useState('');

  const [form, setForm] = useState({
    naturezaOperacao: 'Venda de mercadorias',
    observacoes: '',
    desconto: 0,
    formaPagamento: '99',
    modFrete: 9,
    itens: [emptyItem()],
  });

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setError('');
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas'),
        api.get('/tenant/info/filiais'),
      ]);
      const elist = eRes.data.empresas ?? [];
      const flist = fRes.data.filiais ?? [];
      setEmpresas(elist);
      setFiliais(flist);
      const firstE = elist[0] as EmpresaRow | undefined;
      if (firstE) {
        setEmpresaId((prev) => prev || firstE.id);
      }
    } catch {
      setError('Não foi possível carregar empresas e filiais.');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!empresaId) return;
    const fList = filiais.filter((f) => f.empresa_id === empresaId);
    if (fList.length === 0) {
      setFilialId('');
      return;
    }
    if (filialId && !fList.some((f) => f.id === filialId)) {
      setFilialId('');
    }
  }, [empresaId, filiais, filialId]);

  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    api
      .get('/tenant/cadastros/produtos', { params: { empresaId, limit: 200, page: 0 } })
      .then((r) => {
        if (!cancelled) setProdutos(r.data.produtos ?? []);
      })
      .catch(() => {
        if (!cancelled) setProdutos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [empresaId]);

  useEffect(() => {
    if (!destinatarioId) {
      setPessoaIe('');
      setPessoaCodMun('');
      setPessoaIndIe('9');
      return;
    }
    api
      .get(`/tenant/cadastros/pessoas/${destinatarioId}`)
      .then((r) => {
        const p = r.data as Record<string, unknown>;
        setPessoaIe(String(p.inscricao_estadual ?? ''));
        setPessoaCodMun(String(p.codigo_municipio ?? ''));
        setPessoaIndIe(String(p.ind_ie_dest ?? '9'));
      })
      .catch(() => {});
  }, [destinatarioId]);

  const empresaSel = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const filiaisDaEmpresa = useMemo(() => filiais.filter((f) => f.empresa_id === empresaId), [filiais, empresaId]);

  const warningsEmitente = useMemo(() => {
    const w: string[] = [];
    if (!empresaSel) return w;
    if (!empresaSel.codigo_municipio?.trim()) w.push('Cadastre o código IBGE do município da empresa (Configurações → Empresas).');
    if (!empresaSel.a1_cert_uploaded_at) w.push('Certificado A1 ainda não enviado — necessário para transmitir à SEFAZ depois.');
    return w;
  }, [empresaSel]);

  const setItem = (idx: number, field: keyof NFItem, value: string | number) =>
    setForm((f) => ({ ...f, itens: f.itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));

  const fillFromProduto = (idx: number, prodId: string) => {
    const p = produtos.find((x) => x.id === prodId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      itens: f.itens.map((it, i) =>
        i === idx
          ? {
              ...it,
              produtoId: p.id,
              descricao: p.descricao,
              valorUnitario: p.preco_venda ?? 0,
              unidade: p.unidade ?? 'UN',
              ncm: p.ncm ?? '',
              origem: p.origem ?? 0,
              icmsCst: p.icms_cst ?? undefined,
              icmsCsosn: p.icms_csosn ?? undefined,
              pisCst: p.pis_cst ?? undefined,
              cofinsCst: p.cofins_cst ?? undefined,
            }
          : it,
      ),
    }));
  };

  const calcItemTotal = (item: NFItem) => item.quantidade * item.valorUnitario - (item.desconto ?? 0);
  const subtotal = form.itens.reduce((s, i) => s + calcItemTotal(i), 0);
  const total = subtotal - form.desconto;

  const canNext = (): boolean => {
    if (step === 0) return Boolean(empresaId);
    if (step === 1) return true;
    if (step === 2) return form.itens.some((i) => i.descricao.trim());
    if (step === 3) return Boolean(form.naturezaOperacao.trim());
    return true;
  };

  const handleSave = async () => {
    const validItens = form.itens.filter((i) => i.descricao.trim());
    if (!empresaId) {
      setError('Selecione a empresa.');
      return;
    }
    if (validItens.length === 0) {
      setError('Inclua pelo menos um item com descrição.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await notasService.create({
        tipo: 'nfe',
        empresaId,
        ...(filialId ? { filialId } : {}),
        destinatarioId: destinatarioId || undefined,
        naturezaOperacao: form.naturezaOperacao || undefined,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        formaPagamento: form.formaPagamento,
        modFrete: form.modFrete,
        itens: validItens,
      });
      if (destinatarioId && (pessoaIe || pessoaCodMun || pessoaIndIe !== '9')) {
        try {
          await api.put(`/tenant/cadastros/pessoas/${destinatarioId}`, {
            inscricaoEstadual: pessoaIe || undefined,
            indIeDest: pessoaIndIe,
            codigoMunicipio: pessoaCodMun || undefined,
          });
        } catch {
          /* não bloqueia — rascunho já foi salvo */
        }
      }
      navigate('/faturamento/nf-venda');
    } catch (err) {
      reportError('Erro ao salvar NF-e.', err, 'Assistente NF-e');
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Erro ao salvar. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/faturamento/nf-venda"
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            ← Voltar à lista de NF-e
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Nova NF-e assistida</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Siga os passos na ordem — o mesmo fluxo usado na maioria dos emissores e ERPs no Brasil.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <nav aria-label="Progresso" className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
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

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Onde esta nota será emitida?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A SEFAZ identifica o emitente pelo CNPJ da empresa (matriz) e, quando aplicável, pela filial operacional.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Empresa (matriz)</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Selecione…</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.razao_social}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Filial <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              {filiaisDaEmpresa.length > 0 ? (
                <select
                  value={filialId}
                  onChange={(e) => setFilialId(e.target.value)}
                  disabled={!empresaId}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value="">Só matriz — sem filial nesta nota</option>
                  {filiaisDaEmpresa.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                  Nenhuma filial cadastrada. A nota fica só na <strong className="text-slate-800 dark:text-slate-200">matriz</strong>.
                </p>
              )}
            </div>
            {warningsEmitente.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold">Antes de transmitir à SEFAZ, verifique:</p>
                <ul className="list-disc list-inside text-amber-800 dark:text-amber-300">
                  {warningsEmitente.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Quem é o destinatário?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Busque um cadastro existente. Os dados fiscais abaixo são usados na NF-e; você pode ajustá-los e gravar no cadastro ao final.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cliente</label>
              <PessoaBusca
                value={destinatarioId}
                displayValue={destinatarioNome}
                onChange={(id, nome) => {
                  setDestinatarioId(id);
                  setDestinatarioNome(nome);
                }}
                tipoCadastro="cliente"
                placeholder="Nome ou CPF/CNPJ do cliente…"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Inscrição estadual</label>
                <input
                  value={pessoaIe}
                  onChange={(e) => setPessoaIe(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="Se aplicável"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Indicador de IE</label>
                <select
                  value={pessoaIndIe}
                  onChange={(e) => setPessoaIndIe(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="1">1 — Contribuinte ICMS</option>
                  <option value="2">2 — Isento</option>
                  <option value="9">9 — Não contribuinte</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Código município (IBGE, 7 dígitos)
                </label>
                <input
                  value={pessoaCodMun}
                  onChange={(e) => setPessoaCodMun(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 font-mono"
                  placeholder="Ex.: 3550308"
                  maxLength={7}
                />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Itens da nota</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selecione produtos cadastrados para preencher NCM e tributação padrão, ou digite manualmente.
            </p>
            <div className="space-y-3">
              {form.itens.map((item, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-4 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={item.produtoId ?? ''}
                      onChange={(e) => fillFromProduto(idx, e.target.value)}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 min-w-[160px]"
                    >
                      <option value="">Produto…</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.codigo, p.descricao].filter(Boolean).join(' — ') || p.descricao || 'Produto'}
                        </option>
                      ))}
                    </select>
                    <input
                      value={item.descricao}
                      onChange={(e) => setItem(idx, 'descricao', e.target.value)}
                      placeholder="Descrição *"
                      className="flex-1 min-w-[120px] border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                    {form.itens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }))}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Qtd</label>
                      <input
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => setItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                        className="w-full border rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Un.</label>
                      <input
                        value={item.unidade}
                        onChange={(e) => setItem(idx, 'unidade', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">CFOP</label>
                      <input
                        value={item.cfop ?? ''}
                        onChange={(e) => setItem(idx, 'cfop', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1 text-sm font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">NCM</label>
                      <input
                        value={item.ncm ?? ''}
                        onChange={(e) => setItem(idx, 'ncm', e.target.value)}
                        className="w-full border rounded-lg px-2 py-1 text-sm font-mono bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <CurrencyInput
                      value={item.valorUnitario}
                      onChange={(v) => setItem(idx, 'valorUnitario', v)}
                      className="w-36 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-slate-800"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {fmtBRL(calcItemTotal(item))}
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, itens: [...f.itens, emptyItem()] }))}
                className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline"
              >
                + Adicionar linha
              </button>
            </div>
            <div className="flex justify-end gap-4 text-sm font-bold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Subtotal: {fmtBRL(subtotal)}</span>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Condições da operação</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Natureza da operação</label>
                <input
                  value={form.naturezaOperacao}
                  onChange={(e) => setForm((f) => ({ ...f, naturezaOperacao: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Modalidade de frete</label>
                <select
                  value={form.modFrete}
                  onChange={(e) => setForm((f) => ({ ...f, modFrete: Number(e.target.value) }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  {MOD_FRETE_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Forma de pagamento (NF-e)</label>
                <select
                  value={form.formaPagamento}
                  onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  {FORMA_PG_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Desconto global (R$)</label>
                <CurrencyInput
                  value={form.desconto}
                  onChange={(v) => setForm((f) => ({ ...f, desconto: v }))}
                  className="w-full max-w-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
                />
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Conferência</h2>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Empresa</dt>
                <dd className="font-medium text-right">{empresaSel?.razao_social ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Filial</dt>
                <dd className="font-medium text-right">
                  {filialId ? filiaisDaEmpresa.find((f) => f.id === filialId)?.nome ?? '—' : 'Matriz (sem filial)'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Destinatário</dt>
                <dd className="font-medium text-right">{destinatarioNome || 'Não informado'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Natureza</dt>
                <dd className="font-medium text-right">{form.naturezaOperacao}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Itens</dt>
                <dd className="font-medium text-right">{form.itens.filter((i) => i.descricao.trim()).length} linha(s)</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1">
                <dt className="text-slate-500">Total da nota</dt>
                <dd className="text-lg font-bold text-brand-600 dark:text-brand-400">{fmtBRL(total)}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ao salvar, a nota fica como <strong>rascunho</strong>. A transmissão à SEFAZ será feita em outra etapa do sistema.
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Voltar
            </button>
          ) : (
            <Link
              to="/faturamento/nf-venda"
              className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center"
            >
              Cancelar
            </Link>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => canNext() && setStep((s) => s + 1)}
              className="px-5 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NfeNovaWizardPage;
