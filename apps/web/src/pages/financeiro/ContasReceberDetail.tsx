import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  contasReceberService,
  reguaCobrancaService,
  type ContaReceber,
  type ContaForm,
  type ReguaCobrancaListItem,
  type PagamentoHistorico,
} from '../../services/financeiro';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { bancarioService, type ContaBancaria } from '../../services/bancario';

import { fmtBRL as fmt, fmtDate } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  parcialmente_pago: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  parcialmente_pago: 'Parcialmente pago',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const CATEGORIAS = ['Venda', 'Serviço', 'Aluguel', 'Comissão', 'Financiamento', 'Faturamento', 'Outros'];
const ESPECIES = ['DM', 'DS', 'NP', 'NS', 'LC', 'CH', 'BO', 'DP', 'RC', 'OUT'];
const ESPECIES_LABEL: Record<string, string> = {
  DM: 'DM - Duplicata Mercantil', DS: 'DS - Duplicata de Serviço',
  NP: 'NP - Nota Promissória', NS: 'NS - Nota de Seguro',
  LC: 'LC - Letra de Câmbio', CH: 'CH - Cheque',
  BO: 'BO - Boleto', DP: 'DP - Duplicata Rural',
  RC: 'RC - Recibo', OUT: 'OUT - Outros',
};
const MOEDAS = ['BRL', 'USD', 'EUR'];
const EMPTY: ContaForm = {
  pessoaId: '', descricao: '', valor: 0, vencimento: '',
  categoria: '', observacoes: '', reguaId: '',
  nr_documento: '',
  especie: 'DM', data_emissao: '', data_lancamento: new Date().toISOString().slice(0, 10), moeda: 'BRL',
};

