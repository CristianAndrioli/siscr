import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';

const TIPO_CADASTRO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  funcionario: 'Funcionário',
  transportadora: 'Transportadora',
};

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pessoas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Clientes, fornecedores e funcionários
          </p>
        </div>
        <button
          onClick={() => navigate('/cadastros/pessoas/novo')}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Pessoa
        </button>
      </div>

      {/* Busca */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Buscar
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : pessoas.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm">Nenhuma pessoa cadastrada.</p>
            <button
              onClick={() => navigate('/cadastros/pessoas/novo')}
              className="mt-2 text-brand-500 hover:text-brand-600 text-sm underline"
            >
              Cadastrar a primeira
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-16">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Telefone</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {pessoas.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/cadastros/pessoas/${p.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{p.codigo ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.nome}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {TIPO_CADASTRO_LABEL[p.tipo_cadastro] ?? p.tipo_cadastro}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.cpf_cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.telefone ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(p.id, p.nome); }}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                      title="Excluir"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PessoasList;
