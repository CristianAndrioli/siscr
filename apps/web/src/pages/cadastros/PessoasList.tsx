import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';

const TIPO_CADASTRO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  funcionario: 'Funcionário',
  transportadora: 'Transportadora',
};

const COLUMNS: SmartColumn<Pessoa>[] = [
  { key: 'codigo', label: '#', width: 70, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{v ?? '—'}</span> },
  { key: 'nome', label: 'Nome', width: 220, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'tipo_cadastro', label: 'Tipo', width: 130,
    render: v => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
        {TIPO_CADASTRO_LABEL[String(v)] ?? String(v)}
      </span>
    ) },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ', width: 150,
    render: v => <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{v ?? '—'}</span> },
  { key: 'email', label: 'E-mail', width: 200 },
  { key: 'telefone', label: 'Telefone', width: 130 },
];

export function PessoasList() {
  const navigate = useNavigate();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (busca = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await pessoasService.list({ search: busca });
      setPessoas(data);
    } catch {
      setError('Erro ao carregar cadastro de pessoas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja excluir "${nome}"?`)) return;
    try {
      await pessoasService.delete(id);
      setPessoas(prev => prev.filter(p => p.id !== id));
    } catch {
      alert('Erro ao excluir. Tente novamente.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pessoas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Clientes, fornecedores e funcionários</p>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(search); }} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Buscar
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<Pessoa>
        gridId="pessoas-list"
        data={pessoas}
        columns={COLUMNS}
        defaultSort={{ key: 'codigo', dir: 'desc' }}
        loading={loading}
        emptyMessage="Nenhuma pessoa cadastrada."
        onRowClick={p => navigate(`/cadastros/pessoas/${p.id}`)}
        onCreate={() => navigate('/cadastros/pessoas/novo')}
        createLabel="Nova Pessoa"
        actions={p => (
          <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(p.id), String(p.nome)); }} />
        )}
      />
    </div>
  );
}

export default PessoasList;
