import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bancarioService, type ContaBancaria, type ContaBancariaForm } from '../../services/bancario';
import { fmtBRL as fmt } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';
import CurrencyInput from '../../components/common/CurrencyInput';

const TIPO_LABEL: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa Físico',
  investimento: 'Investimento',
};

const TIPO_COLOR: Record<string, string> = {
  corrente: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  poupanca: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  caixa: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  investimento: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

// Lista de bancos mais comuns no Brasil
const BANCOS = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '356', nome: 'Banco Real' },
  { codigo: '389', nome: 'Banco Mercantil' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '453', nome: 'Rural' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '260', nome: 'Nu Pagamentos (Nubank)' },
  { codigo: '290', nome: 'PagSeguro' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '999', nome: 'Outro' },
];

const EMPTY: ContaBancariaForm = {
  nome: '', banco_codigo: '', banco_nome: '', agencia: '', conta: '',
  tipo: 'corrente', saldo_inicial: 0,
};

export function ContasBancariasPage() {
  const { reportError } = useErrorNotification();
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [form, setForm] = useState<ContaBancariaForm>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    bancarioService.listContas()
      .then(data => { setContas(data ?? []); })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Erro desconhecido';
        setLoadError(msg);
        setContas([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (conta: ContaBancaria) => {
    setEditing(conta);
    setForm({
      nome: conta.nome,
      banco_codigo: conta.banco_codigo ?? '',
      banco_nome: conta.banco_nome ?? '',
      agencia: conta.agencia ?? '',
      conta: conta.conta ?? '',
      tipo: conta.tipo,
      saldo_inicial: conta.saldo_inicial,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleBancoChange = (codigo: string) => {
    const banco = BANCOS.find(b => b.codigo === codigo);
    setForm(f => ({
      ...f,
      banco_codigo: codigo,
      banco_nome: banco ? banco.nome : f.banco_nome,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) { setFormError('Informe o nome da conta.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editing) {
        await bancarioService.updateConta(editing.id, form);
      } else {
        await bancarioService.createConta(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao salvar conta bancária.');
      reportError(msg, err, 'Contas Bancárias');
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Desativar esta conta bancária?')) return;
    try {
      await bancarioService.deleteConta(id);
      load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao desativar conta bancária.');
      reportError(msg, err, 'Contas Bancárias');
      setFormError(msg);
    }
  };

  const totalDisponivel = contas.reduce((sum, c) => sum + (c.saldo_atual ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Contas Bancárias</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie suas contas e acompanhe o saldo disponível</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conta
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs font-mono">{loadError}</div>
      )}

      {/* Card de total */}
      {contas.length > 0 && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Total Disponível</p>
          <p className="text-3xl font-bold">{fmt(totalDisponivel)}</p>
          <p className="text-xs opacity-70 mt-1">{contas.length} conta{contas.length !== 1 ? 's' : ''} ativa{contas.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Lista de contas */}
      {loading ? (
        <div className="flex items-center justify-center min-h-40">
          <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : contas.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Nenhuma conta bancária cadastrada.</p>
          <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            Cadastrar primeira conta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map(conta => (
            <div key={conta.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <Link to={`/financeiro/contas-bancarias/${conta.id}`} className="flex items-start justify-between mb-4 group">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{conta.nome}</p>
                  {conta.banco_nome && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {conta.banco_codigo && `${conta.banco_codigo} · `}{conta.banco_nome}
                    </p>
                  )}
                  {(conta.agencia || conta.conta) && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {conta.agencia && `Ag. ${conta.agencia}`}{conta.agencia && conta.conta && ' · '}{conta.conta && `CC ${conta.conta}`}
                    </p>
                  )}
                </div>
                <span className={`flex-none ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLOR[conta.tipo] ?? ''}`}>
                  {TIPO_LABEL[conta.tipo] ?? conta.tipo}
                </span>
              </Link>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Saldo atual</p>
                <p className={`text-xl font-bold ${(conta.saldo_atual ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmt(conta.saldo_atual ?? 0)}
                </p>
                {conta.saldo_inicial !== 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Saldo inicial: {fmt(conta.saldo_inicial)}
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Link
                  to={`/financeiro/conciliacao/nova?contaId=${conta.id}`}
                  className="flex-1 text-xs font-semibold border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 py-1.5 rounded-lg transition-colors text-center"
                >
                  Conciliar
                </Link>
                <button
                  onClick={() => openEdit(conta)}
                  className="flex-1 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 rounded-lg transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(conta.id)}
                  className="text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-1.5 px-2.5 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal — Criar / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editing ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome da conta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex.: Bradesco C/C Principal"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as ContaBancariaForm['tipo'] }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="caixa">Caixa Físico</option>
                  <option value="investimento">Investimento</option>
                </select>
              </div>

              {/* Banco (apenas se não for caixa) */}
              {form.tipo !== 'caixa' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Banco</label>
                    <select
                      value={form.banco_codigo ?? ''}
                      onChange={e => handleBancoChange(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Selecione...</option>
                      {BANCOS.map(b => (
                        <option key={b.codigo} value={b.codigo}>{b.codigo} · {b.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Agência</label>
                    <input
                      type="text"
                      value={form.agencia ?? ''}
                      onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))}
                      placeholder="1234-5"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número da Conta</label>
                    <input
                      type="text"
                      value={form.conta ?? ''}
                      onChange={e => setForm(f => ({ ...f, conta: e.target.value }))}
                      placeholder="00012345-6"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* Saldo inicial */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Saldo inicial (R$)
                </label>
                <CurrencyInput
                  value={form.saldo_inicial}
                  onChange={v => setForm(f => ({ ...f, saldo_inicial: v }))}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Saldo que a conta já tinha antes de usar o sistema.</p>
              </div>

              {formError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{formError}</div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContasBancariasPage;
