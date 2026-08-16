import { useState, useEffect } from 'react';
import { fmtBRL } from '../utils/format';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { authService } from '../services/auth';

interface SubscriptionData {
  plan_id: string | null;
  plan_id_efetivo?: string;
  status: string;
  stripe_customer_id: string | null;
  subscription_expires_at: string | null;
  plan_nome: string;
  preco_mensal: number;
  preco_anual: number;
  max_empresas: number;
  max_filiais: number;
  max_usuarios: number;
  max_docs_fiscais_mes?: number;
  max_emails_mes?: number;
  uso?: {
    empresas: number;
    filiais: number;
    usuarios: number;
    docs_fiscais_mes?: number;
  };
  caracteristicas?: { rotulo: string; ordem: number }[];
}

function UsoBar({ label, uso, max }: { label: string; uso: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((uso / max) * 100));
  const full = uso >= max;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
        <span>{label}</span>
        <span className={full ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}>
          {uso} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-amber-500' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Ativa',
    className:
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
  },
  suspended: {
    label: 'Suspensa',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  },
  cancelled: {
    label: 'Cancelada',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

function Spinner({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-500 ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadSubscription();
  }, [navigate]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/tenant/info/subscription');
      setSubscription(data.subscription);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Erro ao carregar dados da assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setPortalLoading(true);
      setError('');
      const { data } = await api.post('/tenant/info/subscription/portal');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error || '';
      if (msg.includes('Nenhuma assinatura')) {
        setError('Sua conta está no plano gratuito. Faça upgrade para gerenciar via Stripe.');
      } else {
        setError(msg || 'Erro ao abrir o portal de assinatura. Tente novamente.');
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
            <Spinner />
            Carregando assinatura…
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = subscription
    ? (STATUS_LABELS[subscription.status] ?? {
        label: subscription.status,
        className:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      })
    : null;
  const isFree = !subscription?.stripe_customer_id || subscription?.plan_id === 'free';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Configurações
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Assinatura</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Plano atual, limites do tenant e portal de cobrança (Stripe).
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm"
        >
          <svg
            className="w-5 h-5 flex-none mt-0.5 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {subscription && (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Plano atual
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
                  {subscription.plan_nome || subscription.plan_id}
                </h2>
              </div>
              {statusInfo && (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              {[
                { value: subscription.max_empresas, label: subscription.max_empresas !== 1 ? 'Empresas' : 'Empresa' },
                { value: subscription.max_filiais, label: 'Filiais' },
                { value: subscription.max_usuarios, label: 'Usuários' },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="text-center p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">limite do plano</div>
                </div>
              ))}
            </div>

            {subscription.uso && (
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-4">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Uso atual
                </p>
                <UsoBar
                  label="Empresas cadastradas"
                  uso={subscription.uso.empresas}
                  max={subscription.max_empresas}
                />
                <UsoBar label="Filiais" uso={subscription.uso.filiais} max={subscription.max_filiais} />
                <UsoBar label="Usuários ativos" uso={subscription.uso.usuarios} max={subscription.max_usuarios} />
                {typeof subscription.max_docs_fiscais_mes === 'number' && (
                  <UsoBar
                    label="Documentos fiscais neste mês"
                    uso={subscription.uso.docs_fiscais_mes ?? 0}
                    max={subscription.max_docs_fiscais_mes}
                  />
                )}
              </div>
            )}

            {subscription.caracteristicas && subscription.caracteristicas.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Incluso no seu plano
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                  {[...subscription.caracteristicas]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((c) => (
                      <li key={`${c.ordem}-${c.rotulo}`}>{c.rotulo}</li>
                    ))}
                </ul>
              </div>
            )}

            {subscription.preco_mensal > 0 && (
              <div className="flex items-baseline gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                  {fmtBRL(subscription.preco_mensal)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">/mês</span>
                {subscription.preco_anual > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                    ou {fmtBRL(subscription.preco_anual)}/ano
                  </span>
                )}
              </div>
            )}

            {subscription.subscription_expires_at && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Válido até{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDate(subscription.subscription_expires_at)}
                </span>
              </p>
            )}
          </div>

          {isFree ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                  />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-1 font-medium">Plano gratuito</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-5 max-w-md mx-auto">
                Faça upgrade para aumentar limites e desbloquear recursos avançados.
              </p>
              <Link to="/plans" className="btn-primary px-8 py-3 inline-flex items-center gap-2 justify-center">
                Ver planos e fazer upgrade
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Cobrança
              </p>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Portal do Stripe</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                Altere plano, forma de pagamento, baixe faturas ou cancele pela área segura do Stripe.
              </p>
              <button
                type="button"
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="btn-primary w-full py-3.5 text-base justify-center"
              >
                {portalLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner className="w-4 h-4" />
                    Abrindo portal…
                  </span>
                ) : (
                  <>
                    Gerenciar no Stripe
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                  </>
                )}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-3">
                Redirecionamento para o site seguro do Stripe.
              </p>
              <Link
                to="/plans"
                className="mt-4 block text-center text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                Comparar planos e limites
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
