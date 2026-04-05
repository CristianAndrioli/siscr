import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';

type ApiCaracteristica = { rotulo: string; ordem: number };

type ApiPlan = {
  id: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  max_empresas: number;
  max_filiais: number;
  max_usuarios: number;
  caracteristicas: ApiCaracteristica[];
};

type DisplayPlan = {
  id: string;
  name: string;
  priceLabel: string;
  period: string;
  description: string;
  color: 'default' | 'brand';
  badge?: string;
  features: string[];
  missing: string[];
  cta: string;
  ctaLink: string;
};

const DESCRIPTIONS: Record<string, string> = {
  free: 'Ideal para testar o sistema e conhecer a plataforma.',
  basico: 'Para pequenas empresas que precisam de gestão completa.',
  pro: 'Para empresas em crescimento com múltiplas filiais.',
  enterprise: 'Para grupos empresariais que precisam de escala e suporte dedicado.',
  starter: 'Entrada com recursos essenciais.',
  business: 'Operação com mais empresas e filiais.',
};

const MISSING_BY_ID: Record<string, string[]> = {
  free: ['NF-e / NFSe', 'Relatórios avançados', 'SLA garantido'],
  basico: ['Múltiplas empresas', 'SLA garantido'],
  pro: ['SLA enterprise'],
  enterprise: [],
  starter: [],
  business: [],
};

function featuresFromApi(p: ApiPlan): string[] {
  if (p.caracteristicas?.length) {
    return [...p.caracteristicas].sort((a, b) => a.ordem - b.ordem).map((c) => c.rotulo);
  }
  return [
    `${p.max_empresas} empresa(s)`,
    `${p.max_filiais} filial(is)`,
    `${p.max_usuarios} usuário(s)`,
  ];
}

function apiPlanToDisplay(p: ApiPlan): DisplayPlan {
  const isPro = p.id === 'pro';
  const preco = p.preco_mensal;
  const priceLabel = preco <= 0 ? 'R$ 0' : `R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const period = preco <= 0 ? 'para sempre' : '/mês';
  return {
    id: p.id,
    name: p.nome,
    priceLabel,
    period,
    description: DESCRIPTIONS[p.id] ?? 'Plano disponível na plataforma.',
    color: isPro ? 'brand' : 'default',
    badge: isPro ? 'Mais popular' : undefined,
    features: featuresFromApi(p),
    missing: MISSING_BY_ID[p.id] ?? [],
    cta: preco <= 0 ? 'Criar conta grátis' : `Assinar ${p.nome}`,
    ctaLink: `/signup?plan=${encodeURIComponent(p.id)}`,
  };
}

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
    a: 'A plataforma utiliza infraestrutura distribuída para oferecer bom desempenho conforme a região de acesso.',
  },
  {
    q: 'Posso migrar de plano depois?',
    a: 'Sim. Upgrades são imediatos; downgrades no próximo ciclo.',
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
        const { data } = await api.get<{ plans: ApiPlan[] }>('/subscriptions/plans');
        if (cancelled) return;
        const list = (data.plans ?? []).map(apiPlanToDisplay);
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
          <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Já tenho conta →
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
            Limites e benefícios vêm do cadastro de planos — sempre atualizados na API.
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
          <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {plans.map((plan) => {
              const isBrand = plan.color === 'brand';
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 ${
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
                    <div className={`text-sm mb-3 ${isBrand ? 'text-white/70' : 'text-slate-500'}`}>{plan.period}</div>
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
                            className={`flex-none w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isBrand ? 'bg-white/20 text-white' : 'bg-brand-600/20 text-brand-400'}`}
                          >
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                      {plan.missing.map((f) => (
                        <li
                          key={f}
                          className={`flex items-center gap-2.5 text-sm opacity-40 ${isBrand ? 'text-white' : 'text-slate-500'}`}
                        >
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
