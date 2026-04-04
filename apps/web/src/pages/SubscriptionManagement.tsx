import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { authService } from '../services/auth';

interface SubscriptionData {
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  subscription_expires_at: string | null;
  plan_nome: string;
  preco_mensal: number;
  preco_anual: number;
  max_empresas: number;
  max_filiais: number;
  max_usuarios: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',      color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  suspended: { label: 'Suspensa',   color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  cancelled: { label: 'Cancelada',  color: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
};

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
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando assinatura...
        </div>
      </div>
    );
  }

  const statusInfo = subscription ? (STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: 'bg-slate-500/15 text-slate-400 border-slate-500/20' }) : null;
  const isFree = !subscription?.stripe_customer_id || subscription?.plan_id === 'free';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white mb-1">Assinatura</h1>
        <p className="text-slate-400 text-sm">Gerencie seu plano e dados de cobrança.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {subscription && (
        <>
          {/* Card do plano atual */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 mb-4">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Plano atual</div>
                <div className="font-display text-2xl font-bold text-white">{subscription.plan_nome || subscription.plan_id}</div>
              </div>
              {statusInfo && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 rounded-xl bg-surface/50 border border-surface-border">
                <div className="text-xl font-bold text-white">{subscription.max_empresas}</div>
                <div className="text-xs text-slate-500 mt-0.5">Empresa{subscription.max_empresas !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-surface/50 border border-surface-border">
                <div className="text-xl font-bold text-white">{subscription.max_filiais}</div>
                <div className="text-xs text-slate-500 mt-0.5">Filiais</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-surface/50 border border-surface-border">
                <div className="text-xl font-bold text-white">{subscription.max_usuarios}</div>
                <div className="text-xs text-slate-500 mt-0.5">Usuários</div>
              </div>
            </div>

            {subscription.preco_mensal > 0 && (
              <div className="flex items-baseline gap-1 text-brand-300">
                <span className="text-2xl font-bold">
                  R$ {subscription.preco_mensal.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-sm text-slate-500">/mês</span>
              </div>
            )}

            {subscription.subscription_expires_at && (
              <div className="mt-3 text-xs text-slate-500">
                Válido até: <span className="text-slate-300">{formatDate(subscription.subscription_expires_at)}</span>
              </div>
            )}
          </div>

          {/* Ação principal */}
          {isFree ? (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
              <div className="text-slate-400 text-sm mb-4">
                Você está no plano gratuito. Faça upgrade para desbloquear mais recursos.
              </div>
              <Link to="/plans" className="btn-primary px-8 py-3">
                Ver planos disponíveis →
              </Link>
            </div>
          ) : (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-2">Portal de cobrança</h2>
              <p className="text-slate-400 text-sm mb-5">
                Acesse o portal do Stripe para alterar de plano, atualizar dados de pagamento,
                baixar faturas ou cancelar a assinatura.
              </p>
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="btn-primary w-full py-3.5 text-base"
              >
                {portalLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Abrindo portal...
                  </span>
                ) : (
                  'Gerenciar assinatura no Stripe →'
                )}
              </button>
              <p className="text-xs text-slate-600 text-center mt-3">
                Você será redirecionado para o portal seguro do Stripe.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
