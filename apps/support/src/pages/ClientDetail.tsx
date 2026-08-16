import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type DeskClient } from '../api'
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<DeskClient | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .get<{ client: DeskClient }>(`/clients/${id}`)
      .then(({ data }) => {
        if (!cancelled) setClient(data.client)
      })
      .catch(() => {
        if (!cancelled) setError('Cliente não encontrado.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!client) return <p className="text-sm text-slate-500">Carregando…</p>

  return (
    <div>
      <Link to="/clientes" className="text-sm text-brand-600 hover:underline">
        ← Clientes
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{client.nome}</h1>
      <p className="text-sm text-slate-500">
        @{client.slug} · {STATUS_LABEL[client.status] ?? client.status} · desde {fmtDate(client.created_at)}
      </p>

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

      <h2 className="mt-8 text-lg font-semibold">Empresas (CNPJ)</h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {client.empresas.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma empresa cadastrada.</p>}
        {client.empresas.map((e) => (
          <div key={e.id} className="border-b border-slate-100 px-4 py-3 last:border-0">
            <div className="font-medium">{e.razao_social}</div>
            <div className="text-xs text-slate-500">
              {e.nome_fantasia ? `${e.nome_fantasia} · ` : ''}
              {formatCnpj(e.cnpj)}
              {e.inscricao_estadual ? ` · IE ${e.inscricao_estadual}` : ''}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {crtLabel(e.crt, e.regime_tributario)}
              {e.cnae ? ` · CNAE ${e.cnae}` : ''}
              {e.cidade ? ` · ${e.cidade}/${e.uf ?? ''}` : ''}
            </div>
            {(e.email || e.telefone) && (
              <div className="mt-1 text-xs text-slate-500">
                {[e.email, e.telefone].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
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

function InfoCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
