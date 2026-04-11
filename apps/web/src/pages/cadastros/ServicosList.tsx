import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { servicosService, type Servico } from '../../services/cadastros/servicos';
import { fmtBRL } from '../../utils/format';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';

const COLUMNS: SmartColumn<Servico>[] = [
  { key: 'codigo', label: 'Cód.', width: 75, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">{v ?? '—'}</span> },
  { key: 'descricao', label: 'Descrição', width: 260, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'unidade', label: 'Unid.', width: 80 },
  { key: 'preco', label: 'Preço', width: 120, align: 'right',
    render: v => <span className="tabular-nums">{v != null ? fmtBRL(Number(v)) : '—'}</span> },
  { key: 'ativo', label: 'Ativo', width: 70, align: 'center', filterable: false,
    render: v => <span className={`inline-block w-2 h-2 rounded-full ${v ? 'bg-green-500' : 'bg-slate-300'}`} /> },
];

export function ServicosList() {
  const navigate = useNavigate();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (busca = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await servicosService.list({ search: busca });
      setServicos(data);
    } catch {
      setError('Erro ao carregar serviços.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, desc: string) => {
    if (!window.confirm(`Deseja excluir "${desc}"?`)) return;
    try {
      await servicosService.delete(id);
      setServicos(prev => prev.filter(s => s.id !== id));
    } catch {
      alert('Erro ao excluir. Tente novamente.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Serviços</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Catálogo de serviços prestados</p>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(search); }} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código ou descrição..."
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Buscar
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<Servico>
        gridId="servicos-list"
        data={servicos}
        columns={COLUMNS}
        defaultSort={{ key: 'codigo', dir: 'desc' }}
        loading={loading}
        emptyMessage="Nenhum serviço cadastrado."
        onRowClick={s => navigate(`/cadastros/servicos/${s.id}`)}
        onCreate={() => navigate('/cadastros/servicos/novo')}
        createLabel="Novo Serviço"
        actions={s => (
          <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(s.id), String(s.descricao)); }} />
        )}
      />
    </div>
  );
}

export default ServicosList;
