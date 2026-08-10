import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  manutencoesFrotaService,
  type ManutencaoFrota,
  type ManutencaoFrotaForm,
  type ManutencaoTipo,
  type ManutencaoStatus,
} from '../../services/manutencoesFrota';
import { maquinasService, type Maquina } from '../../services/frota';

interface FormState {
  maquinaId: string;
  tipo: ManutencaoTipo;
  descricao: string;
  dataPrevista: string;
  status: ManutencaoStatus;
  custo: string;
  observacoes: string;
}

const EMPTY_FORM: FormState = {
  maquinaId: '',
  tipo: 'preventiva',
  descricao: '',
  dataPrevista: '',
  status: 'pendente',
  custo: '',
  observacoes: '',
};

function formFromManutencao(m: ManutencaoFrota): FormState {
  return {
    maquinaId: m.maquina_id,
    tipo: m.tipo,
    descricao: m.descricao,
    dataPrevista: m.data_prevista ?? '',
    status: m.status,
    custo: m.custo != null ? String(m.custo) : '',
    observacoes: m.observacoes ?? '',
  };
}

export default function ManutencaoFrotaFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'novo';

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [editing, setEditing] = useState<ManutencaoFrota | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      const r = await manutencoesFrotaService.list({ limit: 500 });
      const found = r.manutencoes.find((m) => m.id === id);
      if (!found) {
        setFormError('Manutenção não encontrada.');
        setEditing(null);
        return;
      }
      setEditing(found);
      setForm(formFromManutencao(found));
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao carregar manutenção.'));
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const m = await maquinasService.list({ limit: 200 });
        setMaquinas(m.maquinas);
      } catch {
        // seletor fica vazio
      }
    })();
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.maquinaId || !form.descricao.trim()) {
      setFormError('Preencha a máquina e a descrição.');
      return;
    }

    const input: ManutencaoFrotaForm = {
      maquinaId: form.maquinaId,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      dataPrevista: form.dataPrevista || null,
      status: form.status,
      custo: form.custo ? Number(form.custo) : null,
      observacoes: form.observacoes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await manutencoesFrotaService.update(editing.id, input);
      } else {
        await manutencoesFrotaService.create(input);
      }
      navigate('/frota/manutencoes');
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar manutenção.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando manutenção..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/frota/manutencoes"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às manutenções
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {editing ? 'Editar manutenção' : 'Nova manutenção'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Agenda preventiva ou corretiva da frota.
        </p>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Máquina<span className="text-red-500 ml-1">*</span>
          </label>
          <select
            value={form.maquinaId}
            onChange={(e) => set('maquinaId', e.target.value)}
            className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
          >
            <option value="">Selecione…</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) => set('tipo', e.target.value as ManutencaoTipo)}
              className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
            >
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as ManutencaoStatus)}
              className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
            >
              <option value="pendente">Pendente</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Descrição<span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            value={form.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            rows={2}
            className="block w-full px-3 py-2 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data prevista"
            name="manutencao-data-prevista"
            type="date"
            value={form.dataPrevista}
            onChange={(e) => set('dataPrevista', e.target.value)}
          />
          <Input
            label="Custo (R$)"
            name="manutencao-custo"
            type="number"
            step="0.01"
            value={form.custo}
            onChange={(e) => set('custo', e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Observações
          </label>
          <textarea
            value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={3}
            className="block w-full px-3 py-2 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/frota/manutencoes')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editing ? 'Salvar alterações' : 'Criar manutenção'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
