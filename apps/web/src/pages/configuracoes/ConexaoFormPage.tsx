import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/common/Button'
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
  sefaz_dfe: 'Ponte SEFAZ DFe / NF-e (mTLS)',
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
  nome: '',
  descricao: '',
  tipo: 'http',
  baseUrl: '',
  authTipo: 'none',
  username: '',
  headerName: '',
  secret: '',
  ativo: true,
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

/** Prefill útil ao escolher tipo SEFAZ (nome obrigatório do código). */
function applySefazPreset(prev: FormState): FormState {
  return {
    ...prev,
    tipo: 'sefaz_dfe',
    nome: prev.nome.trim() || 'sefaz-dfe',
    descricao: prev.descricao.trim() || 'Ponte HTTPS→mTLS para DFe e autorização NF-e',
    authTipo: prev.authTipo === 'none' ? 'none' : prev.authTipo,
  }
}

export default function ConexaoFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'nova'

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editing, setEditing] = useState<Conexao | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    if (isNew || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFormError('')
    try {
      const list = await conexoesService.listar()
      const c = list.find((x) => x.id === id)
      if (!c) {
        setFormError('Conexão não encontrada.')
        setEditing(null)
        return
      }
      setEditing(c)
      setForm(formFromConexao(c))
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setFormError(ax.response?.data?.error || 'Erro ao carregar conexão.')
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const onTipoChange = (tipo: ConexaoTipo) => {
    setForm((prev) => {
      const next = { ...prev, tipo }
      if (tipo === 'sefaz_dfe') return applySefazPreset(next)
      return next
    })
  }

  const handleSave = async () => {
    setFormError('')
    setSuccess('')

    if (!form.nome.trim() || !form.baseUrl.trim()) {
      setFormError('Preencha o nome e a URL base.')
      return
    }
    if (form.tipo === 'sefaz_dfe' && form.nome.trim() !== 'sefaz-dfe') {
      setFormError('Para a ponte SEFAZ, o nome deve ser exatamente sefaz-dfe (é assim que o sistema a encontra).')
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
      authConfig:
        form.authTipo === 'basic'
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
        await load()
      } else {
        const created = await conexoesService.criar(input)
        navigate(`/configuracoes/conexoes/${created.id}`, { replace: true })
      }
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      setFormError(ax.response?.data?.error || 'Erro ao salvar conexão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando conexão..." />
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to="/configuracoes/conexoes"
          className="text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
        >
          ← Conexões
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display mt-1">
          {editing ? `Editar — ${editing.nome}` : 'Nova conexão'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Credencial usada pelas integrações do tenant (contabilidade, SEFAZ).
        </p>
      </div>

      {form.tipo === 'sefaz_dfe' && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-900 dark:text-sky-200 space-y-2">
          <p className="font-semibold">Ponte SEFAZ (mTLS)</p>
          <ul className="text-xs list-disc pl-4 space-y-1 text-sky-800 dark:text-sky-300">
            <li>
              Nome obrigatório: <code className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 rounded">sefaz-dfe</code>
            </li>
            <li>
              URL base = endpoint da ponte em Cloudflare Containers (ex.:{' '}
              <code className="font-mono">https://siscr-sefaz-bridge.…workers.dev</code>),{' '}
              <strong>não</strong> staging.siscr.com.br nem a SEFAZ.
            </li>
            <li>
              Auth recomendada: Bearer com o mesmo <code className="font-mono">BRIDGE_TOKEN</code> do
              secret da ponte.
            </li>
            <li>
              O SISCR envia o SOAP + A1 (headers); a ponte faz mTLS até a SEFAZ. O botão Testar deve
              responder HTTP 200 em GET /.
            </li>
          </ul>
        </div>
      )}

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nome (identificador)"
            name="conexao-nome"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder="ex: dominio, sefaz-dfe"
            helpText="Minúsculas, números e hífens. É como o sistema referencia a conexão."
            required
            disabled={!!editing}
          />
          <Select
            label="Tipo"
            name="conexao-tipo"
            value={form.tipo}
            onChange={(e) => onTipoChange(e.target.value as ConexaoTipo)}
            options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>

        <Input
          label="Descrição"
          name="conexao-descricao"
          value={form.descricao}
          onChange={(e) => set('descricao', e.target.value)}
          placeholder="ex: Ponte mTLS para homologação SEFAZ"
        />

        <Input
          label="URL base"
          name="conexao-baseurl"
          value={form.baseUrl}
          onChange={(e) => set('baseUrl', e.target.value)}
          placeholder={
            form.tipo === 'sefaz_dfe'
              ? 'https://sua-ponte.exemplo.com'
              : 'https://api.exemplo.com.br'
          }
          helpText={
            form.tipo === 'sefaz_dfe'
              ? 'URL da ponte mTLS (serviço externo), não o webservice da SEFAZ.'
              : undefined
          }
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Autenticação"
            name="conexao-auth"
            value={form.authTipo}
            onChange={(e) => set('authTipo', e.target.value as ConexaoAuthTipo)}
            options={Object.entries(AUTH_LABEL).map(([value, label]) => ({ value, label }))}
          />

          {form.authTipo === 'basic' && (
            <Input
              label="Usuário"
              name="conexao-username"
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              required
            />
          )}
          {form.authTipo === 'api_key_header' && (
            <Input
              label="Nome do header"
              name="conexao-header"
              value={form.headerName}
              onChange={(e) => set('headerName', e.target.value)}
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
            onChange={(e) => set('secret', e.target.value)}
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
            onChange={(e) => set('ativo', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Conexão ativa</span>
        </label>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/configuracoes/conexoes')} disabled={saving}>
            Voltar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editing ? 'Salvar alterações' : 'Criar conexão'}
          </Button>
        </div>
      </div>
    </div>
  )
}
