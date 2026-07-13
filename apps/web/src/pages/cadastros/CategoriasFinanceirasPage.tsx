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
  categoriasFinanceirasService,
  type CategoriaFinanceira,
  type CategoriaFinanceiraForm,
  type CategoriaFinanceiraTipo,
} from '../../services/cadastros/categoriasFinanceiras';

const TIPO_LABEL: Record<CategoriaFinanceiraTipo, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

interface FormState {
  codigo: string;
  nome: string;
  tipo: CategoriaFinanceiraTipo;
  grupoDre: string;
  categoriaPaiId: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  codigo: '', nome: '', tipo: 'receita', grupoDre: '', categoriaPaiId: '', ativo: true,
};

function formFromCategoria(c: CategoriaFinanceira): FormState {
  return {
    codigo: c.codigo,
    nome: c.nome,
    tipo: c.tipo,
    grupoDre: c.grupo_dre ?? '',
    categoriaPaiId: c.categoria_pai_id ?? '',
    ativo: c.ativo === 1,
  };
}

export default function CategoriasFinanceirasPage() {
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'' | CategoriaFinanceiraTipo>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaFinanceira | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<CategoriaFinanceira | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await categoriasFinanceirasService.list({
        search: appliedSearch || undefined,
        tipo: tipoFiltro || undefined,
        limit: 200,
      });
      setCategorias(r.categorias);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar categorias financeiras.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, tipoFiltro]);

  useEffect(() => { void carregar(); }, [carregar]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: CategoriaFinanceira) => {
    setEditing(c);
    setForm(formFromCategoria(c));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.codigo.trim() || !form.nome.trim()) {
      setFormError('Preencha o código e o nome.');
      return;
    }

    const input: CategoriaFinanceiraForm = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      tipo: form.tipo,
      grupoDre: form.grupoDre.trim() || null,
      categoriaPaiId: form.categoriaPaiId || null,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (editing) {
        await categoriasFinanceirasService.update(editing.id, input);
        setSuccess('Categoria financeira atualizada.');
      } else {
        await categoriasFinanceirasService.create(input);
        setSuccess('Categoria financeira criada.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar categoria financeira.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await categoriasFinanceirasService.delete(deleting.id);
      setSuccess('Categoria financeira removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover categoria financeira.'));
      setDeleting(null);
    }
  };

  const categoriaPaiOptions = categorias
    .filter(c => c.id !== editing?.id && c.tipo === form.tipo)
    .map(c => ({ value: c.id, label: `${c.codigo} — ${c.nome}` }));

  return (
    <BaseListPage
      title="Categorias Financeiras"
      description="Plano de categorias de receitas e despesas para o financeiro e DRE gerencial"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('categorias-financeiras', [
        { label: 'Código', value: (r: CategoriaFinanceira) => r.codigo },
        { label: 'Nome', value: (r: CategoriaFinanceira) => r.nome },
        { label: 'Tipo', value: (r: CategoriaFinanceira) => TIPO_LABEL[r.tipo] ?? r.tipo },
        { label: 'Grupo DRE', value: (r: CategoriaFinanceira) => r.grupo_dre },
        { label: 'Ativo', value: (r: CategoriaFinanceira) => (r.ativo === 1 ? 'Sim' : 'Não') },
      ], categorias)}
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
            placeholder="Buscar em categorias financeiras…"
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as '' | CategoriaFinanceiraTipo)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Buscar
          </button>
        </form>
        <Button variant="primary" onClick={openCreate}>+ Novo</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando categorias financeiras..." />
      ) : categorias.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria financeira cadastrada</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeira categoria</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nome</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Grupo DRE</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Situação</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categorias.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-600 dark:text-slate-300">{c.codigo}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">{c.nome}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.tipo === 'receita' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">{c.grupo_dre || '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {c.ativo === 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(c)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(c)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title={editing ? `Editar categoria — ${editing.nome}` : 'Nova categoria financeira'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar categoria'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código"
              name="categoria-codigo"
              value={form.codigo}
              onChange={e => set('codigo', e.target.value)}
              required
            />
            <Select
              label="Tipo"
              name="categoria-tipo"
              value={form.tipo}
              onChange={e => set('tipo', e.target.value as CategoriaFinanceiraTipo)}
              options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Input
            label="Nome"
            name="categoria-nome"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Grupo DRE"
              name="categoria-grupo-dre"
              value={form.grupoDre}
              onChange={e => set('grupoDre', e.target.value)}
              placeholder="ex: Receita Operacional"
            />
            <Select
              label="Categoria pai"
              name="categoria-pai"
              value={form.categoriaPaiId}
              onChange={e => set('categoriaPaiId', e.target.value)}
              options={[{ value: '', label: '— Nenhuma (categoria raiz) —' }, ...categoriaPaiOptions]}
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Categoria ativa</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover categoria financeira"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a categoria <strong>{deleting?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
