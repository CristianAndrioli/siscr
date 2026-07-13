import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventariosService, STATUS_LABEL, type Inventario, type InventarioItem } from '../../services/inventarios';

export default function InventarioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inventario, setInventario] = useState<(Inventario & { itens: InventarioItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await inventariosService.get(id);
      setInventario(data);
      const iniciais: Record<string, string> = {};
      data.itens.forEach(it => { iniciais[it.id] = it.quantidade_contada != null ? String(it.quantidade_contada) : ''; });
      setContagens(iniciais);
    } catch {
      setError('Erro ao carregar inventário.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const salvarItem = async (itemId: string) => {
    if (!id) return;
    const valor = Number(contagens[itemId]);
    if (Number.isNaN(valor) || valor < 0) return;
    setSalvandoItem(itemId);
    try {
      await inventariosService.salvarContagem(id, itemId, valor);
      await load();
    } catch {
      setError('Erro ao salvar a contagem do item.');
    } finally {
      setSalvandoItem(null);
    }
  };

  const handleAplicar = async () => {
    if (!id) return;
    if (!window.confirm('Aplicar o inventário? Isso vai gerar ajustes de estoque para as diferenças encontradas e não pode ser desfeito.')) return;
    setAplicando(true);
    try {
      const r = await inventariosService.aplicar(id);
      alert(r.message);
      await load();
    } catch {
      setError('Erro ao aplicar o inventário.');
    } finally {
      setAplicando(false);
    }
  };

  const handleCancelar = async () => {
    if (!id || !window.confirm('Cancelar este inventário?')) return;
    await inventariosService.cancelar(id);
    await load();
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><Spinner /></div>;
  if (!inventario) return <div className="text-sm text-red-600">{error || 'Inventário não encontrado.'}</div>;

  const podeEditar = inventario.status === 'aberto';
  const itensContados = inventario.itens.filter(it => contagens[it.id] !== '' && contagens[it.id] !== undefined).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/estoque/inventario')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Inventário
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100">{inventario.descricao}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {inventario.location ?? 'Todos os locais'} · {inventario.itens.length} item(ns) · {itensContados} contado(s)
          </p>
        </div>
        <span className="badge bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 self-start">{STATUS_LABEL[inventario.status]}</span>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Produto</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Local</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sistema</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contado</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {inventario.itens.map(it => {
              const contado = contagens[it.id] !== '' && contagens[it.id] !== undefined ? Number(contagens[it.id]) : null;
              const diff = contado !== null ? contado - it.quantidade_sistema : null;
              return (
                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100">{it.produto_codigo} — {it.produto_descricao}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{it.location}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">{it.quantidade_sistema}</td>
                  <td className="px-4 py-2.5 text-right">
                    {podeEditar ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number" min="0" step="0.01"
                          className="input h-7 w-24 text-right text-xs"
                          value={contagens[it.id] ?? ''}
                          onChange={e => setContagens(prev => ({ ...prev, [it.id]: e.target.value }))}
                          onBlur={() => salvarItem(it.id)}
                          disabled={salvandoItem === it.id}
                        />
                      </div>
                    ) : (
                      <span className="font-mono text-slate-600 dark:text-slate-300">{it.quantidade_contada ?? '—'}</span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${diff === null ? 'text-slate-300 dark:text-slate-600' : diff === 0 ? 'text-slate-500 dark:text-slate-400' : diff > 0 ? 'text-positive dark:text-positive-dark' : 'text-negative'}`}>
                    {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {podeEditar && (
        <div className="flex gap-3">
          <button onClick={handleAplicar} disabled={aplicando} className="btn-primary">
            {aplicando ? 'Aplicando…' : 'Aplicar inventário'}
          </button>
          <button onClick={handleCancelar} className="btn-secondary text-red-600 dark:text-red-400">Cancelar inventário</button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
