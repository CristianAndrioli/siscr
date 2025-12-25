import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { authService } from '../services/auth';
import Layout from '../components/Layout';

interface ModuleInfo {
  code: string;
  name: string;
  icon: JSX.Element;
  route: string;
  description: string;
}

function AppHome() {
  const { hasModuleAccess, permissions, loading } = usePermissions();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const data = await authService.getCurrentUser();
        const name = data.user.first_name && data.user.last_name
          ? `${data.user.first_name} ${data.user.last_name}`
          : data.user.first_name || data.user.username;
        setUserName(name);
      } catch (error) {
        console.error('Erro ao buscar nome do usuário:', error);
        setUserName('');
      }
    };

    if (authService.isAuthenticated()) {
      fetchUserName();
    }
  }, []);

  // Definir módulos disponíveis com seus ícones e rotas
  const allModules: ModuleInfo[] = [
    {
      code: 'cadastros',
      name: 'Cadastros',
      route: '/cadastros/pessoas',
      description: 'Gerenciamento de pessoas, produtos e serviços',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      code: 'financeiro',
      name: 'Financeiro',
      route: '/financeiro/dashboard',
      description: 'Contas a receber, contas a pagar e dashboard financeiro',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 2v4m0 4v1m0-11c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-14v2m0 8v2" />
        </svg>
      ),
    },
    {
      code: 'faturamento',
      name: 'Faturamento',
      route: '/faturamento/cotacoes',
      description: 'Cotações, notas fiscais e documentos fiscais',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      code: 'servico_logistico',
      name: 'Serviço Logístico',
      route: '/servico-logistico',
      description: 'Serviços logísticos e processos aduaneiros',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      code: 'monitoramento',
      name: 'Monitoramento',
      route: '/monitoramento',
      description: 'Monitoramento de processos e atividades',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      code: 'configuracoes',
      name: 'Configurações',
      route: '/configuracoes',
      description: 'Configurações do sistema e gerenciamento',
      icon: (
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  // Filtrar módulos baseado nas permissões do usuário
  const availableModules = loading
    ? []
    : allModules.filter((module) => {
        const hasAccess = hasModuleAccess(module.code);
        console.log(`[AppHome] Módulo ${module.code}: hasAccess=${hasAccess}, permissions=`, permissions);
        return hasAccess;
      });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando módulos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo ao SISCR{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-gray-600">Selecione um módulo para começar</p>
        </div>

        {availableModules.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 mb-2">
              Você não tem acesso a nenhum módulo no momento. Entre em contato com o administrador.
            </p>
            {!loading && permissions && (
              <div className="mt-4 text-left bg-white p-4 rounded border text-xs">
                <p className="font-semibold mb-2">Debug Info:</p>
                <p>Role: {permissions.role}</p>
                <p>Módulos disponíveis no backend: {Object.keys(permissions.modules).join(', ') || 'Nenhum'}</p>
                <p>Total de módulos no sistema: {allModules.length}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold">Detalhes das permissões</summary>
                  <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(permissions, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableModules.map((module) => (
              <Link
                key={module.code}
                to={module.route}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 border border-gray-200 hover:border-indigo-500 group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="text-indigo-600 group-hover:text-indigo-700 mb-4 transition-colors">
                    {module.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AppHome;

