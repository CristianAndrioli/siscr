import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { paymentsService } from '../services/payments';
import { publicService, type Plan } from '../services/public';
import { authService } from '../services/auth';

function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planIdParam = searchParams.get('plan_id');
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar se usuário está autenticado
    setIsAuthenticated(authService.isAuthenticated());

    // Carregar plano se plan_id foi fornecido
    if (planIdParam) {
      loadPlan(parseInt(planIdParam));
    }
  }, [planIdParam]);

  const loadPlan = async (planId: number) => {
    try {
      const plans = await publicService.getPlans();
      const foundPlan = plans.find((p) => p.id === planId);
      if (foundPlan) {
        setPlan(foundPlan);
      } else {
        setError('Plano não encontrado');
      }
    } catch (err) {
      setError('Erro ao carregar plano');
      console.error(err);
    }
  };

  const handleCheckout = async () => {
    if (!plan) {
      setError('Selecione um plano');
      return;
    }

    // Se não estiver autenticado, redirecionar para login
    if (!isAuthenticated) {
      navigate(`/login?redirect=/checkout?plan_id=${plan.id}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { checkout_url } = await paymentsService.createCheckoutSession(
        plan.id,
        billingCycle
      );
      
      // Redirecionar para checkout do Stripe
      window.location.href = checkout_url;
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Erro ao criar sessão de checkout. Tente novamente.'
      );
      setLoading(false);
    }
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getPrice = () => {
    if (!plan) return '0';
    if (billingCycle === 'yearly' && plan.price_yearly) {
      return plan.price_yearly;
    }
    return plan.price_monthly;
  };

  if (!plan && !planIdParam) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Selecione um Plano
          </h2>
          <p className="text-gray-600 mb-6">
            Você precisa selecionar um plano antes de fazer o checkout.
          </p>
          <Link
            to="/plans"
            className="block w-full text-center bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
          >
            Ver Planos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-2xl font-bold text-indigo-600">
              SISCR
            </Link>
            <Link
              to="/plans"
              className="text-gray-700 hover:text-indigo-600 font-medium"
            >
              ← Voltar para Planos
            </Link>
          </div>
        </div>
      </header>

      {/* Checkout Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Finalizar Assinatura
          </h1>

          {plan && (
            <>
              {/* Plano Selecionado */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {plan.name}
                </h2>
                <p className="text-gray-600 mb-4">{plan.description}</p>

                {/* Seleção de Ciclo de Cobrança */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciclo de Cobrança
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        billingCycle === 'monthly'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Mensal
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        billingCycle === 'yearly'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Anual
                      {plan.price_yearly && (
                        <span className="ml-2 text-xs">
                          (Economize{' '}
                          {(
                            (parseFloat(plan.price_monthly) * 12 -
                              parseFloat(plan.price_yearly)) /
                            (parseFloat(plan.price_monthly) * 12)
                          ).toLocaleString('pt-BR', {
                            style: 'percent',
                            minimumFractionDigits: 0,
                          })}
                          )
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Preço */}
                <div className="text-3xl font-bold text-indigo-600 mb-4">
                  {plan.is_trial ? 'Grátis' : formatPrice(getPrice())}
                  {!plan.is_trial && (
                    <span className="text-lg text-gray-500 font-normal">
                      {' '}
                      / {billingCycle === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-700">
                      Até {plan.max_users} usuário{plan.max_users > 1 ? 's' : ''}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-700">
                      {plan.max_empresas} empresa{plan.max_empresas > 1 ? 's' : ''}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-700">
                      {plan.max_filiais} filial{plan.max_filiais > 1 ? 'is' : ''}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-700">
                      {plan.max_storage_gb} GB de armazenamento
                    </span>
                  </li>
                </ul>
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                  {error}
                </div>
              )}

              {/* Botão de Checkout */}
              {!isAuthenticated ? (
                <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
                  <p className="mb-2">
                    Você precisa estar logado para fazer o checkout.
                  </p>
                  <Link
                    to={`/login?redirect=/checkout?plan_id=${plan.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
                  >
                    Fazer Login
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processando...' : 'Prosseguir para Pagamento'}
                </button>
              )}

              {/* Informação de Segurança */}
              <p className="text-sm text-gray-500 text-center mt-6">
                🔒 Pagamento seguro processado pelo Stripe
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Checkout;

