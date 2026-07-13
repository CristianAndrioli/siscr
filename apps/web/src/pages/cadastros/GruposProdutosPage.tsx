import { useCallback, useEffect, useState } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import {
  gruposProdutosService,
  type GrupoProduto,
  type GrupoProdutoForm,
} from '../../services/cadastros/gruposProdutos';

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

export default function GruposProdutosPage() {
  const [grupos, setGrupos] = useState<GrupoProduto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoProduto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<GrupoProduto | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await gruposProdutosService.list({ search: appliedSearch || undefined, limit: 200 });
      setGrupos(r.grupos);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar grupos de produtos.'));
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

  const openEdit = (g: GrupoProduto) => {
    setEditing(g);
    setForm(formFromGrupo(g));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.codigo.trim() || !form.descricao.trim()) {
      setFormError('Preencha o código e a descrição.');
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
      if (editing) {
        await gruposProdutosService.update(editing.id, input);
        setSuccess('Grupo de produtos atualizado.');
      } else {
        await gruposProdutosService.create(input);
        setSuccess('Grupo de produtos criado.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar grupo de produtos.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await gruposProdutosService.delete(deleting.id);
      setSuccess('Grupo de produtos removido.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover grupo de produtos.'));
      setDeleting(null);
    }
  };

  const gruposPaiOptions = grupos
    .filter(g => g.id !== editing?.id)
    .map(g => ({ value: g.id, label: `${g.codigo} — ${g.descricao}` }));

  return (
    <BaseListPage
      title="Grupos de Produtos"
      description="Classificação hierárquica de produtos em grupos e subgrupos"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('grupos-produtos', [
        { label: 'Código', value: (r: GrupoProduto) => r.codigo },
        { label: 'Descrição', value: (r: GrupoProduto) => r.descricao },
        { label: 'Ativo', value: (r: GrupoProduto) => (r.ativo === 1 ? 'Sim' : 'Não') },
      ], grupos)}
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
            placeholder="Buscar em grupos de produtos…"
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
        <LoadingSpinner fullScreen text="Carregando grupos de produtos..." />
      ) : grupos.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum grupo de produtos cadastrado</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeiro grupo</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Grupo pai</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Situação</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grupos.map(g => (
                <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-600 dark:text-slate-300">{g.codigo}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">{g.descricao}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                    {g.grupo_pai_id ? (grupos.find(x => x.id === g.grupo_pai_id)?.descricao ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    {g.ativo === 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(g)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(g)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title={editing ? `Editar grupo — ${editing.descricao}` : 'Novo grupo de produtos'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar grupo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código"
              name="grupo-codigo"
              value={form.codigo}
              onChange={e => set('codigo', e.target.value)}
              required
            />
            <Select
              label="Grupo pai"
              name="grupo-pai"
              value={form.grupoPaiId}
              onChange={e => set('grupoPaiId', e.target.value)}
              options={[{ value: '', label: '— Nenhum (grupo raiz) —' }, ...gruposPaiOptions]}
            />
          </div>
          <Input
            label="Descrição"
            name="grupo-descricao"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            required
          />
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Grupo ativo</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover grupo de produtos"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover o grupo <strong>{deleting?.descricao}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
