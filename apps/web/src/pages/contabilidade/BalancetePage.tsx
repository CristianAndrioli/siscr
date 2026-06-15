import { useState, useCallback } from 'react'
import { relatoriosContabeis, exportacoesContabeis, type BalanceteLinha } from '../../services/contabilidade'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIPO_COLOR: Record<string, string> = {
  ativo:   'text-blue-600 dark:text-blue-400',
  passivo: 'text-orange-600 dark:text-orange-400',
  pl:      'text-violet-600 dark:text-violet-400',
  receita: 'text-emerald-600 dark:text-emerald-400',
  custo:   'text-amber-600 dark:text-amber-400',
  despesa: 'text-red-600 dark:text-red-400',
}

export function BalancetePage() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [dados, setDados] = useState<{ contas: BalanceteLinha[]; total: { debito: number; credito: number } } | null>(null)
  const [loading, setLoading] = useState(false)

  const buscar = useCallback(async () => {
    if (!de || !ate) { alert('Informe período de/até'); return }
    setLoading(true)
    try {
      const r = await relatoriosContabeis.balancete(de, ate)
      setDados(r)
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao carregar balancete')
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  const csvUrl = exportacoesContabeis.csv('balancete', de, ate)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Balancete de Verificação</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Totais de débito e crédito por conta no período</p>
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
          {loading ? 'Carregando…' : 'Gerar Balancete'}
        </button>
        {dados && (
          <a href={csvUrl} download className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            ↓ Exportar CSV
          </a>
        )}
      </div>

      {/* Resultado */}
      {dados && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-32">Código</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Conta</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-28">Tipo</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-36 text-right">Total Débito</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-36 text-right">Total Crédito</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-36 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dados.contas.map(c => {
                const saldo = c.natureza === 'devedora'
                  ? c.total_debito - c.total_credito
                  : c.total_credito - c.total_debito
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{c.codigo}</td>
                    <td className="px-4 py-2">
                      <span style={{ paddingLeft: (c.nivel - 1) * 16 }}
                        className={c.nivel === 1 ? 'font-bold text-slate-800 dark:text-slate-100'
                          : c.nivel === 2 ? 'font-semibold text-slate-700 dark:text-slate-200'
                          : 'text-slate-600 dark:text-slate-400'}>
                        {c.descricao}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-xs capitalize ${TIPO_COLOR[c.tipo] ?? ''}`}>{c.tipo}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtBRL(c.total_debito)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtBRL(c.total_credito)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${saldo >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtBRL(saldo)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold border-t-2 border-slate-300 dark:border-slate-600">
                <td className="px-4 py-3" colSpan={3}>TOTAL</td>
                <td className="px-4 py-3 text-right font-mono">{fmtBRL(dados.total.debito)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtBRL(dados.total.credito)}</td>
                <td className={`px-4 py-3 text-right font-mono ${Math.abs(dados.total.debito - dados.total.credito) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {Math.abs(dados.total.debito - dados.total.credito) < 0.01 ? 'Balanceado ✓' : fmtBRL(dados.total.debito - dados.total.credito)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!dados && !loading && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-400 text-sm">Selecione um período e clique em "Gerar Balancete".</p>
        </div>
      )}
    </div>
  )
}

export default BalancetePage
