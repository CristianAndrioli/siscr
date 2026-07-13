import { useCallback, useEffect, useState } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import { fmtDateISO } from '../../utils/format';
import {
  manutencoesFrotaService,
  TIPO_LABEL,
  STATUS_LABEL,
  type ManutencaoFrota,
  type ManutencaoFrotaForm,
  type ManutencaoTipo,
  type ManutencaoStatus,
} from '../../services/manutencoesFrota';
import { maquinasService, type Maquina } from '../../services/frota';

const STATUS_STYLE: Record<ManutencaoStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

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

export default function ManutencoesFrotaPage() {
  const [manutencoes, setManutencoes] = useState<ManutencaoFrota[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaFiltro, setMaquinaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManutencaoFrota | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<ManutencaoFrota | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await manutencoesFrotaService.list({
        maquinaId: maquinaFiltro || undefined,
        status: statusFiltro || undefined,
        limit: 200,
      });
      setManutencoes(r.manutencoes);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar manutenções.'));
    } finally {
      setLoading(false);
    }
  }, [maquinaFiltro, statusFiltro]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    (async () => {
      try {
        const m = await maquinasService.list({ limit: 200 });
        setMaquinas(m.maquinas);
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

  const openEdit = (m: ManutencaoFrota) => {
    setEditing(m);
    setForm(formFromManutencao(m));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

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
        setSuccess('Manutenção atualizada.');
      } else {
        await manutencoesFrotaService.create(input);
        setSuccess('Manutenção cadastrada.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar manutenção.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await manutencoesFrotaService.delete(deleting.id);
      setSuccess('Manutenção removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover manutenção.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Manutenções Programadas"
      description="Agenda de manutenções preventivas e corretivas das máquinas"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('manutencoes-frota', [
        { label: 'Máquina', value: (r: ManutencaoFrota) => r.maquina_nome ?? '' },
        { label: 'Tipo', value: (r: ManutencaoFrota) => TIPO_LABEL[r.tipo] },
        { label: 'Descrição', value: (r: ManutencaoFrota) => r.descricao },
        { label: 'Data prevista', value: (r: ManutencaoFrota) => r.data_prevista ?? '' },
        { label: 'Status', value: (r: ManutencaoFrota) => STATUS_LABEL[r.status] },
        { label: 'Custo', value: (r: ManutencaoFrota) => r.custo ?? '' },
      ], manutencoes)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <Button variant="primary" onClick={openCreate}>+ Nova manutenção</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando manutenções..." />
      ) : manutencoes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma manutenção cadastrada</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeira manutenção</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Máquina</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data prevista</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {manutencoes.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{m.maquina_nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{TIPO_LABEL[m.tipo]}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={m.descricao}>{m.descricao}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{m.data_prevista ? fmtDateISO(m.data_prevista) : '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title={editing ? 'Editar manutenção' : 'Nova manutenção'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar manutenção'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => set('tipo', e.target.value as ManutencaoTipo)}
                className="block w-full h-9 px-3 rounded-lg border text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:border-brand-500 focus:ring-brand-500/20"
              >
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as ManutencaoStatus)}
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
              onChange={e => set('descricao', e.target.value)}
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
              onChange={e => set('dataPrevista', e.target.value)}
            />
            <Input
              label="Custo (R$)"
              name="manutencao-custo"
              type="number"
              step="0.01"
              value={form.custo}
              onChange={e => set('custo', e.target.value)}
              placeholder="Opcional"
            />
          </div>

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
        title="Remover manutenção"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a manutenção <strong>{deleting?.descricao}</strong> de <strong>{deleting?.maquina_nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
