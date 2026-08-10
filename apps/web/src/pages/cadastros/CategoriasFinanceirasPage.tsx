import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import {
  categoriasFinanceirasService,
  type CategoriaFinanceira,
  type CategoriaFinanceiraTipo,
} from '../../services/cadastros/categoriasFinanceiras';

const BASE = '/cadastros/categorias-financeiras';

const TIPO_LABEL: Record<CategoriaFinanceiraTipo, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

export default function CategoriasFinanceirasPage() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'' | CategoriaFinanceiraTipo>('');
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
        <Button variant="primary" onClick={() => navigate(`${BASE}/novo`)}>+ Novo</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando categorias financeiras..." />
      ) : categorias.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria financeira cadastrada</p>
          <Button variant="primary" size="sm" onClick={() => navigate(`${BASE}/novo`)} className="mt-4">Criar primeira categoria</Button>
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
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  onClick={() => navigate(`${BASE}/${c.id}`)}
                >
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
                  <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => navigate(`${BASE}/${c.id}`)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
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
