import { useCallback, useEffect, useState } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import { fmtBRL, fmtDateISO } from '../../utils/format';
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

export default function AbastecimentosPage() {
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [maquinaFiltro, setMaquinaFiltro] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<Abastecimento | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await abastecimentosService.list({ maquinaId: maquinaFiltro || undefined, limit: 200 });
      setAbastecimentos(r.abastecimentos);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar abastecimentos.'));
    } finally {
      setLoading(false);
    }
  }, [maquinaFiltro]);

  useEffect(() => { void carregar(); }, [carregar]);

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
        // seletor fica vazio; erro de listagem principal já é reportado
      }
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (a: Abastecimento) => {
    setEditing(a);
    setForm(formFromAbastecimento(a));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

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
        setSuccess('Abastecimento atualizado.');
      } else {
        await abastecimentosService.create(input);
        setSuccess('Abastecimento registrado.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar abastecimento.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await abastecimentosService.delete(deleting.id);
      setSuccess('Abastecimento removido.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover abastecimento.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Abastecimentos"
      description="Registro de abastecimentos de combustível por máquina"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('abastecimentos', [
        { label: 'Data', value: (r: Abastecimento) => r.data },
        { label: 'Máquina', value: (r: Abastecimento) => r.maquina_nome ?? '' },
        { label: 'Litros', value: (r: Abastecimento) => r.litros },
        { label: 'Valor total', value: (r: Abastecimento) => r.valor_total },
        { label: 'Horímetro', value: (r: Abastecimento) => r.horimetro ?? '' },
        { label: 'Posto', value: (r: Abastecimento) => r.posto ?? '' },
      ], abastecimentos)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <select
          value={maquinaFiltro}
          onChange={e => setMaquinaFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todas as máquinas</option>
          {maquinas.map(m => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        <Button variant="primary" onClick={openCreate}>+ Novo abastecimento</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando abastecimentos..." />
      ) : abastecimentos.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum abastecimento cadastrado</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeiro abastecimento</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Máquina</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Litros</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor total</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Horímetro</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Posto</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {abastecimentos.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{fmtDateISO(a.data)}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{a.maquina_nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(a.litros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} L</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{fmtBRL(Number(a.valor_total))}</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{a.horimetro != null ? Number(a.horimetro).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{a.posto ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(a)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(a)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
            {total} registro(s)
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar abastecimento' : 'Novo abastecimento'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Registrar abastecimento'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}

          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Máquina<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={form.maquinaId}
              onChange={e => set('maquinaId', e.target.value)}
              className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
            >
              <option value="">Selecione…</option>
              {maquinas.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Obra (opcional)
            </label>
            <select
              value={form.obraId}
              onChange={e => set('obraId', e.target.value)}
              className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
            >
              <option value="">Nenhuma</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data"
              name="abastecimento-data"
              type="date"
              value={form.data}
              onChange={e => set('data', e.target.value)}
              required
            />
            <Input
              label="Horímetro"
              name="abastecimento-horimetro"
              type="number"
              step="0.1"
              value={form.horimetro}
              onChange={e => set('horimetro', e.target.value)}
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
              onChange={e => set('litros', e.target.value)}
              required
            />
            <Input
              label="Valor total (R$)"
              name="abastecimento-valor"
              type="number"
              step="0.01"
              value={form.valorTotal}
              onChange={e => set('valorTotal', e.target.value)}
              required
            />
          </div>

          <Input
            label="Posto"
            name="abastecimento-posto"
            value={form.posto}
            onChange={e => set('posto', e.target.value)}
            placeholder="Opcional"
          />

          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              className="block w-full px-3 py-2 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover abastecimento"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover o abastecimento de <strong>{deleting?.maquina_nome}</strong> em {deleting ? fmtDateISO(deleting.data) : ''}? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
