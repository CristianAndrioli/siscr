import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/auth';

function Login() {
  const [searchParams] = useSearchParams();
  // Tentar obter domain dos searchParams, localStorage (tenant salvo) ou deixar vazio
  const domainFromParams = searchParams.get('domain') || '';
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const tenantFromStorage = localStorage.getItem('tenant');
  let domainFromStorage = '';
  if (tenantFromStorage) {
    try {
      const tenant = JSON.parse(tenantFromStorage);
      // Tentar obter o domain do tenant salvo (pode ter domain ou schema_name)
      domainFromStorage = tenant.domain || `${tenant.schema_name}.localhost` || '';
    } catch (e) {
      // Ignorar erro de parsing
    }
  }
  const domain = domainFromParams || domainFromStorage;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(username, password, domain);
      navigate(redirectTo);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string; detail?: string } } };
      setError(axiosError.response?.data?.error || axiosError.response?.data?.detail || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">SISCR</h1>
          <p className="text-gray-600 mt-2">Sistema de Gestão Empresarial</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Digite seu usuário"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Digite sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Esqueci minha senha
          </Link>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Credenciais padrão:</p>
          <p className="font-mono">admin / admin123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;

