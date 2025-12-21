import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentsService, type SubscriptionStatus } from '../services/payments';
import { publicService, type Plan } from '../services/public';
import { authService } from '../services/auth';

function SubscriptionManagement() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [subscriptionData, plansData] = await Promise.all([
        paymentsService.getCurrentSubscription(),
        publicService.getPlans(),
      ]);
      
      setSubscription(subscriptionData);
      setPlans(plansData);
      setSelectedPlanId(subscriptionData.plan.id);
      setSelectedBillingCycle(subscriptionData.billing_cycle as 'monthly' | 'yearly');
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate('/plans');
        return;
      }
      setError(err.response?.data?.error || 'Erro ao carregar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeDowngrade = async () => {
    if (!selectedPlanId) {
      setError('Selecione um plano');
      return;
    }

    if (selectedPlanId === subscription?.plan.id && selectedBillingCycle === subscription?.billing_cycle) {
      setError('Você já está neste plano');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await paymentsService.updateSubscription(selectedPlanId, selectedBillingCycle);
      await loadData(); // Recarregar dados
      alert('Plano atualizado com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar plano');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    setError('');

    try {
      await paymentsService.cancelSubscription();
      await loadData(); // Recarregar dados
      setShowCancelConfirm(false);
      alert('Assinatura será cancelada ao fim do período atual');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cancelar assinatura');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    setError('');

    try {
      await paymentsService.reactivateSubscription();
      await loadData(); // Recarregar dados
      alert('Assinatura reativada com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao reativar assinatura');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'past_due':
        return 'bg-orange-100 text-orange-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-700">Carregando...</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Nenhuma Assinatura</h2>
          <p className="text-gray-600 mb-6">Você não possui uma assinatura ativa.</p>
          <button
            onClick={() => navigate('/plans')}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700"
          >
            Ver Planos Disponíveis
          </button>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === subscription.plan.id);
  const availablePlans = plans.filter((p) => !p.is_trial);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gerenciar Assinatura</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Plano Atual */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Plano Atual</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Plano</p>
            <p className="text-lg font-semibold text-gray-900">{subscription.plan.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(subscription.status)}`}>
              {subscription.status_display}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ciclo de Cobrança</p>
            <p className="text-lg font-semibold text-gray-900">
              {subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Próxima Cobrança</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(subscription.current_period_end)}
            </p>
          </div>
        </div>

        {currentPlan && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Preço</p>
            <p className="text-2xl font-bold text-indigo-600">
              {subscription.billing_cycle === 'monthly' 
                ? `R$ ${parseFloat(currentPlan.price_monthly).toFixed(2)}/mês`
                : currentPlan.price_yearly 
                  ? `R$ ${parseFloat(currentPlan.price_yearly).toFixed(2)}/ano`
                  : `R$ ${parseFloat(currentPlan.price_monthly).toFixed(2)}/mês`}
            </p>
          </div>
        )}
      </div>

      {/* Alterar Plano */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Alterar Plano</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar Plano
          </label>
          <select
            value={selectedPlanId || ''}
            onChange={(e) => setSelectedPlanId(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            disabled={processing}
          >
            {availablePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} - R$ {parseFloat(plan.price_monthly).toFixed(2)}/mês
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ciclo de Cobrança
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="monthly"
                checked={selectedBillingCycle === 'monthly'}
                onChange={(e) => setSelectedBillingCycle(e.target.value as 'monthly')}
                className="mr-2"
                disabled={processing}
              />
              Mensal
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="yearly"
                checked={selectedBillingCycle === 'yearly'}
                onChange={(e) => setSelectedBillingCycle(e.target.value as 'yearly')}
                className="mr-2"
                disabled={processing}
              />
              Anual
            </label>
          </div>
        </div>

        <button
          onClick={handleUpgradeDowngrade}
          disabled={processing || (selectedPlanId === subscription.plan.id && selectedBillingCycle === subscription.billing_cycle)}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {processing ? 'Processando...' : 'Atualizar Plano'}
        </button>
      </div>

      {/* Ações */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ações</h2>
        
        {subscription.status === 'canceled' || subscription.status === 'expired' ? (
          <button
            onClick={handleReactivate}
            disabled={processing}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-4"
          >
            {processing ? 'Processando...' : 'Reativar Assinatura'}
          </button>
        ) : (
          <>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={processing}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-4"
              >
                Cancelar Assinatura
              </button>
            ) : (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 mb-4">
                  Tem certeza que deseja cancelar sua assinatura? Ela será cancelada ao fim do período atual ({formatDate(subscription.current_period_end)}).
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleCancel}
                    disabled={processing}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processando...' : 'Sim, Cancelar'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={processing}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-400 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => navigate('/plans')}
          className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold text-lg hover:bg-gray-300"
        >
          Ver Todos os Planos
        </button>
      </div>
    </div>
  );
}

export default SubscriptionManagement;

