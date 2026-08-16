import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  fetchPublicPlans,
  formatPlanReais,
  planFeatureLabels,
  type PlanRow,
} from '../services/subscriptions';

type DisplayPlan = {
  id: string;
  name: string;
  priceLabel: string;
  period: string;
  annualHint: string | null;
  description: string;
  color: 'default' | 'brand';
  badge?: string;
  features: string[];
  cta: string;
  ctaLink: string;
};

const DESCRIPTIONS: Record<string, string> = {
  free: 'Demo sem cartão. 1 CNPJ, sem emissão de NF-e / NFS-e.',
  basico: 'PME de 1 CNPJ: gestão completa, 50 notas/mês, suporte por e-mail.',
  pro: 'Mais filiais e notas. Âncora comercial do SISCR.',
  enterprise: 'Teto self-serve. Acima disso, cotação.',
};

function apiPlanToDisplay(p: PlanRow): DisplayPlan {
  const isPro = p.id === 'pro';
  const preco = p.preco_mensal;
  const paid = preco > 0;
  return {
    id: p.id,
    name: p.nome,
    priceLabel: formatPlanReais(preco),
    period: paid ? '/mês' : 'para sempre',
    annualHint:
      paid && p.preco_anual > 0
        ? `${formatPlanReais(p.preco_anual)}/ano (2 meses grátis)`
        : null,
    description: DESCRIPTIONS[p.id] ?? 'Plano disponível na plataforma.',
    color: isPro ? 'brand' : 'default',
    badge: isPro ? 'Mais popular' : undefined,
    features: planFeatureLabels(p),
    cta: paid ? `Assinar ${p.nome}` : 'Criar conta grátis',
    ctaLink: `/signup?plan=${encodeURIComponent(p.id)}`,
  };
}

const CONTACT_MAILTO =
  'mailto:contato@siscr.com.br?subject=' + encodeURIComponent('Plano personalizado — SISCR');

const CUSTOM_PLAN_FEATURES = [
  'Limites e módulos sob medida',
  'Integrações específicas do seu negócio',
  'Onboarding acompanhado pelo time',
  'SLA e suporte dedicado',
];

const faqs = [
  {
    q: 'Preciso de cartão no plano Free?',
    a: 'Não. O Free é demo sem cartão e sem emissão de NF-e / NFS-e.',
  },
  {
    q: 'Os preços incluem impostos?',
    a: 'Sim. Os valores exibidos são os cobrados no Stripe, com impostos inclusos. Não há “+ ISS” na hora do pagamento.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. O cancelamento vale no fim do ciclo já pago. Sem multa de fidelidade.',
  },
  {
    q: 'E se o pagamento falhar?',
    a: 'O acesso ao ERP é bloqueado até regularizar. Entre, pague a fatura ou atualize o cartão no portal Stripe; o sistema volta sozinho.',
  },
  {
    q: 'Posso migrar de plano depois?',
    a: 'Sim. Troca de plano atualiza a assinatura existente (com proporcional). Não cria uma segunda cobrança.',
  },
];

export default function Plans() {
  const [plans, setPlans] = useState<DisplayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await fetchPublicPlans()).map(apiPlanToDisplay);
        if (cancelled) return;
        setPlans(list);
        setLoadError(list.length === 0);
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setPlans([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface font-sans text-white">
      <header className="fixed top-0 inset-x-0 z-50 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-display font-bold text-lg text-white">SISCR</span>
          </Link>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            Já tenho conta
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </header>

      <section className="pt-32 pb-16 px-6 text-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/15 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h1 className="font-display text-5xl font-extrabold text-white mb-4">Escolha seu plano</h1>
          <p className="text-slate-400 text-lg">
            Mensalidade da empresa (1 CNPJ). Preços iguais aos do Stripe, impostos inclusos. Trial de 14 dias nos planos pagos.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        {loading && (
          <div className="max-w-6xl mx-auto text-center text-slate-400 py-16">Carregando planos…</div>
        )}
        {!loading && loadError && (
          <div className="max-w-6xl mx-auto text-center text-amber-400/90 py-8 text-sm">
            Não foi possível carregar os planos. Verifique a API ou tente novamente.
          </div>
        )}
        {!loading && plans.length > 0 && (
          <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
            {plans.map((plan) => {
              const isBrand = plan.color === 'brand';
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-8 transition-all duration-200 ${
                    isBrand
                      ? 'bg-gradient-brand border-brand-400 shadow-2xl shadow-brand-600/30'
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
                    <div className={`text-sm mb-1 ${isBrand ? 'text-white/70' : 'text-slate-500'}`}>{plan.period}</div>
                    {plan.annualHint && (
                      <div className={`text-xs mb-3 ${isBrand ? 'text-white/60' : 'text-slate-500'}`}>{plan.annualHint}</div>
                    )}
                    {!plan.annualHint && <div className="mb-3" />}
                    <p className={`text-sm leading-relaxed mb-6 ${isBrand ? 'text-white/80' : 'text-slate-400'}`}>
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex-1 mb-8">
                    <div
                      className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isBrand ? 'text-white/60' : 'text-slate-500'}`}
                    >
                      Incluído
                    </div>
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className={`flex items-center gap-2.5 text-sm ${isBrand ? 'text-white/90' : 'text-slate-300'}`}
                        >
                          <span
                            className={`flex-none w-5 h-5 rounded-full flex items-center justify-center ${isBrand ? 'bg-white/20 text-white' : 'bg-brand-600/20 text-brand-400'}`}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
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
                  {plan.id !== 'free' && (
                    <Link
                      to={`/checkout?plan=${plan.id}`}
                      className={`block w-full text-center mt-2 text-xs font-medium transition-colors ${
                        isBrand ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-brand-400'
                      }`}
                    >
                      Já tenho conta — assinar este plano
                    </Link>
                  )}
                </div>
              );
            })}
            <div className="relative flex flex-col rounded-xl border border-dashed border-brand-500/40 bg-surface-card/80 p-8 hover:border-brand-400/60 transition-all duration-200">
              <div>
                <div className="text-sm font-semibold mb-2 text-brand-400">Personalizado</div>
                <div className="font-display text-4xl font-extrabold text-white">Sob consulta</div>
                <div className="text-sm mb-1 text-slate-500">para o seu cenário</div>
                <div className="mb-3" />
                <p className="text-sm leading-relaxed mb-6 text-slate-400">
                  Precisa de limites, módulos ou integrações que os planos prontos não cobrem? Fale com a gente.
                </p>
              </div>
              <div className="flex-1 mb-8">
                <div className="text-xs font-semibold uppercase tracking-wider mb-3 text-slate-500">Incluído</div>
                <ul className="space-y-2.5">
                  {CUSTOM_PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <span className="flex-none w-5 h-5 rounded-full flex items-center justify-center bg-brand-600/20 text-brand-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={CONTACT_MAILTO}
                className="block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-all bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20"
              >
                Falar com o time
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="pb-24 px-6 bg-surface-card/20">
        <div className="max-w-2xl mx-auto pt-16">
          <h2 className="font-display text-3xl font-bold text-white text-center mb-12">Perguntas frequentes</h2>
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

      <footer className="border-t border-surface-border py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-slate-600">
          © {new Date().getFullYear()} SISCR. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
