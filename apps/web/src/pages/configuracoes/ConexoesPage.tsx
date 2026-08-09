import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Alert from '../../components/common/Alert'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  conexoesService,
  type Conexao,
  type ConexaoAuthTipo,
  type ConexaoTipo,
} from '../../services/conexoes'

const TIPO_LABEL: Record<ConexaoTipo, string> = {
  http: 'HTTP genérico',
  dominio: 'Domínio (Thomson Reuters)',
  onvio: 'Onvio (Thomson Reuters)',
  alterdata: 'Alterdata',
  sefaz_dfe: 'Ponte SEFAZ DFe / NF-e (mTLS)',
}

const AUTH_LABEL: Record<ConexaoAuthTipo, string> = {
  none: 'Sem autenticação',
  bearer: 'Bearer token',
  basic: 'Basic (usuário + senha)',
  api_key_header: 'API key em header',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

export function ConexoesPage() {
  const navigate = useNavigate()
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleting, setDeleting] = useState<Conexao | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setConexoes(await conexoesService.listar())
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao carregar conexões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await conexoesService.remover(deleting.id)
      setSuccess('Conexão removida.')
      setDeleting(null)
      await carregar()
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao remover conexão.')
      setDeleting(null)
    }
  }

  const handleTest = async (c: Conexao) => {
    setTestingId(c.id)
    setError('')
    try {
      await conexoesService.testar(c.id)
      await carregar()
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || 'Erro ao testar conexão.')
    } finally {
      setTestingId(null)
    }
  }

  const temSefaz = conexoes.some((c) => c.nome === 'sefaz-dfe' && c.ativo === 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Conexões</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Credenciais de integração com serviços externos — contabilidade, SEFAZ e APIs
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/configuracoes/conexoes/nova')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conexão
        </Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
        Uma conexão guarda <strong className="text-slate-700 dark:text-slate-300">para onde chamar</strong> (URL
        base) e <strong className="text-slate-700 dark:text-slate-300">como autenticar</strong>. O segredo é
        criptografado. Para emitir NF-e, cadastre a ponte com nome{' '}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">sefaz-dfe</code>
        {!temSefaz && (
          <>
            {' '}
            —{' '}
            <Link to="/configuracoes/conexoes/nova" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
              criar agora
            </Link>
          </>
        )}
        .
      </div>

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando conexões..." />
      ) : conexoes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma conexão configurada</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
            Cadastre a ponte SEFAZ ou credenciais do escritório contábil.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/configuracoes/conexoes/nova')}>
            Criar primeira conexão
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {conexoes.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100 font-mono text-sm">{c.nome}</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                    </span>
                    {c.ativo !== 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Inativa
                      </span>
                    )}
                  </div>
                  {c.descricao && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.descricao}</p>}
                </div>
                <div className="flex gap-1 flex-none">
                  <button
                    type="button"
                    onClick={() => navigate(`/configuracoes/conexoes/${c.id}`)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors"
                    title="Remover"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 min-w-0">
                  <span className="font-medium text-slate-600 dark:text-slate-300 flex-none">URL:</span>
                  <span className="truncate font-mono">{c.base_url}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Auth:</span>
                  {AUTH_LABEL[c.auth_tipo]}
                  {c.auth_tipo !== 'none' && (
                    <span
                      className={`inline-flex items-center gap-1 ${c.tem_segredo ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
                    >
                      {c.tem_segredo ? 'segredo configurado' : 'sem segredo'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-400 dark:text-slate-500 min-w-0">
                  {c.ultimo_teste_status ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full flex-none ${c.ultimo_teste_status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`}
                      />
                      <span className="truncate" title={c.ultimo_teste_detalhe ?? ''}>
                        {fmtDateTime(c.ultimo_teste_em)} — {c.ultimo_teste_detalhe}
                      </span>
                    </span>
                  ) : (
                    'Nunca testada'
                  )}
                </div>
                <Button variant="secondary" size="sm" loading={testingId === c.id} onClick={() => handleTest(c)}>
                  Testar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover conexão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a conexão <strong className="font-mono">{deleting?.nome}</strong>? Integrações que a utilizam
          deixarão de funcionar.
        </p>
      </Modal>
    </div>
  )
}

export default ConexoesPage
