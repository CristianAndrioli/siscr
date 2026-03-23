import { Link } from 'react-router-dom';

const plans = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: 'R$ 0',
    period: 'para sempre',
    description: 'Ideal para testar o sistema e conhecer a plataforma.',
    color: 'default',
    features: [
      '1 empresa',
      '2 filiais',
      '3 usuários',
      'Módulos essenciais',
      'Suporte via comunidade',
      'SSL incluso',
    ],
    missing: ['NF-e / NFSe', 'Relatórios avançados', 'SLA garantido'],
    cta: 'Criar conta grátis',
    ctaLink: '/signup?plan=free',
  },
  {
    id: 'basico',
    name: 'Básico',
    priceLabel: 'R$ 99',
    period: '/mês',
    description: 'Para pequenas empresas que precisam de gestão completa.',
    color: 'default',
    features: [
      '1 empresa',
      '3 filiais',
      '5 usuários',
      'Todos os módulos',
      'NF-e e NFSe',
      'Suporte por e-mail',
      'Relatórios completos',
    ],
    missing: ['Múltiplas empresas', 'SLA garantido'],
    cta: 'Assinar Básico',
    ctaLink: '/signup?plan=basico',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'Consultar',
    period: '',
    description: 'Para empresas em crescimento com múltiplas filiais.',
    color: 'brand',
    badge: 'Mais popular',
    features: [
      '3 empresas',
      '10 filiais',
      '20 usuários',
      'Todos os módulos',
      'NF-e e NFSe',
      'Suporte prioritário',
      'Relatórios avançados',
      'API de integração',
    ],
    missing: ['SLA enterprise'],
    cta: 'Assinar Pro',
    ctaLink: '/signup?plan=pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'R$ 499',
    period: '/mês',
    description: 'Para grupos empresariais que precisam de escala e suporte dedicado.',
    color: 'default',
    features: [
      'Empresas ilimitadas',
      'Filiais ilimitadas',
      'Usuários ilimitados',
      'Todos os módulos',
      'NF-e e NFSe',
      'Suporte 24/7',
      'SLA 99.9%',
      'Onboarding dedicado',
      'API de integração',
    ],
    missing: [],
    cta: 'Assinar Enterprise',
    ctaLink: '/signup?plan=enterprise',
  },
];

const faqs = [
  {
    q: 'Preciso de cartão de crédito no plano Free?',
    a: 'Não. O plano Free é gratuito para sempre sem dados de pagamento.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Cancele quando quiser pelo painel. Sem multas ou fidelidade.',
  },
  {
    q: 'Os dados ficam em servidor brasileiro?',
    a: 'A Cloudflare usa os data centers mais próximos do usuário automaticamente.',
  },
  {
    q: 'Posso migrar de plano depois?',
    a: 'Sim. Upgrades são imediatos; downgrades no próximo ciclo.',
  },
];

export default function Plans() {
  return (
    <div className="min-h-screen bg-surface font-sans text-white">

      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-display font-bold text-lg text-white">SISCR</span>
          </Link>
          <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Já tenho conta →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/15 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h1 className="font-display text-5xl font-extrabold text-white mb-4">Escolha seu plano</h1>
          <p className="text-slate-400 text-lg">
            Preços honestos. Sem taxas ocultas. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Cards de planos */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const isBrand = plan.color === 'brand';
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 ${
                  isBrand
                    ? 'bg-gradient-brand border-brand-400 shadow-2xl shadow-brand-600/30 md:-mt-4 md:mb-4'
                    : 'bg-surface-card border-surface-border hover:border-brand-600/30'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-brand-700 text-xs font-bold rounded-full shadow">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className={`text-sm font-semibold mb-2 ${isBrand ? 'text-white/70' : 'text-slate-400'}`}>
                    {plan.name}
                  </div>
                  <div className={`font-display text-4xl font-extrabold ${isBrand ? 'text-white' : 'text-white'}`}>
                    {plan.priceLabel}
                  </div>
                  <div className={`text-sm mb-3 ${isBrand ? 'text-white/70' : 'text-slate-500'}`}>
                    {plan.period}
                  </div>
                  <p className={`text-sm leading-relaxed mb-6 ${isBrand ? 'text-white/80' : 'text-slate-400'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="flex-1 mb-8">
                  <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isBrand ? 'text-white/60' : 'text-slate-500'}`}>
                    Incluído
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-center gap-2.5 text-sm ${isBrand ? 'text-white/90' : 'text-slate-300'}`}>
                        <span className={`flex-none w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isBrand ? 'bg-white/20 text-white' : 'bg-brand-600/20 text-brand-400'}`}>✓</span>
                        {f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className={`flex items-center gap-2.5 text-sm opacity-40 ${isBrand ? 'text-white' : 'text-slate-500'}`}>
                        <span className="flex-none w-5 h-5 rounded-full flex items-center justify-center text-xs">✕</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={plan.ctaLink}
                  className={`block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-all ${
                    isBrand
                      ? 'bg-white text-brand-700 hover:bg-slate-50 shadow-lg'
                      : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 px-6 bg-surface-card/20">
        <div className="max-w-2xl mx-auto pt-16">
          <h2 className="font-display text-3xl font-bold text-white text-center mb-12">
            Perguntas frequentes
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-surface-border pb-6">
                <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-slate-600">
          © {new Date().getFullYear()} SISCR. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
