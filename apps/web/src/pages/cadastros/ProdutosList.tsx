import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { produtosService, type Produto } from '../../services/cadastros/produtos';

function fmtPreco(valor?: number) {
  if (valor === undefined || valor === null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProdutosList() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (busca = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await produtosService.list({ search: busca });
      setProdutos(data);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const handleDelete = async (id: string, desc: string) => {
    if (!window.confirm(`Deseja excluir "${desc}"?`)) return;
    try {
      await produtosService.delete(id);
      setProdutos(prev => prev.filter(p => p.id !== id));
    } catch {
      alert('Erro ao excluir. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Produtos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Catálogo de produtos</p>
        </div>
        <button
          onClick={() => navigate('/cadastros/produtos/novo')}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Produto
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código ou descrição..."
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

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : produtos.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p className="text-sm">Nenhum produto cadastrado.</p>
            <button
              onClick={() => navigate('/cadastros/produtos/novo')}
              className="mt-2 text-brand-500 hover:text-brand-600 text-sm underline"
            >
              Cadastrar o primeiro
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Código</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Unidade</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Preço de Venda</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Ativo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {produtos.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/cadastros/produtos/${p.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{p.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{p.descricao}</div>
                    {p.sku && <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">SKU: {p.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.unidade}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{fmtPreco(p.preco_venda)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.ativo ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(p.id, p.descricao); }}
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

export default ProdutosList;
