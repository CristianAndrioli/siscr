import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { paymentsService } from '../services/payments';
import { publicService, type Plan } from '../services/public';
import api from '../services/api';

interface SubscriptionStatus {
  status: string;
  plan?: {
    id: number;
    name: string;
  };
  requires_payment: boolean;
}

function PaymentPending() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar se usuário está autenticado
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Verificar status da subscription
    checkSubscriptionStatus();
  }, [navigate]);

  const checkSubscriptionStatus = async () => {
    try {
      const subscription = await paymentsService.getCurrentSubscription();
      
      if (subscription.status === 'pending' || subscription.status === 'past_due') {
        setSubscriptionStatus({
          status: subscription.status,
          plan: subscription.plan,
          requires_payment: subscription.requires_payment,
        });
        
        // Carregar detalhes do plano
        if (subscription.plan && subscription.plan.id) {
          try {
            const plans = await publicService.getPlans();
            const foundPlan = plans.find((p) => p.id === subscription.plan.id);
            if (foundPlan) {
              setPlan(foundPlan);
            }
          } catch (err) {
            console.error('Erro ao carregar plano:', err);
          }
        }
      } else if (subscription.status === 'active' || subscription.status === 'trial') {
        // Se já está ativa, redirecionar para home
        navigate('/app');
        return;
      }
    } catch (err: any) {
      // Se der erro 404, não há subscription (redirecionar para planos)
      if (err.response?.status === 404) {
        navigate('/plans');
        return;
      } else if (err.response?.status === 402) {
        // Se der erro 402, significa que está pending (middleware bloqueou)
        const errorData = err.response.data;
        setSubscriptionStatus({
          status: errorData.subscription_status || 'pending',
          requires_payment: errorData.requires_payment || true,
        });
      } else {
        console.error('Erro ao verificar subscription:', err);
        // Se não conseguir verificar, assumir que está tudo ok
        navigate('/app');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!subscriptionStatus?.plan?.id && !plan) {
      setError('Plano não encontrado. Por favor, selecione um plano.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const planId = subscriptionStatus?.plan?.id || plan?.id;
      if (!planId) {
        throw new Error('Plano não encontrado');
      }

      const { checkout_url } = await paymentsService.createCheckoutSession(
        planId,
        'monthly'
      );
      
      // Redirecionar para checkout do Stripe
      window.location.href = checkout_url;
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Erro ao criar sessão de checkout. Tente novamente.'
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando status da assinatura...</p>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus || subscriptionStatus.status !== 'pending') {
    // Se não está pending, redirecionar para home
    navigate('/app');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="text-yellow-500 text-6xl mb-4">⏳</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Pagamento Pendente
          </h1>
          <p className="text-lg text-gray-600">
            Sua assinatura está aguardando confirmação de pagamento.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            O que aconteceu?
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-yellow-600 mr-2">•</span>
              <span>Seu cadastro foi criado com sucesso</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-600 mr-2">•</span>
              <span>O pagamento ainda não foi confirmado</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-600 mr-2">•</span>
              <span>Complete o pagamento para ativar sua assinatura</span>
            </li>
          </ul>
        </div>

        {plan && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Plano Selecionado
            </h3>
            <p className="text-2xl font-bold text-indigo-600 mb-2">
              {plan.name}
            </p>
            <p className="text-gray-600">
              {plan.description}
            </p>
            <p className="text-xl font-semibold text-gray-900 mt-4">
              R$ {parseFloat(plan.price_monthly).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} / mês
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handlePayNow}
            disabled={processing}
            className="flex-1 bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? 'Processando...' : '💳 Realizar Pagamento Agora'}
          </button>
          <Link
            to="/plans"
            className="flex-1 text-center bg-gray-200 text-gray-800 py-4 rounded-lg hover:bg-gray-300 font-semibold text-lg"
          >
            Ver Planos
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Problemas com o pagamento?
          </p>
          <button
            onClick={checkSubscriptionStatus}
            className="text-sm text-indigo-600 hover:text-indigo-800 underline"
          >
            Atualizar Status
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentPending;

