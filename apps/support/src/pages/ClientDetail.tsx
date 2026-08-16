import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type DeskClient, type DeskEmpresa, type DeskFilial } from '../api'
import { crtLabel, formatCnpj } from './Clients'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  cancelled: 'Cancelado',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  user: 'Usuário',
  readonly: 'Somente leitura',
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
}

function isOn(value: number | boolean | undefined) {
  return value !== 0 && value !== false
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<DeskClient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const { data } = await api.get<{ client: DeskClient }>(`/clients/${id}`)
    setClient(data.client)
  }, [id])

  useEffect(() => {
    let cancelled = false
    load()
      .catch(() => {
        if (!cancelled) setError('Cliente não encontrado.')
      })
    return () => {
      cancelled = true
    }
  }, [load])

  async function runAction(key: string, confirmMsg: string, request: () => Promise<{ data: { client: DeskClient } }>) {
    if (!window.confirm(confirmMsg)) return
    setBusy(key)
    setActionError(null)
    try {
      const { data } = await request()
      setClient(data.client)
    } catch (err) {
      setActionError(apiError(err, 'Não foi possível aplicar a ação.'))
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!client) return <p className="text-sm text-slate-500">Carregando…</p>

  const tenantActive = client.status === 'active'

  return (
    <div>
      <Link to="/clientes" className="text-sm text-brand-600 hover:underline">
        ← Clientes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{client.nome}</h1>
          <p className="text-sm text-slate-500">
            @{client.slug} · {STATUS_LABEL[client.status] ?? client.status} · desde {fmtDate(client.created_at)}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() =>
            void runAction(
              'tenant',
              tenantActive
                ? 'Suspender a conta bloqueia o login no ERP até reativar. Confirma?'
                : 'Reativar a conta libera o ERP para este cliente. Confirma?',
              () =>
                api.patch(`/clients/${client.id}`, {
                  status: tenantActive ? 'suspended' : 'active',
                }),
            )
          }
        >
          {tenantActive ? 'Suspender conta' : 'Reativar conta'}
        </button>
      </div>

      {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Plano" value={client.plan_nome} hint={client.has_stripe ? 'Assinatura Stripe' : 'Sem Stripe'} />
        <InfoCard
          label="Usuários"
          value={`${client.uso.usuarios} / ${client.limites.max_usuarios || '—'}`}
        />
        <InfoCard label="Empresas / filiais" value={`${client.uso.empresas} / ${client.uso.filiais}`} />
        <InfoCard
          label="Tickets abertos"
          value={String(client.uso.tickets_abertos)}
          hint={client.subscription_expires_at ? `Expira ${fmtDate(client.subscription_expires_at)}` : undefined}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Empresas e filiais</h2>
      <p className="mt-1 text-sm text-slate-500">
        Desativar esconde a empresa/filial nas operações do ERP. O cadastro continua na conta e não libera vaga do plano.
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {client.empresas.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma empresa cadastrada.</p>}
        {client.empresas.map((e) => (
          <EmpresaBlock
            key={e.id}
            empresa={e}
            busy={busy}
            onToggleEmpresa={() =>
              void runAction(
                `empresa:${e.id}`,
                isOn(e.ativo)
                  ? `Desativar ${e.razao_social}? Ela deixa de aparecer em NFe, pedidos e demais telas operacionais.`
                  : `Reativar ${e.razao_social}?`,
                () => api.patch(`/clients/${client.id}/empresas/${e.id}`, { ativo: !isOn(e.ativo) }),
              )
            }
            onToggleFilial={(f) =>
              void runAction(
                `filial:${f.id}`,
                isOn(f.ativa)
                  ? `Desativar a filial ${f.nome}?`
                  : `Reativar a filial ${f.nome}?`,
                () => api.patch(`/clients/${client.id}/filiais/${f.id}`, { ativa: !isOn(f.ativa) }),
              )
            }
          />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Usuários do cliente</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {(client.usuarios ?? []).length === 0 && (
          <p className="p-4 text-sm text-slate-500">Nenhum usuário.</p>
        )}
        {(client.usuarios ?? []).map((u) => (
          <div key={u.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
            <div>
              <div className="font-medium">{u.nome}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <div className="text-xs text-slate-500">
              {ROLE_LABEL[u.role] ?? u.role}
              {u.ativo ? '' : ' · inativo'}
            </div>
          </div>
        ))}
      </div>

      <Link to={`/?q=${encodeURIComponent(client.nome)}`} className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        Ver tickets deste cliente
      </Link>
    </div>
  )
}

function EmpresaBlock({
  empresa,
  busy,
  onToggleEmpresa,
  onToggleFilial,
}: {
  empresa: DeskEmpresa
  busy: string | null
  onToggleEmpresa: () => void
  onToggleFilial: (filial: DeskFilial) => void
}) {
  const empresaAtiva = isOn(empresa.ativo)
  const filiais = empresa.filiais ?? []

  return (
    <div className={`border-b border-slate-100 px-4 py-3 last:border-0 ${empresaAtiva ? '' : 'bg-slate-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{empresa.razao_social}</span>
            <StatusPill on={empresaAtiva} />
          </div>
          <div className="text-xs text-slate-500">
            {empresa.nome_fantasia ? `${empresa.nome_fantasia} · ` : ''}
            {formatCnpj(empresa.cnpj)}
            {empresa.inscricao_estadual ? ` · IE ${empresa.inscricao_estadual}` : ''}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {crtLabel(empresa.crt, empresa.regime_tributario)}
            {empresa.cnae ? ` · CNAE ${empresa.cnae}` : ''}
            {empresa.cidade ? ` · ${empresa.cidade}/${empresa.uf ?? ''}` : ''}
          </div>
          {(empresa.email || empresa.telefone) && (
            <div className="mt-1 text-xs text-slate-500">
              {[empresa.email, empresa.telefone].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={onToggleEmpresa}
        >
          {empresaAtiva ? 'Desativar empresa' : 'Ativar empresa'}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-white">
        {filiais.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500">Nenhuma filial cadastrada.</p>
        )}
        {filiais.map((f) => {
          const filialAtiva = isOn(f.ativa)
          return (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{f.nome}</span>
                  <StatusPill on={filialAtiva} />
                </div>
                <div className="text-xs text-slate-500">
                  {f.cnpj ? formatCnpj(f.cnpj) : 'Sem CNPJ próprio'}
                  {f.cidade ? ` · ${f.cidade}/${f.uf ?? ''}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary h-8 px-3 text-xs"
                disabled={busy !== null || (!filialAtiva && !empresaAtiva)}
                title={!filialAtiva && !empresaAtiva ? 'Reative a empresa antes de ativar a filial.' : undefined}
                onClick={() => onToggleFilial(f)}
              >
                {filialAtiva ? 'Desativar filial' : 'Ativar filial'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusPill({ on }: { on: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {on ? 'Ativa' : 'Inativa'}
    </span>
  )
}

function InfoCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
