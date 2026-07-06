import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Alert from '../../components/common/Alert'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  conexoesService,
  type Conexao,
  type ConexaoAuthTipo,
  type ConexaoInput,
  type ConexaoTipo,
} from '../../services/conexoes'

const TIPO_LABEL: Record<ConexaoTipo, string> = {
  http: 'HTTP genérico',
  dominio: 'Domínio (Thomson Reuters)',
  onvio: 'Onvio (Thomson Reuters)',
  alterdata: 'Alterdata',
  sefaz_dfe: 'Ponte SEFAZ DFe (mTLS)',
}

const AUTH_LABEL: Record<ConexaoAuthTipo, string> = {
  none: 'Sem autenticação',
  bearer: 'Bearer token',
  basic: 'Basic (usuário + senha)',
  api_key_header: 'API key em header',
}

const SECRET_LABEL: Record<ConexaoAuthTipo, string> = {
  none: '',
  bearer: 'Token',
  basic: 'Senha',
  api_key_header: 'API key',
}

interface FormState {
  nome: string
  descricao: string
  tipo: ConexaoTipo
  baseUrl: string
  authTipo: ConexaoAuthTipo
  username: string
  headerName: string
  secret: string
  ativo: boolean
}

const EMPTY_FORM: FormState = {
  nome: '', descricao: '', tipo: 'http', baseUrl: '',
  authTipo: 'none', username: '', headerName: '', secret: '', ativo: true,
}

function formFromConexao(c: Conexao): FormState {
  return {
    nome: c.nome,
    descricao: c.descricao ?? '',
    tipo: c.tipo,
    baseUrl: c.base_url,
    authTipo: c.auth_tipo,
    username: c.auth_config?.username ?? '',
    headerName: c.auth_config?.headerName ?? '',
    secret: '',
    ativo: c.ativo === 1,
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function ConexoesPage() {
  const [conexoes, setConexoes] = useState<Conexao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Conexao | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

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

  useEffect(() => { void carregar() }, [carregar])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (c: Conexao) => {
    setEditing(c)
    setForm(formFromConexao(c))
    setFormError('')
    setModalOpen(true)
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setFormError('')

    if (!form.nome.trim() || !form.baseUrl.trim()) {
      setFormError('Preencha o nome e a URL base.')
      return
    }
    if (form.authTipo !== 'none' && !editing && !form.secret) {
      setFormError(`Informe o campo "${SECRET_LABEL[form.authTipo]}".`)
      return
    }

    const input: ConexaoInput = {
      nome: form.nome.trim().toLowerCase(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      baseUrl: form.baseUrl.trim(),
      authTipo: form.authTipo,
      authConfig: form.authTipo === 'basic'
        ? { username: form.username }
        : form.authTipo === 'api_key_header'
          ? { headerName: form.headerName || 'X-Api-Key' }
          : null,
      ativo: form.ativo,
      ...(form.secret ? { secret: form.secret } : {}),
    }

    setSaving(true)
    try {
      if (editing) {
        await conexoesService.atualizar(editing.id, input)
        setSuccess('Conexão atualizada.')
      } else {
        await conexoesService.criar(input)
        setSuccess('Conexão criada.')
      }
      setModalOpen(false)
      await carregar()
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setFormError(ax.response?.data?.error || 'Erro ao salvar conexão.')
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Conexões</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Credenciais de integração com serviços externos — contabilidade, SEFAZ e APIs
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conexão
        </Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Explicação */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
        Uma conexão guarda <strong className="text-slate-700 dark:text-slate-300">para onde chamar</strong> (URL base)
        e <strong className="text-slate-700 dark:text-slate-300">como autenticar</strong> (token, senha ou API key).
        O segredo é criptografado e nunca é exibido novamente — as integrações do sistema o utilizam automaticamente
        pelo <em>nome</em> da conexão (ex.: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">dominio</code>,{' '}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">sefaz-dfe</code>).
      </div>

      {/* Lista */}
      {loading ? (
        <LoadingSpinner fullScreen text="Carregando conexões..." />
      ) : conexoes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma conexão configurada</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
            Cadastre credenciais de integração para contabilidade e outros serviços.
          </p>
          <Button variant="primary" size="sm" onClick={openCreate}>Criar primeira conexão</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {conexoes.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card p-5 space-y-3">
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
                    onClick={() => openEdit(c)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors"
                    title="Remover"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                    <span className={`inline-flex items-center gap-1 ${c.tem_segredo ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      {c.tem_segredo ? 'segredo configurado' : 'sem segredo'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-400 dark:text-slate-500 min-w-0">
                  {c.ultimo_teste_status ? (
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-none ${c.ultimo_teste_status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="truncate" title={c.ultimo_teste_detalhe ?? ''}>
                        {fmtDateTime(c.ultimo_teste_em)} — {c.ultimo_teste_detalhe}
                      </span>
                    </span>
                  ) : 'Nunca testada'}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={testingId === c.id}
                  onClick={() => handleTest(c)}
                >
                  Testar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar conexão — ${editing.nome}` : 'Nova conexão'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar conexão'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome (identificador)"
              name="conexao-nome"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="ex: dominio, sefaz-dfe"
              helpText="Minúsculas, números e hífens. É como o sistema referencia a conexão."
              required
            />
            <Select
              label="Tipo"
              name="conexao-tipo"
              value={form.tipo}
              onChange={e => set('tipo', e.target.value as ConexaoTipo)}
              options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>

          <Input
            label="Descrição"
            name="conexao-descricao"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="ex: Envio de XMLs para o escritório contábil"
          />

          <Input
            label="URL base"
            name="conexao-baseurl"
            value={form.baseUrl}
            onChange={e => set('baseUrl', e.target.value)}
            placeholder="https://api.exemplo.com.br"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Autenticação"
              name="conexao-auth"
              value={form.authTipo}
              onChange={e => set('authTipo', e.target.value as ConexaoAuthTipo)}
              options={Object.entries(AUTH_LABEL).map(([value, label]) => ({ value, label }))}
            />

            {form.authTipo === 'basic' && (
              <Input
                label="Usuário"
                name="conexao-username"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                required
              />
            )}
            {form.authTipo === 'api_key_header' && (
              <Input
                label="Nome do header"
                name="conexao-header"
                value={form.headerName}
                onChange={e => set('headerName', e.target.value)}
                placeholder="X-Api-Key"
              />
            )}
          </div>

          {form.authTipo !== 'none' && (
            <Input
              label={SECRET_LABEL[form.authTipo]}
              name="conexao-secret"
              type="password"
              value={form.secret}
              onChange={e => set('secret', e.target.value)}
              placeholder={editing?.tem_segredo ? '••••••••  (deixe em branco para manter o atual)' : ''}
              helpText="Criptografado no servidor. Não é possível visualizá-lo depois — apenas substituir."
              autoComplete="new-password"
              required={!editing}
            />
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Conexão ativa</span>
          </label>
        </div>
      </Modal>

      {/* Confirmação de remoção */}
      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover conexão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a conexão <strong className="font-mono">{deleting?.nome}</strong>?
          Integrações que a utilizam deixarão de funcionar. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  )
}

export default ConexoesPage
