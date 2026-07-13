import { useCallback, useEffect, useState } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import {
  unidadesMedidaService,
  type UnidadeMedida,
  type UnidadeMedidaForm,
} from '../../services/cadastros/unidadesMedida';

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

export default function UnidadesMedidaPage() {
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UnidadeMedida | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<UnidadeMedida | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await unidadesMedidaService.list({ search: appliedSearch || undefined, limit: 200 });
      setUnidades(r.unidades);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar unidades de medida.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => { void carregar(); }, [carregar]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: UnidadeMedida) => {
    setEditing(u);
    setForm(formFromUnidade(u));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.sigla.trim() || !form.descricao.trim()) {
      setFormError('Preencha a sigla e a descrição.');
      return;
    }
    const fator = form.fatorConversao.trim() ? Number(form.fatorConversao.replace(',', '.')) : undefined;
    if (fator !== undefined && (Number.isNaN(fator) || fator <= 0)) {
      setFormError('Informe um fator de conversão numérico válido.');
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
      if (editing) {
        await unidadesMedidaService.update(editing.id, input);
        setSuccess('Unidade de medida atualizada.');
      } else {
        await unidadesMedidaService.create(input);
        setSuccess('Unidade de medida criada.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar unidade de medida.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await unidadesMedidaService.delete(deleting.id);
      setSuccess('Unidade de medida removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover unidade de medida.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Unidades de Medida"
      description="Unidades utilizadas para quantificação de produtos (UN, KG, CX, etc.)"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('unidades-medida', [
        { label: 'Sigla', value: (r: UnidadeMedida) => r.sigla },
        { label: 'Descrição', value: (r: UnidadeMedida) => r.descricao },
        { label: 'Fator de conversão', value: (r: UnidadeMedida) => r.fator_conversao },
        { label: 'Ativo', value: (r: UnidadeMedida) => (r.ativo === 1 ? 'Sim' : 'Não') },
      ], unidades)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form
          onSubmit={e => { e.preventDefault(); setAppliedSearch(searchInput.trim()); }}
          className="flex gap-2 flex-1"
        >
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar em unidades de medida…"
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Buscar
          </button>
        </form>
        <Button variant="primary" onClick={openCreate}>+ Novo</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando unidades de medida..." />
      ) : unidades.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma unidade de medida cadastrada</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeira unidade</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sigla</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fator conversão</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Situação</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unidades.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-600 dark:text-slate-300">{u.sigla}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">{u.descricao}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-slate-600 dark:text-slate-300 font-mono">{u.fator_conversao ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {u.ativo === 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title={editing ? `Editar unidade — ${editing.sigla}` : 'Nova unidade de medida'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar unidade'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sigla"
              name="unidade-sigla"
              value={form.sigla}
              onChange={e => set('sigla', e.target.value)}
              placeholder="ex: UN, KG, CX"
              required
            />
            <Input
              label="Fator de conversão"
              name="unidade-fator"
              value={form.fatorConversao}
              onChange={e => set('fatorConversao', e.target.value)}
              placeholder="1"
              helpText="Relação com a unidade base (padrão 1)"
            />
          </div>
          <Input
            label="Descrição"
            name="unidade-descricao"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="ex: Unidade, Quilograma, Caixa"
            required
          />
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Unidade ativa</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover unidade de medida"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a unidade <strong>{deleting?.sigla}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
