import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { metasVendasService, type MetaVendedor } from '../../services/metasVendas';
import { fmtBRL } from '../../utils/format';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function MetasVendasPage() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [vendedores, setVendedores] = useState<MetaVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [valorEdit, setValorEdit] = useState('');
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    metasVendasService.list(ano, mes)
      .then(setVendedores)
      .catch(() => setError('Erro ao carregar metas de vendas.'))
      .finally(() => setLoading(false));
  }, [ano, mes]);

  useEffect(() => { load(); }, [load]);

  const mudarMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const abrirEdicao = (v: MetaVendedor) => {
    setEditando(v.id);
    setValorEdit(String(v.valor_meta ?? 0));
  };

  const salvarMeta = async (vendedorId: string) => {
    setSalvando(true);
    try {
      await metasVendasService.salvar(vendedorId, ano, mes, Number(valorEdit) || 0);
      setEditando(null);
      load();
    } catch {
      setError('Erro ao salvar meta.');
    } finally {
      setSalvando(false);
    }
  };

  const totalMeta = vendedores.reduce((s, v) => s + (v.valor_meta ?? 0), 0);
  const totalRealizado = vendedores.reduce((s, v) => s + v.valor_realizado, 0);

  return (
    <Layout>
      <div className="space-y-5 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">Metas de Vendas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Acompanhamento de meta x realizado por vendedor</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => mudarMes(-1)} className="btn-secondary px-2.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-32 text-center font-mono">{MESES[mes - 1]}/{ano}</span>
            <button onClick={() => mudarMes(1)} className="btn-secondary px-2.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        </div>

        {error && <div className="px-4 py-3 rounded-card border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Meta total</p>
            <p className="text-[22px] font-mono font-bold text-slate-900 dark:text-slate-100">{fmtBRL(totalMeta)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Realizado total</p>
            <p className="text-[22px] font-mono font-bold text-positive dark:text-positive-dark">{fmtBRL(totalRealizado)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Atingimento</p>
            <p className="text-[22px] font-mono font-bold text-slate-900 dark:text-slate-100">{totalMeta > 0 ? `${((totalRealizado / totalMeta) * 100).toFixed(0)}%` : '—'}</p>
          </div>
        </div>

        <div className="card p-5">
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>
          ) : vendedores.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-10 text-center">
              Nenhum vendedor cadastrado. Cadastre em <span className="font-medium">Cadastros › Vendedores</span>.
            </p>
          ) : (
            <div className="space-y-4">
              {vendedores.map(v => {
                const meta = v.valor_meta ?? 0;
                const pct = meta > 0 ? Math.min(100, (v.valor_realizado / meta) * 100) : 0;
                const barCls = pct >= 100 ? 'bg-positive dark:bg-positive-dark' : pct >= 60 ? 'bg-warn' : 'bg-negative';
                return (
                  <div key={v.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{v.nome}</span>
                      {editando === v.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" step="0.01" autoFocus
                            className="input w-32 h-7 text-xs"
                            value={valorEdit}
                            onChange={e => setValorEdit(e.target.value)}
                          />
                          <button onClick={() => salvarMeta(v.id)} disabled={salvando} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Salvar</button>
                          <button onClick={() => setEditando(null)} className="text-xs text-slate-400 hover:underline">Cancelar</button>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {fmtBRL(v.valor_realizado)} / {fmtBRL(meta)}
                          <button onClick={() => abrirEdicao(v)} className="ml-2 text-brand-600 dark:text-brand-400 hover:underline font-semibold">Editar meta</button>
                        </span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
