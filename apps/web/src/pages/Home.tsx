import { Link } from 'react-router-dom';

/* ─── dados ─────────────────────────────────────── */

const segments = [
  { icon: '🏭', title: 'Indústria',           desc: 'Do pedido à produção — controle total do chão de fábrica ao faturamento.' },
  { icon: '🚚', title: 'Distribuidora',       desc: 'Compra, venda, estoque e logística integrados em tempo real.' },
  { icon: '🏪', title: 'Comércio',            desc: 'Mais inteligência comercial e agilidade nas operações do dia a dia.' },
  { icon: '🔧', title: 'Serviços',            desc: 'Tarefas, contratos e faturamento de serviços sob controle.' },
  { icon: '📋', title: 'Escritório Contábil', desc: 'Contabilidade, fiscal e obrigações acessórias em um único sistema.' },
  { icon: '⚙️', title: 'Oficina Mecânica',    desc: 'OS, peças, mão de obra e histórico do cliente em um só lugar.' },
];

const pillars = [
  {
    label: 'Gerenciais',
    color: 'from-brand-600/20 to-violet-600/10 border-brand-500/20',
    icon: '📊',
    items: ['Vendas & Pedidos', 'Estoque', 'Compras', 'Financeiro', 'Contratos', 'CRM', 'Faturamento NF-e/NFSe'],
  },
  {
    label: 'Controladoria',
    color: 'from-emerald-600/20 to-teal-600/10 border-emerald-500/20',
    icon: '📑',
    items: ['Contábil', 'Fiscal', 'Custos', 'Tributos', 'Imobilizado'],
  },
  {
    label: 'Produtividade',
    color: 'from-amber-600/20 to-orange-600/10 border-amber-500/20',
    icon: '⚡',
    items: ['Dashboards em tempo real', 'Relatórios CSV', 'Monitor NF-e', 'Painéis de análise', 'Edge computing'],
  },
];

const visions = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    title: 'Visão 360°',
    desc: 'Todos os setores — filiais, financeiro, estoque, vendas e fiscal — integrados em uma única tela. De onde estiver.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Mais segurança',
    desc: 'Tecnologia em nuvem multi-tenant com dados isolados por empresa. Backup automático, SSL e infraestrutura edge.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Reduza custos',
    desc: 'Sem servidores próprios, sem licenças caras. Pague apenas pelo que usar. Comece de graça e cresça no seu ritmo.',
  },
];

const testimonials = [
  {
    quote: 'O SISCR integrou estoque, financeiro e faturamento em tempo real. Ganhamos velocidade que antes era impossível com planilha.',
    name: 'Carlos M.',
    role: 'Diretor Operacional — Distribuidora SC',
  },
  {
    quote: 'A emissão de NF-e conectada diretamente ao pedido zerou o retrabalho da equipe fiscal. Simples e muito rápido.',
    name: 'Ana P.',
    role: 'Gerente Financeiro — Indústria PR',
  },
];

const plans = [
  {
    name: 'Free', price: 'R$ 0', period: 'demonstração',
    features: ['1 empresa', '2 filiais', '3 usuários', 'Módulos essenciais', 'Suporte comunidade'],
    cta: 'Criar conta grátis', highlight: false, ctaLink: '/signup?plan=free',
  },
  {
    name: 'Básico', price: 'R$ 99', period: '/mês',
    features: ['1 empresa', '3 filiais', '5 usuários', 'Todos os módulos', 'NF-e e NFSe', 'Suporte e-mail'],
    cta: 'Assinar Básico', highlight: false, ctaLink: '/plans',
  },
  {
    name: 'Pro', price: 'R$ 249', period: '/mês',
    features: ['3 empresas', '10 filiais', '20 usuários', 'Todos os módulos', 'NF-e e NFSe', 'Suporte prioritário', 'API de integração'],
    cta: 'Assinar Pro', highlight: true, ctaLink: '/plans',
  },
  {
    name: 'Enterprise', price: 'R$ 499', period: '/mês',
    features: ['Ilimitado', 'Filiais ilimitadas', 'Usuários ilimitados', 'Todos os módulos', 'NF-e e NFSe', 'Suporte 24/7', 'SLA 99.9%', 'Onboarding dedicado'],
    cta: 'Falar com vendas', highlight: false, ctaLink: '/plans',
  },
];

