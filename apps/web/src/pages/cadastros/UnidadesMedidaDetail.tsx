import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  unidadesMedidaService,
  type UnidadeMedida,
  type UnidadeMedidaForm,
} from '../../services/cadastros/unidadesMedida';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/unidades-medida';

interface FormState {
  sigla: string;
  descricao: string;
  fatorConversao: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = { sigla: '', descricao: '', fatorConversao: '1', ativo: true };

function formFromUnidade(u: UnidadeMedida): FormState {
  return {
    sigla: u.sigla,
    descricao: u.descricao,
    fatorConversao: u.fator_conversao != null ? String(u.fator_conversao) : '1',
    ativo: u.ativo === 1,
  };
}

export default function UnidadesMedidaDetail() {
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
        const r = await unidadesMedidaService.list({ limit: 200 });
        if (cancelled) return;
        const found = r.unidades.find(u => u.id === id);
        if (!found) {
          setError('Unidade de medida não encontrada.');
        } else {
          setForm(formFromUnidade(found));
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar unidade de medida.'));
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
    if (!form.sigla.trim() || !form.descricao.trim()) {
      setError('Preencha a sigla e a descrição.');
      return;
    }
    const fator = form.fatorConversao.trim() ? Number(form.fatorConversao.replace(',', '.')) : undefined;
    if (fator !== undefined && (Number.isNaN(fator) || fator <= 0)) {
      setError('Informe um fator de conversão numérico válido.');
      return;
    }

    const input: UnidadeMedidaForm = {
      sigla: form.sigla.trim(),
      descricao: form.descricao.trim(),
      fatorConversao: fator,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await unidadesMedidaService.create(input);
      } else {
        await unidadesMedidaService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar unidade de medida.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando unidade de medida..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às unidades de medida
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Nova unidade de medida' : 'Editar unidade de medida'}
        </h1>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Sigla <span className="text-red-500">*</span></label>
            <input
              className={FIELD}
              value={form.sigla}
              onChange={e => set('sigla', e.target.value)}
              placeholder="ex: UN, KG, CX"
              required
            />
          </div>
          <div>
            <label className={LABEL}>Fator de conversão</label>
            <input
              className={FIELD}
              value={form.fatorConversao}
              onChange={e => set('fatorConversao', e.target.value)}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Relação com a unidade base (padrão 1)
            </p>
          </div>
        </div>
        <div>
          <label className={LABEL}>Descrição <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="ex: Unidade, Quilograma, Caixa"
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
          <span className="text-sm text-slate-700 dark:text-slate-300">Unidade ativa</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar unidade' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
