import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import Layout from '../components/Layout';
import api from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s?: string) => {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function todayFormatted() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Tipos ────────────────────────────────────────────────────────
interface FinDash {
  receber: { pendente: number; vencido: number; qtd_vencido: number } | null;
  pagar: { pendente: number; vencido: number; qtd_vencido: number } | null;
  proximosVencimentosCR: { id: string; descricao: string; valor: number; vencimento: string; cliente: string }[];
  proximosVencimentosCP: { id: string; descricao: string; valor: number; vencimento: string; fornecedor: string }[];
}

// ─── Componentes auxiliares ───────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 flex gap-4 items-start ${color}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs mt-1.5 opacity-60">{sub}</p>}
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label, desc }: { to: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link to={to} className="group flex gap-3 items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm rounded-xl px-4 py-3.5 transition-all duration-150">
      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-none group-hover:bg-brand-100 dark:group-hover:bg-brand-900 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand-400 ml-auto flex-none transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </Link>
  );
}

// ─── Página ───────────────────────────────────────────────────────
function AppHome() {
  const [userName, setUserName] = useState('');
  const [dash, setDash] = useState<FinDash | null>(null);
  const [cotacoesAbertas, setCotacoesAbertas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nome = localStorage.getItem('user_nome');
    if (nome) setUserName(nome);
    else {
      const u = authService.getLocalUser();
      setUserName(u?.nome || u?.email || '');
    }

    Promise.all([
      api.get('/tenant/financeiro/dashboard').catch(() => null),
      api.get('/tenant/faturamento/cotacoes', { params: { status: 'enviada' } }).catch(() => null),
    ]).then(([finRes, cotRes]) => {
      if (finRes?.data) setDash(finRes.data);
      if (cotRes?.data?.cotacoes) setCotacoesAbertas(cotRes.data.cotacoes.length);
    }).finally(() => setLoading(false));
  }, []);

  const receber = dash?.receber;
  const pagar = dash?.pagar;
  const totalVencido = (receber?.vencido ?? 0) + (pagar?.vencido ?? 0);
  const qtdVencido = (receber?.qtd_vencido ?? 0) + (pagar?.qtd_vencido ?? 0);
  const saldo = (receber?.pendente ?? 0) - (pagar?.pendente ?? 0);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm text-slate-400 dark:text-slate-500 capitalize">{todayFormatted()}</p>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display mt-0.5">
              {greeting()}, {userName ? userName.split(' ')[0] : 'Usuário'} 👋
            </h1>
          </div>
          <Link to="/faturamento/cotacoes" className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nova Cotação
          </Link>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="A Receber"
              value={fmtBRL(receber?.pendente)}
              sub={receber?.qtd_vencido ? `${receber.qtd_vencido} vencido(s)` : 'Tudo em dia'}
              color="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              icon={<svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
            />
            <KpiCard
              label="A Pagar"
              value={fmtBRL(pagar?.pendente)}
              sub={pagar?.qtd_vencido ? `${pagar.qtd_vencido} vencido(s)` : 'Tudo em dia'}
              color="bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              icon={<svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" /></svg>}
            />
            <KpiCard
              label="Saldo Previsto"
              value={fmtBRL(saldo)}
              sub="Receber − Pagar"
              color={saldo >= 0
                ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                : 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200'}
              icon={<svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <KpiCard
              label="Cotações Abertas"
              value={String(cotacoesAbertas)}
              sub="Aguardando aprovação"
              color="bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200"
              icon={<svg className="w-6 h-6 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
            />
          </div>
        )}

        {/* Alerta de vencidos */}
        {!loading && qtdVencido > 0 && (
          <div className="flex gap-3 items-start bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3.5">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Atenção: {qtdVencido} título(s) vencido(s) — {fmtBRL(totalVencido)} em aberto
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Verifique suas contas a receber e a pagar para regularizar a situação.
              </p>
              <div className="flex gap-3 mt-2">
                <Link to="/financeiro/contas-receber" className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline">Contas a Receber →</Link>
                <Link to="/financeiro/contas-pagar" className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline">Contas a Pagar →</Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Ações rápidas */}
          <div className="lg:col-span-1 space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ações Rápidas</p>
            <div className="space-y-2">
              <QuickAction
                to="/faturamento/cotacoes"
                label="Nova Cotação"
                desc="Criar proposta para cliente"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              />
              <QuickAction
                to="/faturamento/nf-venda"
                label="Nova NF-e"
                desc="Nota fiscal de venda"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
              />
              <QuickAction
                to="/financeiro/contas-receber"
                label="Lançar Recebimento"
                desc="Registrar conta a receber"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <QuickAction
                to="/financeiro/contas-pagar"
                label="Lançar Pagamento"
                desc="Registrar conta a pagar"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
              />
              <QuickAction
                to="/estoque/movimentacoes"
                label="Movimentar Estoque"
                desc="Entrada, saída ou ajuste"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
              />
              <QuickAction
                to="/cadastros/pessoas"
                label="Cadastrar Pessoa"
                desc="Cliente, fornecedor ou parceiro"
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>}
              />
            </div>
          </div>

          {/* Próximos vencimentos */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Próximos Vencimentos (7 dias)</p>

            {loading ? (
              <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">

                {/* A Receber */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      A Receber
                    </span>
                    <Link to="/financeiro/contas-receber" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">Ver todos</Link>
                  </div>
                  {(dash?.proximosVencimentosCR ?? []).length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">Nenhum vencimento nos próximos 7 dias</div>
                  ) : (
                    <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                      {dash!.proximosVencimentosCR.map(item => (
                        <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.descricao}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{item.cliente || '—'} · {fmtDate(item.vencimento)}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">{fmtBRL(item.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* A Pagar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      A Pagar
                    </span>
                    <Link to="/financeiro/contas-pagar" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">Ver todos</Link>
                  </div>
                  {(dash?.proximosVencimentosCP ?? []).length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">Nenhum vencimento nos próximos 7 dias</div>
                  ) : (
                    <ul className="divide-y divide-slate-50 dark:divide-slate-800">
                      {dash!.proximosVencimentosCP.map(item => (
                        <li key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.descricao}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{item.fornecedor || '—'} · {fmtDate(item.vencimento)}</p>
                          </div>
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 tabular-nums whitespace-nowrap">{fmtBRL(item.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Módulos — navegação secundária discreta */}
        <div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Módulos</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Cadastros', to: '/cadastros/pessoas' },
              { label: 'Financeiro', to: '/financeiro/dashboard' },
              { label: 'Faturamento', to: '/faturamento/cotacoes' },
              { label: 'Estoque', to: '/estoque/estoque-atual' },
              { label: 'Configurações', to: '/configuracoes' },
              { label: 'Perfil', to: '/perfil' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 font-medium hover:border-brand-200 dark:hover:border-brand-800 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950 transition-all duration-150"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}

export default AppHome;
