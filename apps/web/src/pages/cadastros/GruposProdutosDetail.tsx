import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  gruposProdutosService,
  type GrupoProduto,
  type GrupoProdutoForm,
} from '../../services/cadastros/gruposProdutos';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/grupos-produtos';

interface FormState {
  codigo: string;
  descricao: string;
  grupoPaiId: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = { codigo: '', descricao: '', grupoPaiId: '', ativo: true };

function formFromGrupo(g: GrupoProduto): FormState {
  return {
    codigo: g.codigo,
    descricao: g.descricao,
    grupoPaiId: g.grupo_pai_id ?? '',
    ativo: g.ativo === 1,
  };
}

export default function GruposProdutosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [grupos, setGrupos] = useState<GrupoProduto[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await gruposProdutosService.list({ limit: 200 });
        if (cancelled) return;
        setGrupos(r.grupos);
        if (!isNew) {
          const found = r.grupos.find(g => g.id === id);
          if (!found) {
            setError('Grupo de produtos não encontrado.');
          } else {
            setForm(formFromGrupo(found));
          }
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar grupo de produtos.'));
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
    if (!form.codigo.trim() || !form.descricao.trim()) {
      setError('Preencha o código e a descrição.');
      return;
    }

    const input: GrupoProdutoForm = {
      codigo: form.codigo.trim(),
      descricao: form.descricao.trim(),
      grupoPaiId: form.grupoPaiId || null,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await gruposProdutosService.create(input);
      } else {
        await gruposProdutosService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar grupo de produtos.'));
    } finally {
      setSaving(false);
    }
  };

  const gruposPaiOptions = grupos
    .filter(g => g.id !== id)
    .map(g => ({ value: g.id, label: `${g.codigo} — ${g.descricao}` }));

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando grupo de produtos..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar aos grupos de produtos
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Novo grupo de produtos' : 'Editar grupo de produtos'}
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
            <label className={LABEL}>Grupo pai</label>
            <select
              className={FIELD}
              value={form.grupoPaiId}
              onChange={e => set('grupoPaiId', e.target.value)}
            >
              <option value="">— Nenhum (grupo raiz) —</option>
              {gruposPaiOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Descrição <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            required
          />
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Grupo ativo</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar grupo' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
