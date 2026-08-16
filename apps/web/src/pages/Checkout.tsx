import { useState, useEffect } from 'react';
import { fmtBRL } from '../utils/format';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import {
  fetchPublicPlans,
  createTenantCheckout,
  type PlanRow,
  type PaidPlanId,
} from '../services/subscriptions';
import ErrorMessage from '../components/common/ErrorMessage';
import LoadingSpinner from '../components/common/LoadingSpinner';

const PAID_IDS: PaidPlanId[] = ['basico', 'pro', 'enterprise'];

function isPaidPlanId(id: string): id is PaidPlanId {
  return PAID_IDS.includes(id as PaidPlanId);
}

function parseFeatures(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (Array.isArray(j)) return j.map(String);
    if (typeof j === 'object' && j !== null && 'items' in j && Array.isArray((j as { items: unknown }).items)) {
      return (j as { items: string[] }).items.map(String);
    }
  } catch {
    /* texto livre */
  }
  return raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planParam = (searchParams.get('plan') || '').toLowerCase();

  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  useEffect(() => {
    if (!planParam) {
      setLoadingPlan(false);
      return;
    }
    if (planParam === 'free' || planParam === 'trial') {
      navigate(`/signup?plan=${planParam}`, { replace: true });
      return;
    }
    if (!isPaidPlanId(planParam)) {
      setError('Plano inválido.');
      setLoadingPlan(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const plans = await fetchPublicPlans();
        if (cancelled) return;
        const found = plans.find((p) => p.id === planParam);
        if (found) setPlan(found);
        else setError('Plano não encontrado ou indisponível.');
      } catch {
        if (!cancelled) setError('Erro ao carregar planos. Tente novamente.');
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planParam, navigate]);

  const handleCheckout = async () => {
    if (!plan || !isPaidPlanId(plan.id)) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/checkout?plan=${encodeURIComponent(plan.id)}`);
      return;
    }
    setLoadingCheckout(true);
    setError('');
    try {
      const result = await createTenantCheckout(plan.id);
      if (result.updated) {
        navigate('/subscription-management');
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError('Não foi possível iniciar o pagamento.');
      setLoadingCheckout(false);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Erro ao iniciar pagamento. Tente novamente.');
      setLoadingCheckout(false);
    }
  };

  const features = plan ? parseFeatures(plan.features) : [];

  if (loadingPlan) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!planParam || !plan) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-display mb-2">Escolha um plano</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Use um link com o plano desejado, por exemplo <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">/checkout?plan=basico</code>.
          </p>
          <Link
            to="/plans"
            className="block w-full text-center btn-primary py-3"
          >
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  const priceLabel = fmtBRL(plan.preco_mensal);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link to="/" className="font-display font-bold text-lg text-brand-600 dark:text-brand-400">
            SISCR
          </Link>
          <Link to="/plans" className="text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400">
            ← Planos
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100 mb-6">Assinar plano</h1>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-5 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{plan.nome}</h2>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">
              {priceLabel}
              <span className="text-base font-normal text-slate-500 dark:text-slate-400"> /mês</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>Até {plan.max_usuarios} usuário{plan.max_usuarios !== 1 ? 's' : ''}</li>
              <li>Até {plan.max_empresas} empresa{plan.max_empresas !== 1 ? 's' : ''}</li>
              <li>Até {plan.max_filiais} filial{plan.max_filiais !== 1 ? 'is' : ''}</li>
            </ul>
            {features.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-4">
                {features.slice(0, 12).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-none text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <ErrorMessage message={error} onClose={() => setError('')} />}

          {!isAuthenticated ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-900 dark:text-amber-200 mb-4">
              <p className="mb-2">Faça login com a conta do tenant que deseja assinar.</p>
              <Link
                to={`/login?redirect=/checkout?plan=${encodeURIComponent(plan.id)}`}
                className="font-semibold text-brand-600 dark:text-brand-400 underline"
              >
                Entrar
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loadingCheckout}
              className="w-full btn-primary py-3.5 justify-center"
            >
              {loadingCheckout ? 'Redirecionando…' : 'Pagar com Stripe'}
            </button>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-4">
            Cobrança segura via Stripe. Após o pagamento, o plano é atualizado automaticamente.
          </p>
        </div>
      </main>
    </div>
  );
}
