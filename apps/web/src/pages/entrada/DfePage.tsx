import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Button from '../../components/common/Button'
import Alert from '../../components/common/Alert'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  dfeAtualizarStatus,
  dfeBaixarXml,
  dfeConsultar,
  dfeImportarNoErp,
  dfeListarDocumentos,
  dfeStatus,
  type DfeDocumento,
  type DfeSyncStatus,
} from '../../services/entradaService'

interface EmpresaRow { id: string; razao_social?: string; nome_fantasia?: string; cnpj?: string }

const TIPO_BADGE: Record<DfeDocumento['tipo'], { label: string; cls: string }> = {
  nfe_completa: { label: 'NF-e completa', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  resumo: { label: 'Resumo', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  evento: { label: 'Evento', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

const STATUS_BADGE: Record<DfeDocumento['status'], { label: string; cls: string }> = {
  novo: { label: 'Novo', cls: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' },
  importada: { label: 'Importada', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  ignorada: { label: 'Ignorada', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500' },
}

function fmtCnpj(v: string | null): string {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length !== 14) return v
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function DfePage() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [sync, setSync] = useState<DfeSyncStatus | null>(null)
  const [docs, setDocs] = useState<DfeDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [consultando, setConsultando] = useState(false)
  const [acaoId, setAcaoId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    api.get('/tenant/info/empresas')
      .then(r => {
        const list = (r.data.empresas ?? []) as EmpresaRow[]
        setEmpresas(list)
        if (list.length > 0) setEmpresaId(list[0].id)
        else setLoading(false)
      })
      .catch(() => { setError('Não foi possível carregar as empresas.'); setLoading(false) })
  }, [])

  const carregar = useCallback(async (eid: string) => {
    setLoading(true)
    setError('')
    try {
      const [s, d] = await Promise.all([dfeStatus(eid), dfeListarDocumentos(eid)])
      setSync(s)
      setDocs(d)
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao carregar documentos DFe.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (empresaId) void carregar(empresaId)
  }, [empresaId, carregar])

  const handleConsultar = async () => {
    if (!empresaId) return
    setConsultando(true)
    setError('')
    setInfo('')
    try {
      const r = await dfeConsultar(empresaId)
      setInfo(r.message)
      await carregar(empresaId)
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro na consulta à SEFAZ.')
      await carregar(empresaId)
    } finally {
      setConsultando(false)
    }
  }

  const handleImportar = async (doc: DfeDocumento) => {
    setAcaoId(doc.id)
    setError('')
    try {
      const r = await dfeImportarNoErp(doc, empresaId)
      setInfo(r.message || 'NF-e importada no ERP.')
      await carregar(empresaId)
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao importar a NF-e.')
    } finally {
      setAcaoId(null)
    }
  }

  const handleIgnorar = async (doc: DfeDocumento) => {
    setAcaoId(doc.id)
    try {
      await dfeAtualizarStatus(doc.id, doc.status === 'ignorada' ? 'novo' : 'ignorada')
      await carregar(empresaId)
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao atualizar status.')
    } finally {
      setAcaoId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Distribuição DFe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            NF-e emitidas contra o CNPJ da empresa, baixadas automaticamente do Ambiente Nacional da SEFAZ
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {empresas.length > 1 && (
            <select
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
              className="h-9 pl-3 pr-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social || e.cnpj}</option>
              ))}
            </select>
          )}
          <Button variant="primary" onClick={handleConsultar} loading={consultando} disabled={!empresaId}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Consultar agora
          </Button>
        </div>
      </div>

      {info && <Alert type="success" message={info} onClose={() => setInfo('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Status da sincronização */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">Último NSU</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
            {sync ? String(Number(sync.ult_nsu)) : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">NSU máximo (SEFAZ)</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
            {sync?.max_nsu ? String(Number(sync.max_nsu)) : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">Última consulta</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1.5">
            {fmtDateTime(sync?.ultima_consulta_em ?? null)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">Status</p>
          <p className="mt-1.5">
            {sync?.ultimo_status ? (
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${sync.ultimo_status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                <span className={`w-2 h-2 rounded-full ${sync.ultimo_status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {sync.ultimo_status === 'ok' ? 'OK' : 'Erro'}
              </span>
            ) : <span className="text-sm text-slate-400">Nunca consultado</span>}
          </p>
        </div>
      </div>

      {sync?.ultimo_status === 'erro' && sync.ultimo_erro && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <strong>Último erro:</strong> {sync.ultimo_erro}
          {sync.ultimo_erro.includes('mTLS') && (
            <>
              {' '}Configure a ponte em{' '}
              <Link to="/configuracoes/conexoes" className="underline font-medium">Configurações → Conexões</Link>{' '}
              com o nome <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 rounded">sefaz-dfe</code>.
            </>
          )}
        </div>
      )}

      {/* Tabela de documentos */}
      {loading ? (
        <LoadingSpinner fullScreen text="Carregando documentos..." />
      ) : docs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum documento baixado ainda</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Clique em "Consultar agora" para buscar as NF-e emitidas contra o CNPJ da empresa.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {['NSU', 'Tipo', 'Emitente', 'CNPJ', 'Valor', 'Emissão', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">{String(Number(doc.nsu))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIPO_BADGE[doc.tipo].cls}`}>
                        {TIPO_BADGE[doc.tipo].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={doc.emitente_nome ?? ''}>
                      {doc.emitente_nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-xs">
                      {fmtCnpj(doc.emitente_cnpj)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                      {fmtBRL(doc.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {fmtDateTime(doc.dh_emissao)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[doc.status].cls}`}>
                        {STATUS_BADGE[doc.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void dfeBaixarXml(doc)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors"
                          title="Baixar XML"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                        {doc.tipo === 'nfe_completa' && doc.status === 'novo' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={acaoId === doc.id}
                            onClick={() => handleImportar(doc)}
                          >
                            Importar
                          </Button>
                        )}
                        {doc.status !== 'importada' && (
                          <button
                            onClick={() => handleIgnorar(doc)}
                            disabled={acaoId === doc.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                            title={doc.status === 'ignorada' ? 'Reativar' : 'Ignorar'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              {doc.status === 'ignorada'
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />}
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sobre */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-600 dark:text-slate-400 space-y-2">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Como funciona</h3>
        <p>
          A consulta usa o webservice <strong>NFeDistribuicaoDFe</strong> do Ambiente Nacional (gratuito) e é
          incremental: cada chamada traz o próximo lote de até 50 documentos a partir do último NSU processado.
          Documentos ficam disponíveis na SEFAZ por 90 dias.
        </p>
        <p>
          <strong>Resumos (resNFe)</strong> indicam que existe uma NF-e contra o CNPJ; a <strong>NF-e completa
          (procNFe)</strong> pode ser importada no ERP com um clique — cria a nota de entrada e segue o fluxo
          normal (estoque, contas a pagar).
        </p>
      </div>
    </div>
  )
}

export default DfePage
