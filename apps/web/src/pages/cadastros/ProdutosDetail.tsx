import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { produtosService, type Produto, type ProdutoForm } from '../../services/cadastros/produtos';

const UNIDADES = ['UN', 'CX', 'KG', 'LT', 'MT', 'PC', 'PAR', 'RL', 'SC', 'TON'];

const EMPTY: ProdutoForm = {
  sku: '',
  descricao: '',
  unidade: 'UN',
  precoVenda: 0,
  precoCusto: 0,
  ncm: '',
  ativo: true,
};

export function ProdutosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [form, setForm] = useState<ProdutoForm>(EMPTY);
  const [record, setRecord] = useState<Produto | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    produtosService.get(id!)
      .then(data => {
        setRecord(data);
        setForm({
          sku: data.sku ?? '',
          descricao: data.descricao,
          unidade: data.unidade,
          precoVenda: data.preco_venda,
          precoCusto: data.preco_custo ?? 0,
          ncm: data.ncm ?? '',
          ativo: data.ativo === 1,
        });
      })
      .catch(() => setError('Erro ao carregar produto.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = <K extends keyof ProdutoForm>(field: K, value: ProdutoForm[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await produtosService.create(form);
        navigate('/cadastros/produtos');
      } else {
        await produtosService.update(id!, form);
        setIsEditing(false);
        const updated = await produtosService.get(id!);
        setRecord(updated);
      }
    } catch {
      setError('Erro ao salvar. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Deseja excluir este produto?')) return;
    try {
      await produtosService.delete(id!);
      navigate('/cadastros/produtos');
    } catch {
      setError('Erro ao excluir.');
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

      {/* Visualização */}
      {!isNew && !isEditing && record && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold">
              # {record.codigo}
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {[
              { label: 'SKU (Stock Keeping Unit)', value: record.sku || '—' },
              { label: 'Unidade', value: record.unidade },
              { label: 'Descrição', value: record.descricao },
              { label: 'NCM', value: record.ncm ?? '—' },
              { label: 'Preço de Venda', value: record.preco_venda?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
              { label: 'Preço de Custo', value: record.preco_custo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—' },
              { label: 'Situação', value: record.ativo ? 'Ativo' : 'Inativo' },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Formulário */}
      {(isNew || isEditing) && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-5">
          {!isNew && record && (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400">Código gerado pelo sistema:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-semibold">
                # {record.codigo}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                SKU <span className="text-xs font-normal text-slate-400">(Stock Keeping Unit — opcional)</span>
              </label>
              <input
                type="text"
                value={form.sku ?? ''}
                onChange={e => set('sku', e.target.value)}
                placeholder="Ex: MESA-G-NAT, REF-001"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unidade <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unidade}
                onChange={e => set('unidade', e.target.value)}
                required
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                required
                placeholder="Descrição do produto"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Preço de Venda <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precoVenda}
                onChange={e => set('precoVenda', parseFloat(e.target.value) || 0)}
                required
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preço de Custo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precoCusto}
                onChange={e => set('precoCusto', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NCM</label>
              <input
                type="text"
                value={form.ncm}
                onChange={e => set('ncm', e.target.value)}
                placeholder="00000000"
                maxLength={8}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="ativo"
                checked={form.ativo}
                onChange={e => set('ativo', e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <label htmlFor="ativo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Produto ativo
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => isNew ? navigate('/cadastros/produtos') : setIsEditing(false)}
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

export default ProdutosDetail;
