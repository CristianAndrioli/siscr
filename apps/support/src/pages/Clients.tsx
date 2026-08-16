import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type DeskClient } from '../api'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  cancelled: 'Cancelado',
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function crtLabel(crt: string | null, regime: string | null) {
  if (crt === '1' || regime === 'simples_nacional') return 'Simples Nacional'
  if (crt === '2') return 'Simples (excesso sublimite)'
  if (crt === '3' || regime === 'lucro_presumido') return 'Lucro presumido / normal'
  if (regime === 'lucro_real') return 'Lucro real'
  return regime || crt || '—'
}

export default function ClientsPage() {
  const [clients, setClients] = useState<DeskClient[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ clients: DeskClient[] }>('/clients')
      .then(({ data }) => {
        if (!cancelled) setClients(data.clients)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar os clientes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return clients.filter((c) => {
      if (status && c.status !== status) return false
      if (!term) return true
      const hay = [
        c.nome,
        c.slug,
        c.plan_nome,
        ...c.empresas.flatMap((e) => [
          e.razao_social,
          e.nome_fantasia,
          e.cnpj,
          e.cidade,
          e.cnae,
          ...(e.filiais ?? []).flatMap((f) => [f.nome, f.cnpj, f.cidade]),
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(term)
    })
  }, [clients, q, status])

  return (
    <div>
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="mt-1 text-sm text-slate-500">Contas que usam o SISCR — tenant, plano e empresas (CNPJ).</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Buscar nome, slug, CNPJ, cidade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 text-xs text-slate-500">
        {filtered.length} cliente(s){status || q ? ` filtrado(s) de ${clients.length}` : ''}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && <p className="p-4 text-sm text-slate-500">Carregando…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="p-4 text-sm text-slate-500">Nenhum cliente encontrado.</p>
        )}
        {filtered.map((c) => {
          const principal = c.empresas.find((e) => e.ativo !== 0) ?? c.empresas[0]
          return (
            <Link
              key={c.id}
              to={`/clientes/${c.id}`}
              className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium text-slate-900">{c.nome}</div>
                <div className="text-xs text-slate-500">
                  @{c.slug} · {STATUS_LABEL[c.status] ?? c.status} · {c.plan_nome}
                  {c.has_stripe ? ' · Stripe' : ''}
                </div>
                {principal && (
                  <div className="mt-1 text-xs text-slate-600">
                    {principal.razao_social}
                    {principal.nome_fantasia ? ` (${principal.nome_fantasia})` : ''} · {formatCnpj(principal.cnpj)}
                    {principal.cnae ? ` · CNAE ${principal.cnae}` : ''}
                    {principal.cidade ? ` · ${principal.cidade}/${principal.uf ?? ''}` : ''}
                  </div>
                )}
              </div>
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>
                  {c.uso.usuarios}/{c.limites.max_usuarios || '—'} usuários
                </div>
                <div>
                  {c.uso.empresas} empresa(s) · {c.uso.filiais} filial(is)
                </div>
                <div>{c.uso.tickets_abertos} ticket(s) aberto(s)</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
