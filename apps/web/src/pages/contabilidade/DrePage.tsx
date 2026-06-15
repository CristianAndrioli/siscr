import { useState, useCallback } from 'react'
import { relatoriosContabeis, exportacoesContabeis, type DreLinha, type DreResumo } from '../../services/contabilidade'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(part: number, total: number) {
  if (!total) return '—'
  return ((part / total) * 100).toFixed(1) + '%'
}

export function DrePage() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [dados, setDados] = useState<{ linhas: DreLinha[]; resumo: DreResumo } | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = useCallback(async () => {
    if (!de || !ate) { alert('Informe período de/até'); return }
    setLoading(true)
    try {
      const r = await relatoriosContabeis.dre(de, ate)
      setDados(r)
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao carregar DRE')
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  const csvUrl = exportacoesContabeis.csv('dre', de, ate)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">DRE — Demonstração do Resultado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Resultado econômico do período</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <button onClick={buscar} disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Carregando…' : 'Gerar DRE'}
        </button>
        {dados && (
          <a href={csvUrl} download className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            ↓ Exportar CSV
          </a>
        )}
      </div>

      {dados && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Resumo cards */}
          <div className="lg:col-span-1 space-y-3">
            <SummaryCard label="Receita Bruta" value={dados.resumo.receitaBruta} color="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard label="(-) Custos" value={dados.resumo.totalCustos} color="text-amber-600 dark:text-amber-400" negative />
            <SummaryCard label="Lucro Bruto" value={dados.resumo.lucroBruto} color="text-blue-600 dark:text-blue-400" highlight />
            <SummaryCard label="(-) Despesas" value={dados.resumo.totalDespesas} color="text-red-600 dark:text-red-400" negative />
            <div className={`rounded-xl p-4 border-2 ${dados.resumo.resultadoLiq >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {dados.resumo.resultadoLiq >= 0 ? 'Lucro Líquido' : 'Prejuízo Líquido'}
              </div>
              <div className={`text-2xl font-bold ${dados.resumo.resultadoLiq >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {fmtBRL(Math.abs(dados.resumo.resultadoLiq))}
              </div>
              {dados.resumo.receitaBruta > 0 && (
                <div className="text-xs text-slate-400 mt-1">
                  Margem: {pct(dados.resumo.resultadoLiq, dados.resumo.receitaBruta)}
                </div>
              )}
            </div>
          </div>

          {/* Detalhamento */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-left">Conta</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right w-20">% Rec.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dados.linhas.map((l, i) => (
                  <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${l.tipo === 'subtotal' ? 'bg-slate-50 dark:bg-slate-800/40 font-semibold' : ''}`}>
                    <td className={`px-4 py-2 ${l.tipo === 'subtotal' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                      {l.descricao}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${l.saldo_liquido < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {fmtBRL(l.saldo_liquido)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-400">
                      {pct(Math.abs(l.saldo_liquido), dados.resumo.receitaBruta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!dados && !loading && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-400 text-sm">Selecione um período e clique em "Gerar DRE".</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color, negative = false, highlight = false }: {
  label: string; value: number; color: string; negative?: boolean; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{negative ? '(' : ''}{fmtBRL(Math.abs(value))}{negative ? ')' : ''}</div>
    </div>
  )
}

export default DrePage
