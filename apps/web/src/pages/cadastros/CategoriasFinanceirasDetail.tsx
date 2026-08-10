import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  categoriasFinanceirasService,
  type CategoriaFinanceira,
  type CategoriaFinanceiraForm,
  type CategoriaFinanceiraTipo,
} from '../../services/cadastros/categoriasFinanceiras';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/categorias-financeiras';

const TIPO_LABEL: Record<CategoriaFinanceiraTipo, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

interface FormState {
  codigo: string;
  nome: string;
  tipo: CategoriaFinanceiraTipo;
  grupoDre: string;
  categoriaPaiId: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  codigo: '', nome: '', tipo: 'receita', grupoDre: '', categoriaPaiId: '', ativo: true,
};

function formFromCategoria(c: CategoriaFinanceira): FormState {
  return {
    codigo: c.codigo,
    nome: c.nome,
    tipo: c.tipo,
    grupoDre: c.grupo_dre ?? '',
    categoriaPaiId: c.categoria_pai_id ?? '',
    ativo: c.ativo === 1,
  };
}

export default function CategoriasFinanceirasDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await categoriasFinanceirasService.list({ limit: 200 });
        if (cancelled) return;
        setCategorias(r.categorias);
        if (!isNew) {
          const found = r.categorias.find(c => c.id === id);
          if (!found) {
            setError('Categoria financeira não encontrada.');
          } else {
            setForm(formFromCategoria(found));
          }
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar categoria financeira.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.codigo.trim() || !form.nome.trim()) {
      setError('Preencha o código e o nome.');
      return;
    }

    const input: CategoriaFinanceiraForm = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      tipo: form.tipo,
      grupoDre: form.grupoDre.trim() || null,
      categoriaPaiId: form.categoriaPaiId || null,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await categoriasFinanceirasService.create(input);
      } else {
        await categoriasFinanceirasService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar categoria financeira.'));
    } finally {
      setSaving(false);
    }
  };

  const categoriaPaiOptions = categorias
    .filter(c => c.id !== id && c.tipo === form.tipo)
    .map(c => ({ value: c.id, label: `${c.codigo} — ${c.nome}` }));

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando categoria financeira..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às categorias financeiras
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Nova categoria financeira' : 'Editar categoria financeira'}
        </h1>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Código <span className="text-red-500">*</span></label>
            <input
              className={FIELD}
              value={form.codigo}
              onChange={e => set('codigo', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={LABEL}>Tipo</label>
            <select
              className={FIELD}
              value={form.tipo}
              onChange={e => setForm(prev => ({
                ...prev,
                tipo: e.target.value as CategoriaFinanceiraTipo,
                categoriaPaiId: '',
              }))}
            >
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Nome <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Grupo DRE</label>
            <input
              className={FIELD}
              value={form.grupoDre}
              onChange={e => set('grupoDre', e.target.value)}
              placeholder="ex: Receita Operacional"
            />
          </div>
          <div>
            <label className={LABEL}>Categoria pai</label>
            <select
              className={FIELD}
              value={form.categoriaPaiId}
              onChange={e => set('categoriaPaiId', e.target.value)}
            >
              <option value="">— Nenhuma (categoria raiz) —</option>
              {categoriaPaiOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Categoria ativa</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar categoria' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
