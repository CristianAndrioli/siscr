import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { authService } from '../services/auth'
import Layout from '../components/Layout'
import api from '../services/api'
import { fmtBRL } from '../utils/format'
import { useUserPreferences } from '../hooks/useUserPreferences'
import type { RecentItem } from '../hooks/useUserPreferences'

// ─── Helpers ──────────────────────────────────────────────────────
const fmtDate = (s?: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayFormatted() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Tipos ────────────────────────────────────────────────────────
interface FinDash {
  receber: { pendente: number; vencido: number; qtd_vencido: number } | null
  pagar: { pendente: number; vencido: number; qtd_vencido: number } | null
  proximosVencimentosCR: { id: string; descricao: string; valor: number; vencimento: string; cliente: string }[]
  proximosVencimentosCP: { id: string; descricao: string; valor: number; vencimento: string; fornecedor: string }[]
  contas_bancarias: { id: string; nome: string; tipo: string; banco_nome?: string; saldo_atual: number }[]
  total_disponivel: number
}

interface SubItem { label: string; to: string }
interface ModuleDef {
  key: string; label: string; sub: string; to: string
  items?: SubItem[]
  icon: React.ReactNode
}

// ─── Módulos do sistema ───────────────────────────────────────────
const ALL_MODULES: ModuleDef[] = [
  {
    key: 'financeiro',
    label: 'Financeiro',
    sub: 'CR, CP, Bancos, Régua',
    to: '/financeiro/contas-receber',
    items: [
      { label: 'Dashboard', to: '/financeiro/dashboard' },
      { label: 'Contas a Receber', to: '/financeiro/contas-receber' },
      { label: 'Contas a Pagar', to: '/financeiro/contas-pagar' },
      { label: 'Contas Bancárias', to: '/financeiro/contas-bancarias' },
      { label: 'Conciliação Bancária', to: '/financeiro/conciliacao/nova' },
      { label: 'Régua de Cobrança', to: '/financeiro/regua-cobranca' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    key: 'faturamento',
    label: 'Faturamento',
    sub: 'NF-e, NFSe, Cotações',
    to: '/faturamento/cotacoes',
    items: [
      { label: 'Cotações', to: '/faturamento/cotacoes' },
      { label: 'NF-e Venda', to: '/faturamento/nf-venda' },
      { label: 'NFSe', to: '/faturamento/nfse' },
      { label: 'NF-e Entrada', to: '/entrada/notas' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    key: 'cadastros',
    label: 'Cadastros',
    sub: 'Pessoas, Produtos, Serviços',
    to: '/cadastros/pessoas',
    items: [
      { label: 'Pessoas', to: '/cadastros/pessoas' },
      { label: 'Produtos', to: '/cadastros/produtos' },
      { label: 'Serviços', to: '/cadastros/servicos' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    key: 'estoque',
    label: 'Estoque',
    sub: 'Posição, Movimentações',
    to: '/estoque/posicao',
    items: [
      { label: 'Posição Atual', to: '/estoque/posicao' },
      { label: 'Movimentações', to: '/estoque/movimentacoes' },
      { label: 'Transferências', to: '/estoque/transferencias' },
      { label: 'Locais', to: '/estoque/locais' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
  {
    key: 'frota',
    label: 'Frota',
    sub: 'OS, Máquinas, Obras',
    to: '/frota/ordens-servico',
    items: [
      { label: 'Ordens de Serviço', to: '/frota/ordens-servico' },
      { label: 'Máquinas', to: '/frota/maquinas' },
      { label: 'Obras', to: '/frota/obras' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    key: 'configuracoes',
    label: 'Configurações',
    sub: 'Usuários, Empresa, Logs',
    to: '/configuracoes',
    items: [
      { label: 'Usuários', to: '/configuracoes/usuarios' },
      { label: 'Filiais', to: '/configuracoes/filiais' },
      { label: 'Faturamento', to: '/configuracoes/faturamento' },
      { label: 'Permissões', to: '/configuracoes/permissoes' },
      { label: 'Personalização', to: '/configuracoes/personalizacao' },
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

// ─── Componentes ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, colorClass }: {
  label: string; value: string; sub?: string; colorClass: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1.5">{label}</p>
      <p className="text-xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs mt-1.5 opacity-60">{sub}</p>}
    </div>
  )
}

function ModuleCard({ label, sub, to, icon, items, layout, expanded, onToggle, onItemClick }: {
  label: string; sub: string; to: string; icon: React.ReactNode
  items?: SubItem[]
  layout: 'grid' | 'list'
  expanded: boolean
  onToggle: () => void
  onItemClick: (item: SubItem) => void
}) {
  const navigate = useNavigate()
  const hasItems = items && items.length > 0

  const handleCardClick = () => {
    if (hasItems) {
      onToggle()
    } else {
      navigate(to)
    }
  }

  if (layout === 'list') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all">
        <button
          onClick={handleCardClick}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-none group-hover:bg-brand-100 dark:group-hover:bg-brand-900 transition-colors">
            {icon}
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors flex-1">
            {label}
          </span>
          {hasItems ? (
            <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform flex-none ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </button>
        {expanded && hasItems && (
          <div className="border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5 px-4 py-3">
            {items.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onItemClick(item)}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900 font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // grid layout
  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all ${
      expanded
        ? 'border-brand-300 dark:border-brand-700 shadow-sm'
        : 'border-slate-200 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-800 hover:shadow-sm'
    }`}>
      <button
        onClick={handleCardClick}
        className="flex flex-col gap-3 p-4 text-left group w-full"
      >
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none transition-colors ${
            expanded
              ? 'bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400'
              : 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900'
          }`}>
            {icon}
          </div>
          {hasItems && (
            <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 mt-1 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-sm font-semibold transition-colors ${
            expanded ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300'
          }`}>
            {label}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
        </div>
      </button>
      {expanded && hasItems && (
        <div className="border-t border-brand-100 dark:border-brand-900 flex flex-wrap gap-1.5 px-4 py-3 bg-brand-50/40 dark:bg-brand-950/40">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => onItemClick(item)}
              className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950 font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────
function AppHome() {
  const [userName, setUserName] = useState('')
  const [dash, setDash] = useState<FinDash | null>(null)
  const [cotacoesAbertas, setCotacoesAbertas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const { prefs, trackRecentItem } = useUserPreferences()

  useEffect(() => {
    const nome = localStorage.getItem('user_nome')
    if (nome) setUserName(nome)
    else {
      const u = authService.getLocalUser()
      setUserName(u?.nome || u?.email || '')
    }

    Promise.all([
      api.get('/tenant/financeiro/dashboard').catch(() => null),
      api.get('/tenant/faturamento/cotacoes', { params: { status: 'enviada' } }).catch(() => null),
    ]).then(([finRes, cotRes]) => {
      if (finRes?.data) setDash(finRes.data)
      if (cotRes?.data?.cotacoes) setCotacoesAbertas(cotRes.data.cotacoes.length)
    }).finally(() => setLoading(false))
  }, [])

  const receber = dash?.receber
  const pagar = dash?.pagar
  const totalVencido = (receber?.vencido ?? 0) + (pagar?.vencido ?? 0)
  const qtdVencido = (receber?.qtd_vencido ?? 0) + (pagar?.qtd_vencido ?? 0)
  const saldo = (receber?.pendente ?? 0) - (pagar?.pendente ?? 0)

  const visibleMods = prefs.visibleModules.length > 0
    ? ALL_MODULES.filter(m => prefs.visibleModules.includes(m.key))
    : ALL_MODULES

  const handleToggle = (key: string) => {
    setExpandedModule(prev => prev === key ? null : key)
  }

  const handleItemClick = (mod: ModuleDef, item: SubItem) => {
    trackRecentItem({ label: `${mod.label} — ${item.label}`, to: item.to, icon: mod.key })
    setExpandedModule(null)
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-7">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm text-slate-400 dark:text-slate-500 capitalize">{todayFormatted()}</p>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display mt-0.5">
              {greeting()}, {userName ? userName.split(' ')[0] : 'Usuário'} 👋
            </h1>
          </div>
          <Link
            to="/faturamento/cotacoes"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nova Cotação
          </Link>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="A Receber"
              value={fmtBRL(receber?.pendente)}
              sub={receber?.qtd_vencido ? `${receber.qtd_vencido} vencido(s)` : 'Tudo em dia'}
              colorClass="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            />
            <KpiCard
              label="A Pagar"
              value={fmtBRL(pagar?.pendente)}
              sub={pagar?.qtd_vencido ? `${pagar.qtd_vencido} vencido(s)` : 'Tudo em dia'}
              colorClass="bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            />
            <KpiCard
              label={dash?.contas_bancarias?.length ? 'Saldo em Caixa' : 'Saldo Previsto'}
              value={fmtBRL(dash?.contas_bancarias?.length ? (dash.total_disponivel ?? 0) : saldo)}
              sub={dash?.contas_bancarias?.length
                ? `${dash.contas_bancarias.length} conta(s)`
                : 'Receber − Pagar'}
              colorClass={saldo >= 0
                ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200'}
            />
            <KpiCard
              label="Cotações Abertas"
              value={String(cotacoesAbertas)}
              sub="Aguardando aprovação"
              colorClass="bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200"
            />
          </div>
        )}

        {/* Alerta de vencidos */}
        {!loading && qtdVencido > 0 && (
          <div className="flex gap-3 items-start bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3.5">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {qtdVencido} título(s) vencido(s) — {fmtBRL(totalVencido)} em aberto
              </p>
              <div className="flex gap-3 mt-1.5">
                <Link to="/financeiro/contas-receber" className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline">
                  Contas a Receber →
                </Link>
                <Link to="/financeiro/contas-pagar" className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline">
                  Contas a Pagar →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recentemente acessados */}
        {prefs.recentItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Acessados recentemente
            </p>
            <div className="flex flex-wrap gap-2">
              {prefs.recentItems.map((item: RecentItem) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 font-medium hover:border-brand-200 dark:hover:border-brand-800 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950 transition-all"
                >
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grade de módulos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Módulos
            </p>
            <Link
              to="/configuracoes/personalizacao"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Personalizar
            </Link>
          </div>

          <div className={prefs.homeLayout === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
            : 'flex flex-col gap-2'
          }>
            {visibleMods.map(mod => (
              <ModuleCard
                key={mod.key}
                label={mod.label}
                sub={mod.sub}
                to={mod.to}
                icon={mod.icon}
                items={mod.items}
                layout={prefs.homeLayout}
                expanded={expandedModule === mod.key}
                onToggle={() => handleToggle(mod.key)}
                onItemClick={(item) => handleItemClick(mod, item)}
              />
            ))}
          </div>
        </div>

        {/* Próximos vencimentos */}
        {!loading && (
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Próximos vencimentos (7 dias)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    A Receber
                  </span>
                  <Link to="/financeiro/contas-receber" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                    Ver todos
                  </Link>
                </div>
                {(dash?.proximosVencimentosCR ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    Nenhum vencimento nos próximos 7 dias
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                    {dash!.proximosVencimentosCR.map(item => (
                      <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.descricao}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {item.cliente || '—'} · {fmtDate(item.vencimento)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                          {fmtBRL(item.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    A Pagar
                  </span>
                  <Link to="/financeiro/contas-pagar" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                    Ver todos
                  </Link>
                </div>
                {(dash?.proximosVencimentosCP ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    Nenhum vencimento nos próximos 7 dias
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                    {dash!.proximosVencimentosCP.map(item => (
                      <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.descricao}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {item.fornecedor || '—'} · {fmtDate(item.vencimento)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 tabular-nums whitespace-nowrap">
                          {fmtBRL(item.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}

export default AppHome
