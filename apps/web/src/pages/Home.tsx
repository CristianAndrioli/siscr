import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🏢',
    title: 'Multi-empresa e filiais',
    desc: 'Gerencie múltiplas empresas e filiais em uma única plataforma com dados completamente isolados.',
  },
  {
    icon: '📦',
    title: 'Controle de estoque',
    desc: 'Movimentações, transferências entre filiais, reservas e posição em tempo real.',
  },
  {
    icon: '💰',
    title: 'Financeiro completo',
    desc: 'Contas a pagar e receber, fluxo de caixa, boletos e conciliação automática.',
  },
  {
    icon: '🧾',
    title: 'Faturamento fiscal',
    desc: 'Emissão de NF-e e NFSe integrada à SEFAZ. XML armazenado com segurança.',
  },
  {
    icon: '🛒',
    title: 'Pedidos e vendas',
    desc: 'Orçamentos e pedidos de venda com geração automática de documentos fiscais.',
  },
  {
    icon: '⚡',
    title: 'Serverless e veloz',
    desc: 'Infraestrutura 100% no edge da Cloudflare. Resposta em milissegundos de qualquer lugar.',
  },
];

const stats = [
  { value: '< 50ms', label: 'Latência média' },
  { value: '99.99%', label: 'Disponibilidade' },
  { value: '$0', label: 'Para começar' },
  { value: '∞', label: 'Escalabilidade' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface font-sans text-white">

      {/* ── Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-display font-bold text-lg text-white">SISCR</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
            <Link to="/login" className="hover:text-white transition-colors">Entrar</Link>
          </nav>
          <Link to="/plans" className="btn-primary text-sm px-5 py-2.5">
            Começar grátis
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
            ERP SaaS • 100% na Cloudflare • Custo zero para começar
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            O ERP que escala<br />
            <span className="bg-gradient-brand bg-clip-text text-transparent">com seu negócio</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Gestão completa para empresas com múltiplas filiais. Estoque, financeiro, fiscal e vendas
            em uma plataforma serverless ultrarrápida.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/plans" className="btn-primary text-base px-8 py-4 shadow-xl shadow-brand-600/30">
              Criar conta grátis →
            </Link>
            <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
              Já tenho conta
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-3xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-surface-border rounded-2xl overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-card px-6 py-5 text-center">
              <div className="font-display text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 bg-surface-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Tudo que sua empresa precisa
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Módulos integrados, dados em tempo real, sem complexidade de infraestrutura.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card-dark p-6 hover:border-brand-500/40 hover:bg-surface-card/80 transition-all duration-200 group">
                <div className="w-12 h-12 rounded-xl bg-brand-600/15 flex items-center justify-center text-2xl mb-4 group-hover:bg-brand-600/25 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Preços simples e transparentes
          </h2>
          <p className="text-slate-400 text-lg mb-12">
            Comece grátis. Pague apenas quando crescer.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Free', price: 'R$ 0', period: '/sempre', features: ['1 empresa', '2 filiais', '3 usuários', 'Suporte comunidade'], cta: 'Começar grátis', highlight: false },
              { name: 'Starter', price: 'R$ 97', period: '/mês', features: ['1 empresa', '5 filiais', '10 usuários', 'Suporte prioritário'], cta: 'Assinar Starter', highlight: true },
              { name: 'Business', price: 'R$ 297', period: '/mês', features: ['3 empresas', '20 filiais', '50 usuários', 'SLA garantido'], cta: 'Assinar Business', highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl p-8 border ${plan.highlight ? 'bg-gradient-brand border-brand-400 shadow-2xl shadow-brand-600/30 scale-105' : 'bg-surface-card border-surface-border'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-brand-700 text-xs font-bold rounded-full">
                    MAIS POPULAR
                  </div>
                )}
                <div className={`text-sm font-semibold mb-2 ${plan.highlight ? 'text-white/70' : 'text-slate-400'}`}>{plan.name}</div>
                <div className={`font-display text-4xl font-extrabold mb-1 ${plan.highlight ? 'text-white' : 'text-white'}`}>{plan.price}</div>
                <div className={`text-sm mb-6 ${plan.highlight ? 'text-white/70' : 'text-slate-500'}`}>{plan.period}</div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-white/90' : 'text-slate-300'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${plan.highlight ? 'bg-white/20' : 'bg-brand-600/20 text-brand-400'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/plans"
                  className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.highlight ? 'bg-white text-brand-700 hover:bg-slate-100' : 'bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-600/30'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-sm mt-8">
            Todos os planos incluem SSL, backups automáticos e infraestrutura global.
          </p>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Configure sua conta em menos de 2 minutos. Sem cartão de crédito no plano gratuito.
          </p>
          <Link to="/plans" className="btn-primary text-base px-10 py-4 shadow-xl shadow-brand-600/30">
            Criar minha conta →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-brand flex items-center justify-center text-white font-bold text-xs">S</div>
            <span className="font-display font-semibold text-slate-400">SISCR</span>
          </div>
          <span>© {new Date().getFullYear()} SISCR. Todos os direitos reservados.</span>
          <div className="flex gap-6">
            <Link to="/plans" className="hover:text-slate-300 transition-colors">Planos</Link>
            <Link to="/login" className="hover:text-slate-300 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
