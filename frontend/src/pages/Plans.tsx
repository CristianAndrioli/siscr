import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicService, type Plan } from '../services/public';

function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const data = await publicService.getPlans();
        setPlans(data);
      } catch (err) {
        setError('Erro ao carregar planos. Tente novamente.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const formatPrice = (price: string) => {
    return parseFloat(price).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Carregando planos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
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
            <div className="flex gap-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-indigo-600 font-medium"
              >
                Entrar
              </Link>
              <Link
                to="/signup"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
              >
                Criar Conta
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Plans Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Escolha o Plano Ideal
          </h1>
          <p className="text-xl text-gray-600">
            Planos flexíveis para empresas de todos os tamanhos
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg p-8 ${
                plan.is_trial ? 'border-2 border-indigo-500' : ''
              }`}
            >
              {plan.is_trial && (
                <div className="bg-indigo-500 text-white text-center py-2 rounded-t-lg -mt-8 -mx-8 mb-4">
                  <span className="font-semibold">Plano de Teste</span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-gray-600 mb-6">{plan.description}</p>

              <div className="mb-6">
                <div className="text-4xl font-bold text-indigo-600">
                  {plan.is_trial ? 'Grátis' : formatPrice(plan.price_monthly)}
                </div>
                {!plan.is_trial && (
                  <div className="text-gray-500 text-sm">
                    /mês ou {formatPrice(plan.price_yearly || '0')}/ano
                  </div>
                )}
                {plan.is_trial && (
                  <div className="text-gray-500 text-sm">
                    por {plan.trial_days} dias
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
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

              <Link
                to={`/signup?plan=${plan.id}`}
                className={`block w-full text-center py-3 rounded-lg font-semibold ${
                  plan.is_trial
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {plan.is_trial ? 'Começar Teste Grátis' : 'Escolher Plano'}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Plans;