/* ─── mini mockup dashboard ─────────────────────── */
function DashMock() {
  return (
    <div className="relative max-w-3xl mx-auto">
      {/* brilho ao redor */}
      <div className="absolute inset-0 -m-8 bg-brand-500/10 rounded-3xl blur-2xl" />

      <div className="relative bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-2xl shadow-brand-900/40">
        {/* barra de app */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface/60">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <div className="flex-1 mx-4 bg-surface-border rounded-full h-5 max-w-xs" />
          <div className="w-6 h-6 rounded-full bg-brand-500/40" />
        </div>

        <div className="p-4 space-y-4">
          {/* cards de métricas */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Faturamento',  value: 'R$ 127k', diff: '+12%', color: 'text-emerald-400' },
              { label: 'Pedidos',      value: '3.841',   diff: '+8%',  color: 'text-emerald-400' },
              { label: 'A Receber',    value: 'R$ 48k',  diff: '-3%',  color: 'text-red-400' },
              { label: 'A Pagar',      value: 'R$ 21k',  diff: '+1%',  color: 'text-amber-400' },
            ].map(c => (
              <div key={c.label} className="bg-surface border border-surface-border rounded-xl p-3">
                <div className="text-slate-500 text-[10px] mb-1">{c.label}</div>
                <div className="text-white font-bold text-sm">{c.value}</div>
                <div className={`text-[10px] font-medium ${c.color}`}>{c.diff} vs mês ant.</div>
              </div>
            ))}
          </div>

          {/* gráfico + lista */}
          <div className="grid grid-cols-3 gap-3">
            {/* gráfico de barras */}
            <div className="col-span-2 bg-surface border border-surface-border rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-4">Vendas mensais</div>
              <div className="flex items-end gap-2 h-20">
                {[30, 55, 40, 70, 50, 85, 65].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${i === 5 ? 'bg-brand-500' : 'bg-brand-700/60'}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'].map(m => (
                  <span key={m} className="text-slate-600 text-[9px]">{m}</span>
                ))}
              </div>
            </div>

            {/* tabela pedidos */}
            <div className="bg-surface border border-surface-border rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-3">Últimos pedidos</div>
              {[
                { label: 'Cliente A', valor: 'R$ 4.200', status: 'Aprovado',   color: 'bg-emerald-500/20 text-emerald-400' },
                { label: 'Cliente B', valor: 'R$ 890',   status: 'Pendente',   color: 'bg-amber-500/20 text-amber-400' },
                { label: 'Cliente C', valor: 'R$ 12k',   status: 'Faturado',   color: 'bg-brand-500/20 text-brand-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                  <span className="text-white text-[10px]">{r.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${r.color}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── página principal ───────────────────────────── */
export default function Home() {
  return (
    <div className="min-h-screen bg-surface font-sans text-white">

      {/* ── Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-600/30">S</div>
            <span className="font-display font-bold text-lg text-white">SISCR</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#solucoes"  className="hover:text-white transition-colors">Soluções</a>
            <a href="#funcional" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#pricing"   className="hover:text-white transition-colors">Planos</a>
            <Link to="/login"   className="hover:text-white transition-colors">Entrar</Link>
          </nav>
          <Link to="/plans" className="btn-primary text-sm px-5 py-2.5">
            Começar grátis
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-brand-600/15 rounded-full blur-[130px]" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
            Sistema de Gestão ERP · 100% Cloud · Edge Computing
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            Gestão cloud para<br />
            <span className="bg-gradient-brand bg-clip-text text-transparent">sua empresa crescer</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            ERP de alta performance para empresas que precisam de controle,
            velocidade e menos burocracia. Simples de usar, poderoso para escalar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/plans" className="btn-primary text-base px-8 py-4 shadow-xl shadow-brand-600/30">
              Nossas soluções →
            </Link>
            <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Já tenho conta · Entrar
            </Link>
          </div>
        </div>

        {/* stats */}
        <div className="relative max-w-3xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-surface-border rounded-2xl overflow-hidden">
          {[
            { value: '< 50ms', label: 'Latência média' },
            { value: '99.99%', label: 'Disponibilidade' },
            { value: 'R$ 0',   label: 'Para começar' },
            { value: '100%',   label: 'Na nuvem' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card px-6 py-5 text-center">
              <div className="font-display text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Segmentos ── */}
      <section id="solucoes" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Nossas Soluções</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Seus negócios voando alto
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Soluções para os mais diversos segmentos, com todo o suporte para potencializar as operações da sua empresa.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {segments.map(s => (
              <div key={s.title} className="group card-dark p-6 hover:border-brand-500/40 hover:bg-surface-card/80 transition-all duration-200 cursor-default">
                <div className="w-12 h-12 rounded-xl bg-brand-600/15 flex items-center justify-center text-2xl mb-4 group-hover:bg-brand-600/25 transition-colors">
                  {s.icon}
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 Pilares ── */}
      <section id="funcional" className="py-24 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Investimento que gera resultados
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Com uma única plataforma você controla todos os setores de forma integrada, ganhando tempo no dia a dia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map(p => (
              <div key={p.label} className={`rounded-2xl border bg-gradient-to-br ${p.color} p-6`}>
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-display font-bold text-white text-xl mb-4">{p.label}</h3>
                <ul className="space-y-2">
                  {p.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-none" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard preview + Visão 360 ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Controle Total</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Visão completa da sua empresa
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Aumente a produtividade com transparência e agilidade na tomada de decisões estratégicas.
            </p>
          </div>

          <DashMock />

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {visions.map(v => (
              <div key={v.title} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-600/15 border border-brand-500/20 flex items-center justify-center text-brand-400 mx-auto mb-4">
                  {v.icon}
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2">{v.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="pricing" className="py-24 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Planos</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Preços simples e transparentes
            </h2>
            <p className="text-slate-400 text-lg">Comece grátis. Pague apenas quando crescer.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map(plan => (
              <div key={plan.name} className={`relative flex flex-col rounded-2xl p-6 border ${plan.highlight ? 'bg-gradient-brand border-brand-400 shadow-2xl shadow-brand-600/30' : 'bg-surface-card border-surface-border hover:border-brand-600/30 transition-colors'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-brand-700 text-xs font-bold rounded-full shadow">
                    MAIS POPULAR
                  </div>
                )}
                <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${plan.highlight ? 'text-white/70' : 'text-slate-500'}`}>{plan.name}</div>
                <div className="font-display text-3xl font-extrabold text-white mb-0.5">{plan.price}</div>
                <div className={`text-xs mb-5 ${plan.highlight ? 'text-white/60' : 'text-slate-500'}`}>{plan.period}</div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-center gap-2 text-xs ${plan.highlight ? 'text-white/90' : 'text-slate-300'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-none ${plan.highlight ? 'bg-white/20 text-white' : 'bg-brand-600/20 text-brand-400'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaLink}
                  className={`block w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${plan.highlight ? 'bg-white text-brand-700 hover:bg-slate-50' : 'bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-600/30'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-sm mt-8 text-center">
            Todos os planos incluem SSL, backups automáticos e infraestrutura em nuvem.
          </p>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Depoimentos</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="card-dark p-6 flex flex-col gap-4">
                <svg className="w-8 h-8 text-brand-500/50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-24 px-6 bg-surface-card/30">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
            Dê o próximo passo
          </div>
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Gerencie sua empresa de forma<br />muito mais ágil e 100% na nuvem
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Configure sua conta em menos de 2 minutos. Sem cartão de crédito no plano gratuito.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/plans" className="btn-primary text-base px-10 py-4 shadow-xl shadow-brand-600/30">
              Criar minha conta grátis →
            </Link>
            <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Já tenho conta · Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-border py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-xs shadow">S</div>
              <span className="font-display font-bold text-white">SISCR</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Inteligência e produtividade para o seu negócio.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Soluções</p>
            <ul className="space-y-2">
              {['Indústria', 'Distribuidora', 'Comércio', 'Serviços', 'Escritório Contábil'].map(s => (
                <li key={s}><a href="#solucoes" className="text-slate-400 hover:text-white text-sm transition-colors">{s}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Institucional</p>
            <ul className="space-y-2">
              {[
                { label: 'Planos', to: '/plans' },
                { label: 'Login', to: '/login' },
                { label: 'Criar conta', to: '/plans' },
              ].map(l => (
                <li key={l.label}><Link to={l.to} className="text-slate-400 hover:text-white text-sm transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Fale Conosco</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>contato@siscr.com.br</li>
              <li>Suporte via sistema</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-surface-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© {new Date().getFullYear()} SISCR · LP Software. Todos os direitos reservados.</span>
          <span>Desenvolvido com Cloudflare Workers · Edge Computing · Multi-tenant</span>
        </div>
      </footer>
    </div>
  );
}