export function ContasReceberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';
  const { reportError } = useErrorNotification();

  const [record, setRecord] = useState<ContaReceber | null>(null);
  const [form, setForm] = useState<ContaForm>({ ...EMPTY, vencimento: new Date().toISOString().slice(0, 10) });
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Modal "marcar como pago"
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [pagarData, setPagarData] = useState({ dataPagamento: new Date().toISOString().slice(0, 10), valorPago: 0, contaBancariaId: '' });
  const [pagamentos, setPagamentos] = useState<PagamentoHistorico[]>([]);

  // Parcelamento inline
  const [parcelar, setParcelar] = useState(false);
  type Parcela = { vencimento: string; valor: number };
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  const gerarParcelas = (n: number, intervalo = 30) => {
    if (!form.valor || form.valor <= 0) return;
    const base = Math.floor((form.valor / n) * 100) / 100;
    const resto = Math.round((form.valor - base * n) * 100) / 100;
    const hoje = form.data_lancamento || new Date().toISOString().slice(0, 10);
    const novas: Parcela[] = Array.from({ length: n }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + intervalo * (i + 1));
      return { vencimento: d.toISOString().slice(0, 10), valor: i === n - 1 ? base + resto : base };
    });
    setParcelas(novas);
  };

  const somaOk = parcelas.length > 0 && Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - (form.valor || 0)) < 0.02;
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [reguas, setReguas] = useState<ReguaCobrancaListItem[]>([]);

  useEffect(() => {
    reguaCobrancaService.list().then((r) => setReguas(r.reguas ?? [])).catch(() => {});
    pessoasService
      .list({ search: '', page: 0, limit: 200 })
      .then((r) => setPessoas(r.pessoas))
      .catch(() => {});
    bancarioService.listContas().then(setContasBancarias).catch(() => {});
    if (!isNew) {
      contasReceberService.listarPagamentos(id!).then(setPagamentos).catch(() => {});
      contasReceberService.get(id!)
        .then(data => {
          setRecord(data);
          setForm({
            pessoaId: data.pessoa_id,
            descricao: data.descricao,
            valor: data.valor,
            vencimento: data.vencimento,
            categoria: data.categoria ?? '',
            observacoes: data.observacoes ?? '',
            nr_documento: data.nr_documento ?? '',
            especie: data.especie ?? 'DM',
            data_emissao: data.data_emissao ?? '',
            data_lancamento: data.data_lancamento ?? new Date().toISOString().slice(0, 10),
            moeda: data.moeda ?? 'BRL',
            reguaId: data.regua_id ?? '',
          });
          const saldo = Math.max(0, (data.valor ?? 0) - (data.valor_pago ?? 0));
          setPagarData(prev => ({ ...prev, valorPago: saldo }));
        })
        .catch(() => setError('Erro ao carregar registro.'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const set = (field: keyof ContaForm, value: string | number | null) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pessoaId) { setError('Selecione o cliente.'); return; }
    if (!form.descricao) { setError('Informe a descrição.'); return; }
    if (!form.valor || form.valor <= 0) { setError('Informe um valor positivo.'); return; }

    // Modo parcelado: valida parcelas
    if (isNew && parcelar) {
      if (parcelas.length < 2) { setError('Adicione ao menos 2 parcelas.'); return; }
      if (!somaOk) { setError('A soma das parcelas deve ser igual ao valor total.'); return; }
      if (parcelas.some(p => !p.vencimento)) { setError('Informe o vencimento de todas as parcelas.'); return; }
      setSaving(true); setError('');
      try {
        const base: ContaForm = { ...form, reguaId: form.reguaId || null };
        await contasReceberService.criarLote(
          parcelas.map((p, i) => ({
            ...base,
            valor: p.valor,
            vencimento: p.vencimento,
            descricao: `${form.descricao} (${i + 1}/${parcelas.length})`,
            parcela: i + 1,
            total_parcelas: parcelas.length,
          }))
        );
        navigate('/financeiro/contas-receber');
      } catch (err) {
        const msg = formatApiError(err, 'Erro ao criar parcelas.');
        reportError(msg, err, 'Contas a Receber');
        setError(msg);
      } finally { setSaving(false); }
      return;
    }

    if (!form.vencimento) { setError('Informe o vencimento.'); return; }

    setSaving(true);
    setError('');
    const payload: ContaForm = {
      ...form,
      reguaId: form.reguaId ? form.reguaId : null,
    };
    try {
      if (isNew) {
        await contasReceberService.create(payload);
        navigate('/financeiro/contas-receber');
      } else {
        await contasReceberService.update(id!, payload);
        const updated = await contasReceberService.get(id!);
        setRecord(updated);
        setIsEditing(false);
      }
    } catch (err) {
      reportError('Erro ao salvar conta a receber. Verifique os dados.', err, 'Contas a Receber');
      setError('Erro ao salvar. Consulte o log de erros para mais detalhes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      await contasReceberService.delete(id!);
      navigate('/financeiro/contas-receber');
    } catch (err) {
      reportError('Erro ao excluir conta a receber.', err, 'Contas a Receber');
      setError('Erro ao excluir. Consulte o log de erros para mais detalhes.');
    }
  };

  const handlePagar = async () => {
    if (!pagarData.valorPago || pagarData.valorPago <= 0) {
      setError('Informe um valor de recebimento maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await contasReceberService.marcarPago(id!, pagarData.dataPagamento, pagarData.valorPago, pagarData.contaBancariaId || undefined);
      const [updated, historico] = await Promise.all([
        contasReceberService.get(id!),
        contasReceberService.listarPagamentos(id!),
      ]);
      setRecord(updated);
      setPagamentos(historico);
      setPagarData(prev => ({ ...prev, valorPago: Math.max(0, (updated.valor ?? 0) - (updated.valor_pago ?? 0)) }));
      setShowPagarModal(false);
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao registrar recebimento.');
      reportError(msg, err, 'Contas a Receber');
      setError(msg);
    } finally {
      setSaving(false);
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
    <div className="max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/financeiro/contas-receber')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Contas a Receber
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isNew ? 'Nova Conta a Receber' : (record?.descricao ?? 'Detalhe')}
          </h1>
          {record && (
            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[record.status] ?? ''}`}>
              {STATUS_LABEL[record.status] ?? record.status}
            </span>
          )}
        </div>
        {!isNew && !isEditing && record && (
          <div className="flex gap-2 flex-none">
            {(record.status === 'pendente' || record.status === 'parcialmente_pago') && (
              <button
                onClick={() => setShowPagarModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Recebido
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Editar
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Excluir
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Visualização */}
      {!isNew && !isEditing && record && (
        <>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          {record.codigo && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold">
                # {record.codigo}
              </span>
            </div>
          )}
          {/* Parcelas — se gerado por faturamento */}
          {record.total_parcelas && record.total_parcelas > 1 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                Parcela {record.parcela}/{record.total_parcelas}
              </span>
              {record.nota_fiscal_id && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                  NF vinculada
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {/* Seção: Identificação */}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Identificação</p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                {[
                  { label: 'Nr. Documento', value: record.nr_documento || '—' },
                  { label: 'Espécie', value: ESPECIES_LABEL[record.especie ?? ''] ?? record.especie ?? '—' },
                  { label: 'Moeda', value: record.moeda || 'BRL' },
                  { label: 'Categoria', value: record.categoria || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Seção: Datas */}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Datas</p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                {[
                  { label: 'Emissão', value: fmtDate(record.data_emissao) },
                  { label: 'Lançamento', value: fmtDate(record.data_lancamento) },
                  { label: 'Vencimento', value: fmtDate(record.vencimento) },
                  { label: 'Pagamento', value: fmtDate(record.data_pagamento) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Seção: Valores */}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Valores</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {[
                  { label: 'Cliente', value: record.cliente || '—' },
                  { label: 'Valor Total', value: fmt(record.valor) },
                  { label: 'Total Recebido', value: record.valor_pago ? fmt(record.valor_pago) : '—' },
                  {
                    label: 'Saldo a Receber',
                    value: record.status !== 'pago'
                      ? fmt(Math.max(0, (record.valor ?? 0) - (record.valor_pago ?? 0)))
                      : '—',
                  },
                  {
                    label: 'Régua de cobrança',
                    value:
                      record.regua_nome ||
                      (record.regua_id ? '—' : 'Automático (régua padrão do tenant, se houver)'),
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                    <dd className={`mt-1 text-sm font-semibold ${label === 'Saldo a Receber' && record.status !== 'pago' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-slate-100'}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {record.observacoes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observações</dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.observacoes}</dd>
              </div>
            )}
          </div>
        </div>

        {/* Histórico de Recebimentos */}
        {pagamentos.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Histórico de Recebimentos</p>
            <div className="space-y-2">
              {pagamentos.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold flex-none">{i + 1}</span>
                    <div>
                      <p className="text-sm text-slate-800 dark:text-slate-100">{fmtDate(p.data_pagamento)}</p>
                      {p.conta_bancaria_nome && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">{p.conta_bancaria_nome}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(p.valor)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total recebido</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(record.valor_pago ?? 0)}</span>
              </div>
              {record.status !== 'pago' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saldo restante</span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">{fmt(Math.max(0, (record.valor ?? 0) - (record.valor_pago ?? 0)))}</span>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}

      {/* Formulário */}
      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="space-y-6">
            {/* ── Seção: Identificação ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Identificação</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.pessoaId}
                    onChange={e => set('pessoaId', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione o cliente...</option>
                    {pessoas.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {pessoas.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Nenhuma pessoa cadastrada. <a href="/cadastros/pessoas/novo" className="underline">Cadastrar pessoa</a>
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Descrição <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.descricao}
                    onChange={e => set('descricao', e.target.value)}
                    placeholder="Ex.: Venda de mercadorias"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nr. Documento</label>
                  <input
                    type="text"
                    value={form.nr_documento ?? ''}
                    onChange={e => set('nr_documento', e.target.value)}
                    placeholder="Ex.: 000123"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Espécie</label>
                  <select
                    value={form.especie ?? 'DM'}
                    onChange={e => set('especie', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {ESPECIES.map(e => <option key={e} value={e}>{ESPECIES_LABEL[e]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => set('categoria', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Sem categoria</option>
                    {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moeda</label>
                  <select
                    value={form.moeda ?? 'BRL'}
                    onChange={e => set('moeda', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Seção: Datas e Valores ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Datas e Valores</p>
                {isNew && (
                  <button type="button" onClick={() => { setParcelar(v => !v); setParcelas([]); }}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${parcelar ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    {parcelar ? 'Parcelado ✓' : 'Parcelar'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valor Total <span className="text-red-500">*</span>
                  </label>
                  <CurrencyInput
                    value={form.valor}
                    onChange={v => { set('valor', v); setParcelas([]); }}
                    required
                  />
                </div>

                {!parcelar && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vencimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.vencimento}
                    onChange={e => set('vencimento', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Emissão</label>
                  <input
                    type="date"
                    value={form.data_emissao ?? ''}
                    onChange={e => set('data_emissao', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Lançamento</label>
                  <input
                    type="date"
                    value={form.data_lancamento ?? ''}
                    onChange={e => set('data_lancamento', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* ── Parcelas inline ── */}
            {isNew && parcelar && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Parcelas</p>
                  <div className="flex gap-1.5">
                    {[{n:2,d:30},{n:3,d:30},{n:4,d:30},{n:6,d:30}].map(({n,d})=>(
                      <button key={n} type="button" onClick={() => gerarParcelas(n,d)}
                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-300 transition-colors">
                        {n}x/{d}d
                      </button>
                    ))}
                    <button type="button" onClick={() => setParcelas(p => [...p, { vencimento: '', valor: 0 }])}
                      className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-brand-950 transition-colors">
                      + Parcela
                    </button>
                  </div>
                </div>

                {parcelas.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    Use os atalhos acima ou clique em "+ Parcela" para definir as parcelas
                  </p>
                )}

                {parcelas.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-6 text-right flex-none">{i+1}.</span>
                    <input type="date" value={p.vencimento}
                      onChange={e => setParcelas(prev => prev.map((x, j) => j === i ? { ...x, vencimento: e.target.value } : x))}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <CurrencyInput value={p.valor}
                      onChange={v => setParcelas(prev => prev.map((x, j) => j === i ? { ...x, valor: v } : x))}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-left tabular-nums w-32" />
                    <button type="button" onClick={() => setParcelas(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 transition-colors flex-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}

                {parcelas.length > 0 && (
                  <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${somaOk ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                    <span>Soma das parcelas: <strong>{fmt(parcelas.reduce((s,p)=>s+p.valor,0))}</strong></span>
                    <span>Total: <strong>{fmt(form.valor)}</strong></span>
                    {somaOk ? <span>✓ OK</span> : <span>⚠ Divergência</span>}
                  </div>
                )}
              </div>
            )}

            {/* ── Observações ── */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label>
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={e => set('observacoes', e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Cobrança</p>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Régua de cobrança</label>
              <select
                value={form.reguaId ?? ''}
                onChange={(e) => set('reguaId', e.target.value || null)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Automático (usar régua padrão do tenant)</option>
                {reguas
                  .filter((r) => r.ativo === 1 || (!isNew && r.id === record?.regua_id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                      {r.eh_padrao === 1 ? ' (padrão)' : ''}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Cadastre e edite réguas em <span className="font-medium">Financeiro → Régua de cobrança</span>. Envio automático de e-mail/SMS será habilitado em versão futura.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => isNew ? navigate('/financeiro/contas-receber') : setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {/* Modal — Registrar Recebimento */}
      {showPagarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Registrar Recebimento</h2>
              {record && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{record.descricao}</p>}
              {record && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Valor total</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(record.valor)}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Recebido</p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{fmt(record.valor_pago ?? 0)}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-2">
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-wide">Saldo</p>
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-300">{fmt(Math.max(0, (record.valor ?? 0) - (record.valor_pago ?? 0)))}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de recebimento</label>
                <input
                  type="date"
                  value={pagarData.dataPagamento}
                  onChange={e => setPagarData(prev => ({ ...prev, dataPagamento: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor recebido (R$)</label>
                <CurrencyInput
                  value={pagarData.valorPago}
                  onChange={v => setPagarData(prev => ({ ...prev, valorPago: v }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conta bancária
                  <span className="text-slate-400 font-normal ml-1">(onde entrou o dinheiro)</span>
                </label>
                {contasBancarias.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg">
                    Nenhuma conta bancária cadastrada.{' '}
                    <a href="/financeiro/contas-bancarias" className="underline font-medium">Cadastrar agora</a>
                  </p>
                ) : (
                  <select
                    value={pagarData.contaBancariaId}
                    onChange={e => setPagarData(prev => ({ ...prev, contaBancariaId: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Não informar conta</option>
                    {contasBancarias.map(cb => (
                      <option key={cb.id} value={cb.id}>
                        {cb.nome}{cb.banco_nome ? ` · ${cb.banco_nome}` : ''} — {fmt(cb.saldo_atual ?? 0)}
                      </option>
                    ))}
                  </select>
                )}
                {!pagarData.contaBancariaId && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Sem conta: o título será marcado como pago, mas o saldo bancário não será atualizado.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPagarModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePagar} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContasReceberDetail;
