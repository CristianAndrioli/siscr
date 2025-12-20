import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { publicService, type Plan, type SignupData } from '../services/public';

function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);

  // Form data
  const [formData, setFormData] = useState<SignupData>({
    tenant_name: '',
    domain: '',
    plan_id: parseInt(searchParams.get('plan') || '0') || 0,
    admin_username: '',
    admin_email: '',
    admin_password: '',
    admin_first_name: '',
    admin_last_name: '',
    empresa_nome: '',
    empresa_cnpj: '',
    empresa_razao_social: '',
  });

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const data = await publicService.getPlans();
        setPlans(data);
        if (!formData.plan_id && data.length > 0) {
          setFormData((prev) => ({ ...prev, plan_id: data[0].id }));
        }
      } catch (err) {
        setError('Erro ao carregar planos.');
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, []);

  const handleDomainCheck = async () => {
    if (!formData.domain) return;

    setCheckingDomain(true);
    try {
      const result = await publicService.checkDomain(formData.domain);
      setDomainAvailable(result.available);
      if (!result.available) {
        setError(result.message || 'Domínio já está em uso');
      } else {
        setError('');
      }
    } catch (err) {
      setDomainAvailable(false);
      setError('Erro ao verificar domínio');
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await publicService.signup(formData);
      
      // Verificar se o plano é trial
      const isTrial = result.subscription?.is_trial || false;
      
      // Se não for trial, fazer login automático e redirecionar para checkout
      if (!isTrial) {
        try {
          // Fazer login automático
          const { authService } = await import('../services/auth');
          await authService.login(formData.admin_username, formData.admin_password, result.tenant.domain);
          
          // Redirecionar para checkout
          navigate(`/checkout?plan_id=${result.subscription.plan_id}`);
          return;
        } catch (loginErr) {
          // Se login automático falhar, redirecionar para login manual
          console.error('Erro no login automático:', loginErr);
          navigate(`/login?domain=${result.tenant.domain}&redirect=/checkout?plan_id=${result.subscription.plan_id}`);
          return;
        }
      }
      
      // Se for trial, mostrar sucesso e redirecionar para login
      setSuccess(true);
      setTimeout(() => {
        navigate(`/login?domain=${result.tenant.domain}`);
      }, 2000);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Erro ao criar conta. Tente novamente.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Conta Criada com Sucesso!
          </h2>
          <p className="text-gray-600 mb-6">
            Redirecionando para a página de login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-indigo-600">
            SISCR
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Criar Nova Conta
          </h1>
          <p className="text-gray-600 mt-2">
            Preencha os dados abaixo para criar sua conta
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg space-y-6">
          {/* Plano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano *
            </label>
            {loadingPlans ? (
              <div className="text-gray-500">Carregando planos...</div>
            ) : (
              <select
                name="plan_id"
                id="plan_id"
                value={formData.plan_id}
                onChange={(e) =>
                  setFormData({ ...formData, plan_id: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Selecione um plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - {plan.is_trial ? 'Grátis' : `R$ ${plan.price_monthly}/mês`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dados do Tenant */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dados da Empresa
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  name="tenant_name"
                  id="tenant_name"
                  value={formData.tenant_name}
                  onChange={(e) =>
                    setFormData({ ...formData, tenant_name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nome da sua empresa"
                  autoComplete="organization"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domínio/Subdomínio *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="domain"
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => {
                      const domain = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setFormData({ ...formData, domain });
                      setDomainAvailable(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="minha-empresa"
                    autoComplete="username"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleDomainCheck}
                    disabled={checkingDomain || !formData.domain}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    {checkingDomain ? 'Verificando...' : 'Verificar'}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Seu acesso será: {formData.domain || 'seu-dominio'}.localhost
                </p>
                {domainAvailable === true && (
                  <p className="text-sm text-green-600 mt-1">✓ Domínio disponível</p>
                )}
                {domainAvailable === false && (
                  <p className="text-sm text-red-600 mt-1">✗ Domínio já está em uso</p>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Usuário Admin */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dados do Administrador
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  name="admin_username"
                  id="admin_username"
                  value={formData.admin_username}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_username: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="usuario123"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="admin_email"
                  id="admin_email"
                  value={formData.admin_email}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  name="admin_password"
                  id="admin_password"
                  value={formData.admin_password}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_password: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Mínimo de 8 caracteres
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  name="admin_first_name"
                  id="admin_first_name"
                  value={formData.admin_first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_first_name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="João"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sobrenome
                </label>
                <input
                  type="text"
                  name="admin_last_name"
                  id="admin_last_name"
                  value={formData.admin_last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_last_name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Silva"
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>

          {/* Dados da Empresa */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dados da Primeira Empresa
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  name="empresa_nome"
                  id="empresa_nome"
                  value={formData.empresa_nome}
                  onChange={(e) =>
                    setFormData({ ...formData, empresa_nome: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nome da Empresa"
                  autoComplete="organization"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ
                </label>
                <input
                  type="text"
                  name="empresa_cnpj"
                  id="empresa_cnpj"
                  value={formData.empresa_cnpj}
                  onChange={(e) =>
                    setFormData({ ...formData, empresa_cnpj: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="12.345.678/0001-90"
                  autoComplete="off"
                  pattern="[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razão Social
                </label>
                <input
                  type="text"
                  name="empresa_razao_social"
                  id="empresa_razao_social"
                  value={formData.empresa_razao_social}
                  onChange={(e) =>
                    setFormData({ ...formData, empresa_razao_social: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Razão Social da Empresa"
                  autoComplete="organization"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="border-t pt-6">
            <button
              type="submit"
              disabled={loading || domainAvailable === false}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
            <p className="text-center text-sm text-gray-600 mt-4">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-indigo-600 hover:underline">
                Fazer login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Signup;


