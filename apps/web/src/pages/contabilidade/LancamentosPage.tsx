import { useState, useEffect, useCallback } from 'react'
import {
  lancamentosService, planoContasService,
  type Lancamento, type PlanoConta, type LancamentoInput,
} from '../../services/contabilidade'

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type PartidaRow = { contaId: string; debito: string; credito: string }

export function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [contas, setContas] = useState<PlanoConta[]>([])
  const [saving, setSaving] = useState(false)

  // form state
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10))
  const [historico, setHistorico] = useState('')
  const [partidas, setPartidas] = useState<PartidaRow[]>([
    { contaId: '', debito: '', credito: '' },
    { contaId: '', debito: '', credito: '' },
  ])

  const LIMIT = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await lancamentosService.list({ de: de || undefined, ate: ate || undefined, page, limit: LIMIT })
      setLancamentos(r.lancamentos)
      setTotal(r.total)
    } finally {
      setLoading(false)
    }
  }, [de, ate, page])

  useEffect(() => { load() }, [load])

  const loadContas = useCallback(async () => {
    if (contas.length > 0) return
    const lista = await planoContasService.list()
    setContas(lista.filter(c => c.aceita_lancamento === 1))
  }, [contas.length])

  const openModal = async () => {
    await loadContas()
    setShowModal(true)
  }

  const addPartida = () => setPartidas(prev => [...prev, { contaId: '', debito: '', credito: '' }])
  const removePartida = (i: number) => setPartidas(prev => prev.filter((_, idx) => idx !== i))
  const updatePartida = (i: number, field: keyof PartidaRow, value: string) =>
    setPartidas(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  const totalDebito = partidas.reduce((s, p) => s + (parseFloat(p.debito) || 0), 0)
  const totalCredito = partidas.reduce((s, p) => s + (parseFloat(p.credito) || 0), 0)
  const balanced = Math.abs(totalDebito - totalCredito) < 0.01 && totalDebito > 0

  const handleSave = async () => {
    if (!historico.trim()) { alert('Informe o histórico'); return }
    if (!balanced) { alert('Débitos e créditos devem ser iguais e maiores que zero'); return }
    setSaving(true)
    try {
      const input: LancamentoInput = {
        dataLancamento,
        historico,
        partidas: partidas
          .filter(p => p.contaId)
          .map(p => ({
            contaId: p.contaId,
            debito: parseFloat(p.debito) || 0,
            credito: parseFloat(p.credito) || 0,
          })),
      }
      await lancamentosService.create(input)
      setShowModal(false)
      setHistorico('')
      setPartidas([{ contaId: '', debito: '', credito: '' }, { contaId: '', debito: '', credito: '' }])
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao salvar lançamento')
    } finally {
      setSaving(false)
    }
  }

  const handleEstornar = async (id: string, numero: number) => {
    if (!window.confirm(`Estornar o lançamento nº ${numero}? Esta ação cria um lançamento inverso.`)) return
    try {
      await lancamentosService.estornar(id)
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao estornar')
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Lançamentos Contábeis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Partida dobrada · {total} registros</p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Lançamento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 dark:text-slate-400">De:</label>
          <input type="date" value={de} onChange={e => { setDe(e.target.value); setPage(1) }}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 dark:text-slate-400">Até:</label>
          <input type="date" value={ate} onChange={e => { setAte(e.target.value); setPage(1) }}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        {(de || ate) && (
          <button onClick={() => { setDe(''); setAte(''); setPage(1) }}
            className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando…</div>
        ) : lancamentos.length === 0 ? (
          <div className="text-center py-16 text-slate-400">Nenhum lançamento encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-16">Nº</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-28">Data</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Histórico</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-28 text-right">Valor</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-24 text-center">Status</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lancamentos.map(lc => {
                const valor = lc.partidas?.reduce((s, p) => s + p.debito, 0) ?? 0
                return (
                  <tr key={lc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">#{lc.numero}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmtDate(lc.data_lancamento)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <div>{lc.historico}</div>
                      {lc.origem_tipo && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Origem: {lc.origem_tipo} · {lc.origem_id?.slice(0, 8)}
                        </div>
                      )}
                      {/* Partidas inline */}
                      {lc.partidas?.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {lc.partidas.map(p => (
                            <div key={p.id} className="text-xs text-slate-400 flex gap-3">
                              <span className="font-mono">{p.conta_codigo}</span>
                              <span>{p.conta_descricao}</span>
                              {p.debito > 0 && <span className="text-blue-600 dark:text-blue-400 ml-auto">D {fmtBRL(p.debito)}</span>}
                              {p.credito > 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-auto">C {fmtBRL(p.credito)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{fmtBRL(valor)}</td>
                    <td className="px-4 py-3 text-center">
                      {lc.status === 'estornado' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Estornado</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lc.status === 'ativo' && (
                        <button
                          onClick={() => handleEstornar(lc.id, lc.numero)}
                          title="Estornar"
                          className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          ↩
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">
              ‹ Anterior
            </button>
            <span className="text-slate-500 dark:text-slate-400">Página {page} de {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800">
              Próxima ›
            </button>
          </div>
        )}
      </div>

      {/* Modal novo lançamento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Novo Lançamento Contábil</h2>
              <button onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Data</label>
                  <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Histórico *</label>
                <input value={historico} onChange={e => setHistorico(e.target.value)}
                  placeholder="Descrição do lançamento…"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Partidas (partida dobrada)</label>
                  <button onClick={addPartida}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline">+ Linha</button>
                </div>

                <div className="space-y-2">
                  {partidas.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_120px_24px] gap-2 items-center">
                      <select value={p.contaId} onChange={e => updatePartida(i, 'contaId', e.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">Selecionar conta…</option>
                        {contas.map(c => (
                          <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
                        ))}
                      </select>
                      <input type="number" placeholder="Débito" value={p.debito}
                        onChange={e => updatePartida(i, 'debito', e.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs text-right bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <input type="number" placeholder="Crédito" value={p.credito}
                        onChange={e => updatePartida(i, 'credito', e.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs text-right bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <button onClick={() => removePartida(i)}
                        className="text-slate-300 hover:text-red-500 text-sm leading-none">×</button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-3 text-xs font-semibold">
                  <span className="text-blue-600 dark:text-blue-400">Total D: {fmtBRL(totalDebito)}</span>
                  <span className={balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                    Total C: {fmtBRL(totalCredito)} {balanced ? '✓' : '✗ desequilibrado'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !balanced}
                className="px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LancamentosPage
