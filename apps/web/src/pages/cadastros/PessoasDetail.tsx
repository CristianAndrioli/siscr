import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { pessoasService, type Pessoa, type PessoaForm, type PessoaCadastroTipo } from '../../services/cadastros/pessoas';
import { fetchCepComIbge } from '../../services/brasilCepIbge';
import MaskedInput from '../../components/common/MaskedInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatCPFCNPJ, formatPhone, formatCEP } from '../../utils/formatters';
import { formatApiError } from '../../utils/helpers';

const TIPO_CADASTRO_OPTS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'funcionario', label: 'Funcionário / Operador' },
  { value: 'transportadora', label: 'Transportadora' },
];

const TIPO_OPERADOR_OPTS = [
  { value: 'motorista', label: 'Motorista' },
  { value: 'operador_maquina', label: 'Operador de máquina' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_OPTS = [
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
];

const LIST_ROUTE_BY_TIPO: Record<PessoaCadastroTipo, string> = {
  cliente: '/cadastros/clientes',
  fornecedor: '/cadastros/fornecedores',
  vendedor: '/cadastros/vendedores',
  transportadora: '/cadastros/transportadoras',
  funcionario: '/cadastros/funcionarios',
};

const LIST_LABEL_BY_TIPO: Record<PessoaCadastroTipo, string> = {
  cliente: 'Clientes',
  fornecedor: 'Fornecedores',
  vendedor: 'Vendedores',
  transportadora: 'Transportadoras',
  funcionario: 'Funcionários / Operadores',
};

const IND_IE_LABEL: Record<string, string> = {
  '1': 'Contribuinte ICMS',
  '2': 'Isento',
  '9': 'Não contribuinte',
};

const EMPTY: PessoaForm = {
  tipo: 'PF',
  tipoCadastro: 'cliente',
  nome: '',
  cpfCnpj: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  inscricaoEstadual: '',
  indIeDest: '9',
  codigoMunicipio: '',
  codigoPais: '1058',
  comissaoPercentual: undefined,
  metaMensal: undefined,
  matricula: '',
  tipoOperador: '',
  cnhNumero: '',
  cnhCategoria: '',
  cnhValidade: '',
};

const INPUT_CLS =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function PessoasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = id === 'novo';
  const { reportError } = useErrorNotification();

  const tipoFromQuery = searchParams.get('tipo') as PessoaCadastroTipo | null;
  const [form, setForm] = useState<PessoaForm>(() =>
    isNew && tipoFromQuery ? { ...EMPTY, tipoCadastro: tipoFromQuery } : EMPTY,
  );
  const [record, setRecord] = useState<Pessoa | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    pessoasService.get(id!)
      .then(data => {
        setRecord(data);
        setForm({
          tipo: data.tipo,
          tipoCadastro: data.tipo_cadastro,
          nome: data.nome,
          cpfCnpj: formatCPFCNPJ(data.cpf_cnpj ?? ''),
          email: data.email ?? '',
          telefone: formatPhone(data.telefone ?? ''),
          cep: formatCEP(data.cep ?? ''),
          logradouro: data.logradouro ?? '',
          numero: data.numero ?? '',
          complemento: data.complemento ?? '',
          bairro: data.bairro ?? '',
          cidade: data.cidade ?? '',
          uf: data.uf ?? '',
          inscricaoEstadual: data.inscricao_estadual ?? '',
          indIeDest: (data.ind_ie_dest === '1' || data.ind_ie_dest === '2' || data.ind_ie_dest === '9'
            ? data.ind_ie_dest
            : '9') as '1' | '2' | '9',
          codigoMunicipio: data.codigo_municipio ?? '',
          codigoPais: data.codigo_pais ?? '1058',
          comissaoPercentual: data.comissao_percentual ?? undefined,
          metaMensal: data.meta_mensal ?? undefined,
          matricula: data.matricula ?? '',
          tipoOperador: data.tipo_operador ?? '',
          cnhNumero: data.cnh_numero ?? '',
          cnhCategoria: data.cnh_categoria ?? '',
          cnhValidade: data.cnh_validade ?? '',
        });
      })
      .catch(() => setError('Erro ao carregar registro.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (field: keyof PessoaForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const setNum = (field: 'comissaoPercentual' | 'metaMensal', value: string) =>
    setForm(prev => ({ ...prev, [field]: value === '' ? undefined : Number(value) }));

  const backTipo = (record?.tipo_cadastro ?? tipoFromQuery ?? form.tipoCadastro) as PessoaCadastroTipo;
  const backTo = LIST_ROUTE_BY_TIPO[backTipo] ?? '/cadastros/pessoas';
  const backLabel = LIST_LABEL_BY_TIPO[backTipo] ?? 'Pessoas';

  const handleCepBlur = async () => {
    if (!form.cep) return;
    setLoadingCep(true);
    const data = await fetchCepComIbge(form.cep);
    if (data) {
      setForm(prev => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        uf: data.uf || prev.uf,
        codigoMunicipio: data.codigoMunicipioIbge || prev.codigoMunicipio,
      }));
    }
    setLoadingCep(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await pessoasService.create(form);
        navigate(backTo);
      } else {
        await pessoasService.update(id!, form);
        setIsEditing(false);
        const updated = await pessoasService.get(id!);
        setRecord(updated);
      }
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao salvar pessoa. Verifique os dados e tente novamente.');
      reportError(msg, err, 'Cadastro de Pessoa');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Deseja excluir esta pessoa?')) return;
    try {
      await pessoasService.delete(id!);
      navigate(backTo);
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao excluir pessoa.');
      reportError(msg, err, 'Cadastro de Pessoa');
      setError(msg);
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

  const hasAddress = record && (record.cep || record.logradouro || record.cidade);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {backLabel}
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isNew ? 'Nova Pessoa' : (record?.nome ?? 'Detalhe')}
          </h1>
        </div>
        {!isNew && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
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

      {/* Modo visualização */}
      {!isNew && !isEditing && record && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            {record.codigo && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold">
                  # {record.codigo}
                </span>
              </div>
            )}
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Dados Gerais</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: 'Tipo', value: record.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica' },
                { label: 'Categoria', value: TIPO_CADASTRO_OPTS.find(o => o.value === record.tipo_cadastro)?.label ?? record.tipo_cadastro },
                { label: 'Nome', value: record.nome },
                { label: 'CPF/CNPJ', value: formatCPFCNPJ(record.cpf_cnpj) || '—' },
                { label: 'E-mail', value: record.email ?? '—' },
                { label: 'Telefone', value: formatPhone(record.telefone) || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {record.tipo_cadastro === 'vendedor' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Detalhes do vendedor</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Comissão</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.comissao_percentual != null ? `${record.comissao_percentual}%` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Meta mensal</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.meta_mensal != null ? record.meta_mensal : '—'}</dd>
                </div>
              </dl>
            </div>
          )}

          {record.tipo_cadastro === 'funcionario' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Detalhes do funcionário / operador</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Matrícula</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.matricula || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Função</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{TIPO_OPERADOR_OPTS.find(o => o.value === record.tipo_operador)?.label ?? record.tipo_operador ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">CNH</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                    {record.cnh_numero ? `${record.cnh_numero} · Cat. ${record.cnh_categoria ?? '—'}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">CNH — validade</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.cnh_validade || '—'}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Endereço</p>
            {hasAddress ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">CEP</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{formatCEP(record.cep) || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Logradouro</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                    {[record.logradouro, record.numero, record.complemento].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Bairro</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.bairro ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cidade / UF</dt>
                  <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                    {[record.cidade, record.uf].filter(Boolean).join(' — ') || '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">Endereço não informado.</p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Fiscal (NF-e)</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Inscrição estadual</dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{record.inscricao_estadual ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Indicador IE</dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                  {IND_IE_LABEL[record.ind_ie_dest ?? '9'] ?? record.ind_ie_dest ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cód. município (IBGE)</dt>
                <dd className="mt-1 text-sm font-mono text-slate-800 dark:text-slate-100">{record.codigo_municipio ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cód. país</dt>
                <dd className="mt-1 text-sm font-mono text-slate-800 dark:text-slate-100">{record.codigo_pais ?? '1058'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Formulário (novo ou edição) */}
      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados Gerais */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dados Gerais</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select value={form.tipo} onChange={e => { set('tipo', e.target.value); set('cpfCnpj', ''); }} required className={INPUT_CLS}>
                  {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Categoria <span className="text-red-500">*</span>
                </label>
                <select value={form.tipoCadastro} onChange={e => set('tipoCadastro', e.target.value)} required className={INPUT_CLS}>
                  {TIPO_CADASTRO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  required
                  placeholder="Nome completo ou razão social"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}
                </label>
                <MaskedInput
                  mask={form.tipo === 'PJ' ? 'cnpj' : 'cpf'}
                  value={form.cpfCnpj ?? ''}
                  onChange={v => set('cpfCnpj', v)}
                  placeholder={form.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                <MaskedInput
                  mask="phone"
                  value={form.telefone ?? ''}
                  onChange={v => set('telefone', v)}
                  placeholder="(48) 99999-9999"
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="contato@empresa.com.br"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* Detalhes do papel — vendedor ou funcionário/operador */}
          {form.tipoCadastro === 'vendedor' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Detalhes do vendedor</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Comissão (%)</label>
                  <input
                    type="number" step="0.01" min="0" max="100"
                    value={form.comissaoPercentual ?? ''}
                    onChange={e => setNum('comissaoPercentual', e.target.value)}
                    placeholder="0,00"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Meta mensal (R$)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.metaMensal ?? ''}
                    onChange={e => setNum('metaMensal', e.target.value)}
                    placeholder="0,00"
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
          )}

          {form.tipoCadastro === 'funcionario' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Detalhes do funcionário / operador</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={form.matricula ?? ''}
                    onChange={e => set('matricula', e.target.value)}
                    placeholder="Código interno"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Função</label>
                  <select value={form.tipoOperador ?? ''} onChange={e => set('tipoOperador', e.target.value)} className={INPUT_CLS}>
                    <option value="">Selecione…</option>
                    {TIPO_OPERADOR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNH — número</label>
                  <input
                    type="text"
                    value={form.cnhNumero ?? ''}
                    onChange={e => set('cnhNumero', e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNH — categoria</label>
                  <input
                    type="text" maxLength={5}
                    value={form.cnhCategoria ?? ''}
                    onChange={e => set('cnhCategoria', e.target.value.toUpperCase())}
                    placeholder="AB"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNH — validade</label>
                  <input
                    type="date"
                    value={form.cnhValidade ?? ''}
                    onChange={e => set('cnhValidade', e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Endereço */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Endereço</p>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-5">
              {/* CEP */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEP</label>
                <div className="relative">
                  <MaskedInput
                    mask="cep"
                    value={form.cep ?? ''}
                    onChange={v => set('cep', v)}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    className={INPUT_CLS}
                  />
                  {loadingCep && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">Preenchimento automático ao sair do campo</p>
              </div>

              {/* Logradouro */}
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logradouro</label>
                <input
                  type="text"
                  value={form.logradouro}
                  onChange={e => set('logradouro', e.target.value)}
                  placeholder="Rua, Av., etc."
                  className={INPUT_CLS}
                />
              </div>

              {/* Número */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={e => set('numero', e.target.value)}
                  placeholder="123"
                  className={INPUT_CLS}
                />
              </div>

              {/* Complemento */}
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Complemento</label>
                <input
                  type="text"
                  value={form.complemento}
                  onChange={e => set('complemento', e.target.value)}
                  placeholder="Apto, sala, bloco..."
                  className={INPUT_CLS}
                />
              </div>

              {/* Bairro */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bairro</label>
                <input
                  type="text"
                  value={form.bairro}
                  onChange={e => set('bairro', e.target.value)}
                  placeholder="Bairro"
                  className={INPUT_CLS}
                />
              </div>

              {/* Cidade */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={e => set('cidade', e.target.value)}
                  placeholder="Florianópolis"
                  className={INPUT_CLS}
                />
              </div>

              {/* UF */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UF</label>
                <input
                  type="text"
                  value={form.uf}
                  onChange={e => set('uf', e.target.value.toUpperCase())}
                  placeholder="SC"
                  maxLength={2}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fiscal (NF-e)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              Usado como destinatário na nota. Código do município: 7 dígitos IBGE.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Inscrição estadual</label>
                <input
                  type="text"
                  value={form.inscricaoEstadual ?? ''}
                  onChange={e => set('inscricaoEstadual', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Se aplicável"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Indicador de IE</label>
                <select
                  value={form.indIeDest ?? '9'}
                  onChange={e => set('indIeDest', e.target.value as '1' | '2' | '9')}
                  className={INPUT_CLS}
                >
                  <option value="1">1 — Contribuinte ICMS</option>
                  <option value="2">2 — Isento</option>
                  <option value="9">9 — Não contribuinte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cód. município (IBGE)</label>
                <input
                  type="text"
                  value={form.codigoMunicipio ?? ''}
                  onChange={e => set('codigoMunicipio', e.target.value.replace(/\D/g, '').slice(0, 7))}
                  maxLength={7}
                  placeholder="3550308"
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cód. país</label>
                <input
                  type="text"
                  value={form.codigoPais ?? '1058'}
                  onChange={e => set('codigoPais', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  placeholder="1058"
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => isNew ? navigate(backTo) : setIsEditing(false)}
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
    </div>
  );
}

export default PessoasDetail;
