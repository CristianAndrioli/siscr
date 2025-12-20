import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { paymentsService } from '../services/payments';
import { publicService, type Plan } from '../services/public';

interface TenantStatus {
  is_active: boolean;
  name?: string;
  subscription?: {
    status: string;
    plan?: {
      id: number;
      name: string;
    };
  };
}

function SubscriptionExpired() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar se usuário está autenticado
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Verificar status do tenant e subscription
    checkTenantStatus();
  }, [navigate]);

  const checkTenantStatus = async () => {
    try {
      // Tentar obter informações do tenant e subscription
      const userData = await authService.getCurrentUser();
      
      if (userData.tenant) {
        setTenantStatus({
          is_active: false, // Se chegou aqui, o tenant está desativado
          name: userData.tenant.name,
        });
      }

      // Tentar obter subscription atual
      try {
        const subscription = await paymentsService.getCurrentSubscription();
        setTenantStatus(prev => ({
          ...prev,
          subscription: {
            status: subscription.status,
            plan: subscription.plan,
          },
        }));

        // Se subscription está ativa, redirecionar para dashboard
        if (subscription.status === 'active' || subscription.status === 'trial') {
          navigate('/dashboard');
          return;
        }

        // Carregar detalhes do plano se houver
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
      } catch (err: any) {
        // Se não conseguir obter subscription, pode ser que não exista
        // Continuar mostrando a tela de assinatura expirada
        console.error('Erro ao verificar subscription:', err);
      }
    } catch (err: any) {
      console.error('Erro ao verificar status do tenant:', err);
      // Se não conseguir verificar, assumir que está tudo ok
      navigate('/dashboard');
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    if (!tenantStatus?.subscription?.plan?.id && !plan) {
      // Se não houver plano, redirecionar para escolher um plano
      navigate('/plans');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const planId = tenantStatus?.subscription?.plan?.id || plan?.id;
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

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Assinatura Expirada
          </h1>
          <p className="text-lg text-gray-600">
            {tenantStatus?.name 
              ? `A assinatura do tenant "${tenantStatus.name}" está expirada ou foi desativada.`
              : 'Sua assinatura está expirada ou foi desativada.'}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            O que aconteceu?
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-red-600 mr-2">•</span>
              <span>Sua assinatura expirou ou foi cancelada</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-600 mr-2">•</span>
              <span>O acesso ao sistema foi temporariamente suspenso</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-600 mr-2">•</span>
              <span>Renove sua assinatura para continuar usando o sistema</span>
            </li>
          </ul>
        </div>

        {plan && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Plano Anterior
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
          {plan ? (
            <button
              onClick={handleRenewSubscription}
              disabled={processing}
              className="flex-1 bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {processing ? 'Processando...' : '🔄 Renovar Assinatura'}
            </button>
          ) : (
            <Link
              to="/plans"
              className="flex-1 text-center bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700"
            >
              Ver Planos Disponíveis
            </Link>
          )}
          <Link
            to="/profile"
            className="flex-1 text-center bg-gray-200 text-gray-800 py-4 rounded-lg hover:bg-gray-300 font-semibold text-lg"
          >
            Meu Perfil
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Precisa de ajuda?
          </p>
          <p className="text-sm text-gray-600">
            Entre em contato com o suporte para mais informações sobre sua assinatura.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionExpired;

