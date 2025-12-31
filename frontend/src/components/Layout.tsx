import { useState, useEffect, ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';

interface LayoutProps {
  children: ReactNode;
}

interface UserInfo {
  user?: {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  empresa?: { id: number; nome: string };
  filial?: { id: number; nome: string };
}

function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState({
    cadastros: false,
    financeiro: false,
    faturamento: false,
    estoque: false,
    configuracoes: false,
  });
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [tenantActive, setTenantActive] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasModuleAccess, hasPermission, loading: permissionsLoading, permissions } = usePermissions();
  
  // Log para debug
  useEffect(() => {
    if (permissions) {
      console.log('[Layout] Permissões carregadas:', permissions);
      console.log('[Layout] hasModuleAccess("cadastros"):', hasModuleAccess('cadastros'));
      console.log('[Layout] hasModuleAccess("financeiro"):', hasModuleAccess('financeiro'));
      console.log('[Layout] hasModuleAccess("faturamento"):', hasModuleAccess('faturamento'));
      console.log('[Layout] hasModuleAccess("monitoramento"):', hasModuleAccess('monitoramento'));
      console.log('[Layout] hasModuleAccess("configuracoes"):', hasModuleAccess('configuracoes'));
    }
  }, [permissions, hasModuleAccess]);

  useEffect(() => {
    // Verificar se o tenant está ativo
    const tenantStr = localStorage.getItem('tenant');
    if (tenantStr) {
      try {
        const tenant = JSON.parse(tenantStr);
        setTenantActive(tenant.is_active !== false);
        
        // Se tenant estiver desativado e não estiver na rota de subscription-expired, profile ou subscription-management, redirecionar
        if (tenant.is_active === false && 
            location.pathname !== '/subscription-expired' && 
            location.pathname !== '/profile' &&
            location.pathname !== '/perfil' &&
            location.pathname !== '/subscription-management') {
          navigate('/subscription-expired');
          return;
        }
      } catch (e) {
        // Ignorar erro de parsing
        setTenantActive(true);
      }
    } else {
      setTenantActive(true);
    }

    // Buscar informações do usuário ao montar o componente
    const fetchUserInfo = async () => {
      try {
        console.log('[Layout] Buscando informações do usuário...');
        const data = await authService.getCurrentUser();
        console.log('[Layout] Dados recebidos:', data);
        setUserInfo({
          user: data.user,
          empresa: data.empresa,
          filial: data.filial,
        });
        console.log('[Layout] UserInfo atualizado:', { user: data.user, empresa: data.empresa, filial: data.filial });
      } catch (error) {
        console.error('[Layout] Erro ao buscar informações do usuário:', error);
      }
    };

    if (authService.isAuthenticated()) {
      fetchUserInfo();
    }
  }, [navigate, location.pathname]);

  const handleLogout = (): void => {
    authService.logout();
    navigate('/login');
  };

  const toggleMenu = (menu: keyof typeof menuOpen): void => {
    setMenuOpen((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const isActive = (path: string): boolean => {
    if (location.pathname === path) return true;
    // Para rotas filhas (ex: /cadastros/pessoas/1 deve ativar /cadastros/pessoas)
    if (location.pathname.startsWith(path + '/')) return true;
    return false;
  };

  // Aguardar carregamento das permissões antes de renderizar o menu
  if (permissionsLoading) {
    return (
      <div className="flex min-h-screen bg-gray-300 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-300">
      {/* Sidebar - Replica o design do base.html */}
      <aside className="w-64 bg-gray-800 text-white shadow-xl flex flex-col rounded-r-2xl">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-center">SISCR</h2>
        </div>
        
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {/* Se tenant estiver desativado, mostrar apenas Perfil e Assinatura */}
            {tenantActive === false ? (
              <>
                <li>
                  <Link
                    to="/subscription-expired"
                    className={`flex items-center p-2 rounded-lg transition duration-150 ${
                      isActive('/subscription-expired') ? 'bg-gray-700' : 'hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Assinatura
                  </Link>
                </li>
                {/* Configurações - Menu com submenu */}
                <li>
                  <button
                    onClick={() => toggleMenu('configuracoes')}
                    className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
                  >
                    <span className="flex items-center">
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configurações
                    </span>
                    <svg
                      className={`w-4 h-4 transform transition-transform duration-300 ${
                        menuOpen.configuracoes ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuOpen.configuracoes && (
                    <ul className="pl-6 mt-2 space-y-1">
                      <li>
                        <Link
                          to="/configuracoes"
                          className={`block p-2 rounded-lg transition duration-150 text-sm ${
                            isActive('/configuracoes') ? 'bg-gray-700' : 'hover:bg-gray-700'
                          }`}
                        >
                          Configurações Gerais
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/usuarios"
                          className={`block p-2 rounded-lg transition duration-150 text-sm ${
                            isActive('/usuarios') ? 'bg-gray-700' : 'hover:bg-gray-700'
                          }`}
                        >
                          Usuários
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/configuracoes/roles"
                          className={`block p-2 rounded-lg transition duration-150 text-sm ${
                            isActive('/configuracoes/roles') ? 'bg-gray-700' : 'hover:bg-gray-700'
                          }`}
                        >
                          Roles e Permissões
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/subscription-management"
                          className={`block p-2 rounded-lg transition duration-150 text-sm ${
                            isActive('/subscription-management') ? 'bg-gray-700' : 'hover:bg-gray-700'
                          }`}
                        >
                          Assinatura
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>
                <li>
                  <Link
                    to="/profile"
                    className={`flex items-center p-2 rounded-lg transition duration-150 ${
                      isActive('/profile') ? 'bg-gray-700' : 'hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Perfil
                  </Link>
                </li>
              </>
            ) : (
              <>
                {/* Home */}
                <li>
                  <Link
                    to="/app"
                    className={`flex items-center p-2 rounded-lg transition duration-150 ${
                      isActive('/app') ? 'bg-gray-700' : 'hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-10l-2-2m2 2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Home
                  </Link>
                </li>

            {/* Serviços Logísticos */}
            {hasModuleAccess('servico_logistico') && (
              <li>
                <Link
                  to="/servico-logistico"
                  className={`flex items-center p-2 rounded-lg transition duration-150 ${
                    isActive('/servico-logistico') ? 'bg-gray-700' : 'hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h.01M19 21H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
                  </svg>
                  Serviços Logísticos
                </Link>
              </li>
            )}

            {/* Cadastros - Menu com submenu */}
            {hasModuleAccess('cadastros') && (
            <li>
              <button
                onClick={() => toggleMenu('cadastros')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Cadastros
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.cadastros ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.cadastros && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/cadastros/pessoas"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/pessoas') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Pessoas
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastros/produtos"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/produtos') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Produtos
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastros/servicos"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/servicos') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Serviços
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Financeiro - Menu com submenu */}
            {hasModuleAccess('financeiro') && (
            <li>
              <button
                onClick={() => toggleMenu('financeiro')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 2v4m0 4v1m0-11c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-14v2m0 8v2" />
                  </svg>
                  Financeiro
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.financeiro ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.financeiro && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/financeiro/dashboard"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/financeiro/dashboard') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/financeiro/contas-receber"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/financeiro/contas-receber') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Contas a Receber
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/financeiro/contas-pagar"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/financeiro/contas-pagar') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Contas a Pagar
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Faturamento - Menu com submenu */}
            {hasModuleAccess('faturamento') && (
            <li>
              <button
                onClick={() => toggleMenu('faturamento')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Faturamento
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.faturamento ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.faturamento && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/faturamento/cotacoes"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Cotações/Análise Frete
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faturamento/nf-venda"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      NF Venda
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faturamento/nfse"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      NFSe
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faturamento/cotacao-cambio"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Cotação de Câmbio
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Estoque - Menu com submenu */}
            {hasModuleAccess('estoque') && (
            <li>
              <button
                onClick={() => toggleMenu('estoque')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Estoque
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.estoque ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.estoque && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/estoque/locations"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/estoque/locations') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Locations
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/estoque/estoque-atual"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/estoque/estoque-atual') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Estoque Atual
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/estoque/movimentacoes"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/estoque/movimentacoes') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Movimentações
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/estoque/transferencias"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/estoque/transferencias') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Transferências
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            )}

            {/* Monitoramento */}
            {hasModuleAccess('monitoramento') && (
              <li>
                <Link
                  to="/monitoramento"
                  className={`flex items-center p-2 rounded-lg transition duration-150 ${
                    isActive('/monitoramento') ? 'bg-gray-700' : 'hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Monitoramento
                </Link>
              </li>
            )}

            {/* Configurações - Menu com submenu */}
            {hasModuleAccess('configuracoes') && (
            <li>
              <button
                onClick={() => toggleMenu('configuracoes')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configurações
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.configuracoes ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.configuracoes && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/configuracoes"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/configuracoes') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Configurações Gerais
                    </Link>
                  </li>
                  {hasPermission('manage_users') && (
                    <li>
                      <Link
                        to="/usuarios"
                        className={`block p-2 rounded-lg transition duration-150 text-sm ${
                          isActive('/usuarios') ? 'bg-gray-700' : 'hover:bg-gray-700'
                        }`}
                      >
                        Usuários
                      </Link>
                    </li>
                  )}
                  {hasPermission('manage_roles') && (
                    <li>
                      <Link
                        to="/configuracoes/roles"
                        className={`block p-2 rounded-lg transition duration-150 text-sm ${
                          isActive('/configuracoes/roles') ? 'bg-gray-700' : 'hover:bg-gray-700'
                        }`}
                      >
                        Roles e Permissões
                      </Link>
                    </li>
                  )}
                  {hasPermission('manage_subscriptions') && (
                    <li>
                      <Link
                        to="/subscription-management"
                        className={`block p-2 rounded-lg transition duration-150 text-sm ${
                          isActive('/subscription-management') ? 'bg-gray-700' : 'hover:bg-gray-700'
                        }`}
                      >
                        Assinatura
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
            )}
            {/* Perfil */}
            <li>
              <Link
                to="/profile"
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  isActive('/profile') ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Meu Perfil
              </Link>
            </li>
              </>
            )}
          </ul>
        </nav>

        {/* Informações do Usuário, Empresa e Filial - Acima do botão de sair */}
        {(userInfo.user || userInfo.empresa || userInfo.filial) && (
          <div className="px-4 py-3 border-t border-gray-700 bg-gray-800">
            {userInfo.user && (
              <div className="mb-3">
                <div className="text-xs text-gray-400 font-medium mb-1">Usuário</div>
                <div className="text-sm text-white font-semibold truncate" title={
                  userInfo.user.first_name && userInfo.user.last_name
                    ? `${userInfo.user.first_name} ${userInfo.user.last_name}`
                    : userInfo.user.username
                }>
                  {userInfo.user.first_name && userInfo.user.last_name
                    ? `${userInfo.user.first_name} ${userInfo.user.last_name}`
                    : userInfo.user.first_name || userInfo.user.username}
                </div>
              </div>
            )}
            {userInfo.empresa && (
              <div className="mb-2">
                <div className="text-xs text-gray-400 font-medium mb-1">Empresa</div>
                <div className="text-sm text-white font-semibold truncate" title={userInfo.empresa.nome}>
                  {userInfo.empresa.nome}
                </div>
              </div>
            )}
            {userInfo.filial && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Filial</div>
                <div className="text-sm text-white font-semibold truncate" title={userInfo.filial.nome}>
                  {userInfo.filial.nome}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão de Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center p-2 rounded-lg bg-red-700 text-white hover:bg-red-600 transition duration-150 justify-center w-full"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}

export default Layout;

