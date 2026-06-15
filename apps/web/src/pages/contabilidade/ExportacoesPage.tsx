import { useState } from 'react'
import { exportacoesContabeis } from '../../services/contabilidade'

export function ExportacoesPage() {
  const currentYear = new Date().getFullYear()
  const [ecdAno, setEcdAno] = useState(currentYear)
  const [csvTipo, setCsvTipo] = useState<'lancamentos' | 'balancete' | 'dre'>('lancamentos')
  const [csvDe, setCsvDe] = useState('')
  const [csvAte, setCsvAte] = useState('')

  const ecdUrl = exportacoesContabeis.ecd(ecdAno, '')
  const csvUrl = exportacoesContabeis.csv(csvTipo, csvDe, csvAte)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Exportações Contábeis</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Geração de arquivos para o contador e obrigações acessórias</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CSV */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-none">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Exportar CSV</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Planilha para o contador — lançamentos, balancete ou DRE
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo de relatório</label>
              <select value={csvTipo} onChange={e => setCsvTipo(e.target.value as any)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="lancamentos">Lançamentos</option>
                <option value="balancete">Balancete de Verificação</option>
                <option value="dre">DRE</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Data inicial</label>
                <input type="date" value={csvDe} onChange={e => setCsvDe(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Data final</label>
                <input type="date" value={csvAte} onChange={e => setCsvAte(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          <a
            href={csvUrl}
            download={`${csvTipo}${csvDe ? '_' + csvDe : ''}.csv`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Baixar CSV
          </a>
        </div>

        {/* SPED ECD */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-none">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">SPED ECD — Escrituração Contábil Digital</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Arquivo .TXT para importação no PVA SPED · Blocos 0, I, J, 9
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <strong>Simples Nacional:</strong> empresas obrigadas são aquelas com receita bruta anual &gt; R$ 78 milhões ou que optaram pela ECD voluntária. Verifique com seu contador.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ano-exercício</label>
            <input
              type="number"
              value={ecdAno}
              onChange={e => setEcdAno(Number(e.target.value))}
              min={2020}
              max={currentYear}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <a
            href={ecdUrl}
            download={`sped_ecd_${ecdAno}.txt`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Baixar SPED ECD .TXT — {ecdAno}
          </a>
        </div>
      </div>

      {/* Informações */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Sobre os arquivos gerados</h3>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p><strong className="text-slate-700 dark:text-slate-300">CSV — Lançamentos:</strong> Todas as partidas contábeis do período com número, data, histórico, conta (código + nome), débito e crédito.</p>
          <p><strong className="text-slate-700 dark:text-slate-300">CSV — Balancete:</strong> Totais de débito, crédito e saldo por conta analítica no período.</p>
          <p><strong className="text-slate-700 dark:text-slate-300">CSV — DRE:</strong> Receitas, custos e despesas com resultado líquido.</p>
          <p><strong className="text-slate-700 dark:text-slate-300">SPED ECD:</strong> Arquivo texto delimitado por "|" conforme leiaute do SPED Contábil (Instrução Normativa RFB nº 2.004/2021). Blocos gerados: 0 (Abertura), I (Lançamentos + Plano de Contas), J (Balanço + DRE), 9 (Fechamento).</p>
        </div>
      </div>
    </div>
  )
}

export default ExportacoesPage
