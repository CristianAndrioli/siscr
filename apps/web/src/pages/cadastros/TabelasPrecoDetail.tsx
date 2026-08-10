import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  tabelasPrecoService,
  type TabelaPreco,
  type TabelaPrecoForm,
  type TabelaPrecoTipoAjuste,
} from '../../services/cadastros/tabelasPreco';

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const LIST_PATH = '/cadastros/tabelas-preco';

const TIPO_AJUSTE_LABEL: Record<TabelaPrecoTipoAjuste, string> = {
  percentual: 'Percentual (%)',
  fixo: 'Valor fixo (R$)',
};

interface FormState {
  nome: string;
  tipoAjuste: TabelaPrecoTipoAjuste;
  valorAjuste: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: '', tipoAjuste: 'percentual', valorAjuste: '', vigenciaInicio: '', vigenciaFim: '', ativo: true,
};

function formFromTabela(t: TabelaPreco): FormState {
  return {
    nome: t.nome,
    tipoAjuste: t.tipo_ajuste,
    valorAjuste: t.valor_ajuste != null ? String(t.valor_ajuste) : '',
    vigenciaInicio: t.vigencia_inicio ? t.vigencia_inicio.slice(0, 10) : '',
    vigenciaFim: t.vigencia_fim ? t.vigencia_fim.slice(0, 10) : '',
    ativo: t.ativo === 1,
  };
}

export default function TabelasPrecoDetail() {
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
        const r = await tabelasPrecoService.list({ limit: 200 });
        if (cancelled) return;
        const found = r.tabelas.find(t => t.id === id);
        if (!found) {
          setError('Tabela de preço não encontrada.');
        } else {
          setForm(formFromTabela(found));
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Erro ao carregar tabela de preço.'));
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
    if (!form.nome.trim()) {
      setError('Preencha o nome da tabela.');
      return;
    }
    const valor = form.valorAjuste.trim() ? Number(form.valorAjuste.replace(',', '.')) : undefined;
    if (valor !== undefined && Number.isNaN(valor)) {
      setError('Informe um valor de ajuste numérico válido.');
      return;
    }
    if (form.vigenciaInicio && form.vigenciaFim && form.vigenciaFim < form.vigenciaInicio) {
      setError('A vigência final não pode ser anterior à vigência inicial.');
      return;
    }

    const input: TabelaPrecoForm = {
      nome: form.nome.trim(),
      tipoAjuste: form.tipoAjuste,
      valorAjuste: valor,
      vigenciaInicio: form.vigenciaInicio || null,
      vigenciaFim: form.vigenciaFim || null,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (isNew) {
        await tabelasPrecoService.create(input);
      } else {
        await tabelasPrecoService.update(id!, input);
      }
      navigate(LIST_PATH);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao salvar tabela de preço.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando tabela de preço..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às tabelas de preço
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Nova tabela de preço' : 'Editar tabela de preço'}
        </h1>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={LABEL}>Nome <span className="text-red-500">*</span></label>
          <input
            className={FIELD}
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="ex: Tabela padrão, Atacado, Black Friday"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Tipo de ajuste</label>
            <select
              className={FIELD}
              value={form.tipoAjuste}
              onChange={e => set('tipoAjuste', e.target.value as TabelaPrecoTipoAjuste)}
            >
              {Object.entries(TIPO_AJUSTE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>
              {form.tipoAjuste === 'percentual' ? 'Valor do ajuste (%)' : 'Valor do ajuste (R$)'}
            </label>
            <input
              className={FIELD}
              value={form.valorAjuste}
              onChange={e => set('valorAjuste', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Vigência início</label>
            <input
              type="date"
              className={FIELD}
              value={form.vigenciaInicio}
              onChange={e => set('vigenciaInicio', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Vigência fim</label>
            <input
              type="date"
              className={FIELD}
              value={form.vigenciaFim}
              onChange={e => set('vigenciaFim', e.target.value)}
            />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={e => set('ativo', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Tabela ativa</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(LIST_PATH)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar tabela' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
