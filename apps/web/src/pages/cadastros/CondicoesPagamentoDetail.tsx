import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  condicoesPagamentoService,
  type CondicaoPagamento,
  type CondicaoPagamentoForm,
} from '../../services/cadastros/condicoesPagamento';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/condicoes-pagamento';

interface FormState {
  codigo: string;
  descricao: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = { codigo: '', descricao: '', ativo: true };

function formFromCondicao(c: CondicaoPagamento): FormState {
  return { codigo: c.codigo, descricao: c.descricao, ativo: c.ativo === 1 };
}

export default function CondicoesPagamentoDetail() {
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
        const r = await condicoesPagamentoService.list({ limit: 200 });
        if (cancelled) return;
        const found = r.condicoes.find(c => c.id === id);
        if (!found) {
          setError('Condição de pagamento não encontrada.');
        } else {
          setForm(formFromCondicao(found));
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar condição de pagamento.'));
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

    const input: CondicaoPagamentoForm = {
      codigo: form.codigo.trim(),
      descricao: form.descricao.trim(),
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await condicoesPagamentoService.create(input);
      } else {
        await condicoesPagamentoService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar condição de pagamento.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando condição de pagamento..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às condições de pagamento
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Nova condição de pagamento' : 'Editar condição de pagamento'}
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
          <label className={LABEL}>Descrição <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="ex: À vista, 30/60/90 dias"
            required
          />
        </div>
        {isNew && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ao criar, a condição é gerada com uma parcela única de 100%. O detalhamento de parcelas ficará disponível em uma fase futura.
          </p>
        )}
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Condição ativa</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar condição' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
