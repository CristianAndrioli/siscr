import { useState, useEffect, useCallback } from 'react'
import { planoContasService, type PlanoConta } from '../../services/contabilidade'

const TIPO_COLOR: Record<string, string> = {
  ativo:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  passivo:  'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  pl:       'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  receita:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  custo:    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  despesa:  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const TIPO_LABEL: Record<string, string> = {
  ativo: 'Ativo', passivo: 'Passivo', pl: 'Patrim. Líq.', receita: 'Receita', custo: 'Custo', despesa: 'Despesa',
}

export function PlanoContasPage() {
  const [contas, setContas] = useState<PlanoConta[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [filtroTipo, setFiltroTipo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const lista = await planoContasService.list()
      setContas(lista)
      // Expandir todos os grupos por padrão
      setExpandidos(new Set(lista.filter(c => c.nivel <= 2).map(c => c.id)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSeed = async () => {
    if (!window.confirm('Importar o plano de contas padrão para Simples Nacional? Esta ação não pode ser desfeita.')) return
    setSeeding(true)
    try {
      await planoContasService.seed()
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao importar plano de contas')
    } finally {
      setSeeding(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filtrar e montar árvore
  const filtered = contas.filter(c => {
    if (filtroTipo && c.tipo !== filtroTipo) return false
    if (search) {
      const q = search.toLowerCase()
      return c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q)
    }
    return true
  })

  // Agrupar por hierarquia — mostrar conta se ela ou seus filhos passaram no filtro
  const contasVisiveis = search || filtroTipo ? filtered : contas.filter(c => {
    if (c.nivel === 1) return true
    const pai = contas.find(p => p.id === c.conta_pai_id)
    if (!pai) return true
    return expandidos.has(pai.id)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Plano de Contas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Estrutura hierárquica de contas contábeis</p>
        </div>
        {contas.length === 0 && !loading && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {seeding ? 'Importando…' : 'Importar Plano Padrão (Simples Nacional)'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código ou descrição…"
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos os tipos</option>
          <option value="ativo">Ativo</option>
          <option value="passivo">Passivo</option>
          <option value="pl">Patrimônio Líquido</option>
          <option value="receita">Receita</option>
          <option value="custo">Custo</option>
          <option value="despesa">Despesa</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando…</div>
      ) : contas.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma conta cadastrada.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Clique em "Importar Plano Padrão" para começar.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-36">Código</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Descrição</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-28">Tipo</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-24 text-center">Natureza</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-24 text-center">Lançam.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contasVisiveis.map(conta => {
                const temFilhos = contas.some(c => c.conta_pai_id === conta.id)
                const indent = (conta.nivel - 1) * 20

                return (
                  <tr key={conta.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {conta.codigo}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
                        {temFilhos && !search && !filtroTipo ? (
                          <button
                            onClick={() => toggleExpand(conta.id)}
                            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {expandidos.has(conta.id) ? '▾' : '▸'}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className={conta.nivel === 1 ? 'font-bold text-slate-800 dark:text-slate-100'
                          : conta.nivel === 2 ? 'font-semibold text-slate-700 dark:text-slate-200'
                          : conta.nivel === 3 ? 'font-medium text-slate-700 dark:text-slate-300'
                          : 'text-slate-600 dark:text-slate-400'}>
                          {conta.descricao}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLOR[conta.tipo] ?? ''}`}>
                        {TIPO_LABEL[conta.tipo] ?? conta.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {conta.natureza}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {conta.aceita_lancamento === 1
                        ? <span className="text-emerald-600 dark:text-emerald-400"><svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></span>
                        : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            {contas.length} contas cadastradas · {contas.filter(c => c.aceita_lancamento).length} analíticas
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanoContasPage
