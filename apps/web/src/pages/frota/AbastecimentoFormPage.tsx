import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatApiError } from '../../utils/helpers';
import {
  abastecimentosService,
  type Abastecimento,
  type AbastecimentoForm,
} from '../../services/abastecimentos';
import { maquinasService, obrasService, type Maquina, type Obra } from '../../services/frota';

interface FormState {
  maquinaId: string;
  obraId: string;
  data: string;
  litros: string;
  valorTotal: string;
  horimetro: string;
  posto: string;
  observacoes: string;
}

const EMPTY_FORM: FormState = {
  maquinaId: '',
  obraId: '',
  data: new Date().toISOString().slice(0, 10),
  litros: '',
  valorTotal: '',
  horimetro: '',
  posto: '',
  observacoes: '',
};

function formFromAbastecimento(a: Abastecimento): FormState {
  return {
    maquinaId: a.maquina_id,
    obraId: a.obra_id ?? '',
    data: a.data,
    litros: String(a.litros ?? ''),
    valorTotal: String(a.valor_total ?? ''),
    horimetro: a.horimetro != null ? String(a.horimetro) : '',
    posto: a.posto ?? '',
    observacoes: a.observacoes ?? '',
  };
}

export default function AbastecimentoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'novo';

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
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
      const r = await abastecimentosService.list({ limit: 500 });
      const found = r.abastecimentos.find((a) => a.id === id);
      if (!found) {
        setFormError('Abastecimento não encontrado.');
        setEditing(null);
        return;
      }
      setEditing(found);
      setForm(formFromAbastecimento(found));
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao carregar abastecimento.'));
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
        const [m, o] = await Promise.all([
          maquinasService.list({ limit: 200 }),
          obrasService.list({ limit: 200 }),
        ]);
        setMaquinas(m.maquinas);
        setObras(o.obras);
      } catch {
        // seletor fica vazio
      }
    })();
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.maquinaId || !form.data || !form.litros || !form.valorTotal) {
      setFormError('Preencha máquina, data, litros e valor total.');
      return;
    }

    const input: AbastecimentoForm = {
      maquinaId: form.maquinaId,
      obraId: form.obraId || null,
      data: form.data,
      litros: Number(form.litros),
      valorTotal: Number(form.valorTotal),
      horimetro: form.horimetro ? Number(form.horimetro) : null,
      posto: form.posto.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await abastecimentosService.update(editing.id, input);
      } else {
        await abastecimentosService.create(input);
      }
      navigate('/frota/abastecimentos');
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar abastecimento.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando abastecimento..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/frota/abastecimentos"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar aos abastecimentos
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {editing ? 'Editar abastecimento' : 'Novo abastecimento'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Registro de combustível por máquina.
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

        <div>
          <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Obra (opcional)
          </label>
          <select
            value={form.obraId}
            onChange={(e) => set('obraId', e.target.value)}
            className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
          >
            <option value="">Nenhuma</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data"
            name="abastecimento-data"
            type="date"
            value={form.data}
            onChange={(e) => set('data', e.target.value)}
            required
          />
          <Input
            label="Horímetro"
            name="abastecimento-horimetro"
            type="number"
            step="0.1"
            value={form.horimetro}
            onChange={(e) => set('horimetro', e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Litros"
            name="abastecimento-litros"
            type="number"
            step="0.01"
            value={form.litros}
            onChange={(e) => set('litros', e.target.value)}
            required
          />
          <Input
            label="Valor total (R$)"
            name="abastecimento-valor"
            type="number"
            step="0.01"
            value={form.valorTotal}
            onChange={(e) => set('valorTotal', e.target.value)}
            required
          />
        </div>

        <Input
          label="Posto"
          name="abastecimento-posto"
          value={form.posto}
          onChange={(e) => set('posto', e.target.value)}
          placeholder="Opcional"
        />

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
          <Button variant="secondary" onClick={() => navigate('/frota/abastecimentos')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editing ? 'Salvar alterações' : 'Registrar abastecimento'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
