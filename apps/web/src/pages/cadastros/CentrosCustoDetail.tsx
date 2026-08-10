import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  centrosCustoService,
  type CentroCusto,
  type CentroCustoForm,
} from '../../services/cadastros/centrosCusto';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/centros-custo';

interface FormState {
  codigo: string;
  nome: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = { codigo: '', nome: '', ativo: true };

function formFromCentro(c: CentroCusto): FormState {
  return { codigo: c.codigo, nome: c.nome, ativo: c.ativo === 1 };
}

export default function CentrosCustoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await centrosCustoService.list({ limit: 200 });
        if (cancelled) return;
        const found = r.centros.find(c => c.id === id);
        if (!found) {
          setError('Centro de custo não encontrado.');
        } else {
          setForm(formFromCentro(found));
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar centro de custo.'));
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

    const input: CentroCustoForm = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await centrosCustoService.create(input);
      } else {
        await centrosCustoService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar centro de custo.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando centro de custo..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar aos centros de custo
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Novo centro de custo' : 'Editar centro de custo'}
        </h1>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label className={LABEL}>Nome <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
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
          <span className="text-sm text-slate-700 dark:text-slate-300">Centro de custo ativo</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar centro de custo' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
