import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { contasPagarService, type ContaPagar, type ContaForm } from '../../services/financeiro';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { bancarioService, type ContaBancaria } from '../../services/bancario';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtDate = (s?: string) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const STATUS_STYLE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const CATEGORIAS = ['Fornecedor', 'Aluguel', 'Salário', 'Imposto', 'Serviço', 'Financiamento', 'Outros'];
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
  categoria: '', observacoes: '', nr_documento: '',
  especie: 'DM', data_emissao: '', data_lancamento: new Date().toISOString().slice(0, 10), moeda: 'BRL',
};

export function ContasPagarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [record, setRecord] = useState<ContaPagar | null>(null);
  const [form, setForm] = useState<ContaForm>({ ...EMPTY, vencimento: new Date().toISOString().slice(0, 10) });
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [pagarData, setPagarData] = useState({ dataPagamento: new Date().toISOString().slice(0, 10), valorPago: 0, contaBancariaId: '' });
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);

  useEffect(() => {
    pessoasService.list({ search: '' }).then(setPessoas).catch(() => {});
    bancarioService.listContas().then(setContasBancarias).catch(() => {});
    if (!isNew) {
      contasPagarService.get(id!)
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
          });
          setPagarData(prev => ({ ...prev, valorPago: data.valor }));
        })
        .catch(() => setError('Erro ao carregar registro.'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const set = (field: keyof ContaForm, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pessoaId) { setError('Selecione o fornecedor/pessoa.'); return; }
    if (!form.descricao) { setError('Informe a descrição.'); return; }
    if (!form.valor || form.valor <= 0) { setError('Informe um valor positivo.'); return; }
    if (!form.vencimento) { setError('Informe o vencimento.'); return; }

    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await contasPagarService.create(form);
        navigate('/financeiro/contas-pagar');
      } else {
        await contasPagarService.update(id!, form);
        const updated = await contasPagarService.get(id!);
        setRecord(updated);
        setIsEditing(false);
      }
    } catch {
      setError('Erro ao salvar. Verifique os dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      await contasPagarService.delete(id!);
      navigate('/financeiro/contas-pagar');
    } catch {
      setError('Erro ao excluir.');
    }
  };

  const handlePagar = async () => {
    setSaving(true);
    try {
      await contasPagarService.marcarPago(id!, pagarData.dataPagamento, pagarData.valorPago, pagarData.contaBancariaId || undefined);
      const updated = await contasPagarService.get(id!);
      setRecord(updated);
      setShowPagarModal(false);
    } catch {
      setError('Erro ao registrar pagamento.');
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
            onClick={() => navigate('/financeiro/contas-pagar')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Contas a Pagar
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isNew ? 'Nova Conta a Pagar' : (record?.descricao ?? 'Detalhe')}
          </h1>
          {record && (
            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[record.status] ?? ''}`}>
              {record.status}
            </span>
          )}
        </div>
        {!isNew && !isEditing && record && (
          <div className="flex gap-2 flex-none">
            {record.status === 'pendente' && (
              <button
                onClick={() => setShowPagarModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Pago
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          {record.codigo && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold">
                # {record.codigo}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
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

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Valores</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {[
                  { label: 'Fornecedor', value: record.fornecedor || '—' },
                  { label: 'Valor', value: fmt(record.valor) },
                  { label: 'Valor Pago', value: record.valor_pago ? fmt(record.valor_pago) : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
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
                    Fornecedor / Pessoa <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.pessoaId}
                    onChange={e => set('pessoaId', e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione...</option>
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
                    placeholder="Ex.: Aluguel do galpão"
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
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Datas e Valores</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.valor || ''}
                    onChange={e => set('valor', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

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
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => isNew ? navigate('/financeiro/contas-pagar') : setIsEditing(false)}
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

      {/* Modal — Registrar Pagamento */}
      {showPagarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Registrar Pagamento</h2>
              {record && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{record.descricao}</p>}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data do pagamento</label>
                <input
                  type="date"
                  value={pagarData.dataPagamento}
                  onChange={e => setPagarData(prev => ({ ...prev, dataPagamento: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor pago (R$)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pagarData.valorPago}
                  onChange={e => setPagarData(prev => ({ ...prev, valorPago: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conta bancária
                  <span className="text-slate-400 font-normal ml-1">(de onde saiu o dinheiro)</span>
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
              <button onClick={handlePagar} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContasPagarDetail;
