import { useState, useEffect, ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';

interface LayoutProps { children: ReactNode }

interface UserInfo {
  user?: { id: number; username?: string; name?: string; email: string };
  empresa?: { id: number; nome: string };
  filial?: { id: number; nome: string };
}

type MenuKey = 'cadastros' | 'financeiro' | 'faturamento' | 'estoque' | 'configuracoes';

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState<Record<MenuKey, boolean>>({
    cadastros: false,
    financeiro: false,
    faturamento: false,
    estoque: false,
    configuracoes: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [tenantActive, setTenantActive] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasModuleAccess, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    const tenantStr = localStorage.getItem('tenant');
    if (tenantStr) {
      try {
        const tenant = JSON.parse(tenantStr);
        setTenantActive(tenant.is_active !== false);
        if (tenant.is_active === false &&
          !['/subscription-expired', '/perfil', '/subscription-management'].includes(location.pathname)) {
          navigate('/subscription-expired');
          return;
        }
      } catch {
        setTenantActive(true);
      }
    } else {
      setTenantActive(true);
    }

    if (authService.isAuthenticated()) {
      authService.getCurrentUser().then((data) => {
        setUserInfo({ user: data?.user, empresa: data?.empresa, filial: data?.filial });
      }).catch(() => {});
    }
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const toggleMenu = (menu: MenuKey) => {
    setMenuOpen((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  if (permissionsLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-brand-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  const SidebarLink = ({ to, label, icon }: { to: string; label: string; icon: string }) => (
    <Link
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={isActive(to) ? 'sidebar-item-active' : 'sidebar-item'}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );

  const SubMenu = ({ menuKey, label, icon, children: subChildren }: {
    menuKey: MenuKey; label: string; icon: string; children: ReactNode
  }) => (
    <div>
      <button
        onClick={() => toggleMenu(menuKey)}
        className={`sidebar-item w-full justify-between ${menuOpen[menuKey] ? 'text-slate-900 bg-slate-100' : ''}`}
      >
        <span className="flex items-center gap-3">
          <span className="text-base">{icon}</span>
          <span>{label}</span>
        </span>
        <ChevronIcon open={menuOpen[menuKey]} />
      </button>
      {menuOpen[menuKey] && (
        <div className="ml-9 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
          {subChildren}
        </div>
      )}
    </div>
  );

  const SubLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={`block px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
        isActive(to)
          ? 'text-brand-700 font-semibold bg-brand-50'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  );

  const userDisplayName = userInfo.user?.name || userInfo.user?.username || userInfo.user?.email || 'Usuário';
  const userInitials = userDisplayName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const tenantSlug = localStorage.getItem('tenant_slug') || '';

  const sidebar = (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-none">S</div>
        <div>
          <div className="font-display font-bold text-slate-900 text-sm leading-none">SISCR</div>
          {tenantSlug && <div className="text-xs text-slate-400 mt-0.5">@{tenantSlug}</div>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {tenantActive === false ? (
          <>
            <SidebarLink to="/subscription-expired" label="Assinatura" icon="💳" />
            <SubMenu menuKey="configuracoes" label="Configurações" icon="⚙️">
              <SubLink to="/configuracoes" label="Geral" />
              <SubLink to="/usuarios" label="Usuários" />
              <SubLink to="/subscription-management" label="Assinatura" />
            </SubMenu>
            <SidebarLink to="/perfil" label="Perfil" icon="👤" />
          </>
        ) : (
          <>
            <SidebarLink to="/app" label="Início" icon="🏠" />

            {hasModuleAccess('servico_logistico') && (
              <SidebarLink to="/servico-logistico" label="Serviços Logísticos" icon="🚚" />
            )}

            {hasModuleAccess('cadastros') && (
              <SubMenu menuKey="cadastros" label="Cadastros" icon="📋">
                <SubLink to="/cadastros/pessoas" label="Pessoas" />
                <SubLink to="/cadastros/produtos" label="Produtos" />
                <SubLink to="/cadastros/servicos" label="Serviços" />
              </SubMenu>
            )}

            {hasModuleAccess('financeiro') && (
              <SubMenu menuKey="financeiro" label="Financeiro" icon="💰">
                <SubLink to="/financeiro/contas-receber" label="Contas a Receber" />
                <SubLink to="/financeiro/contas-pagar" label="Contas a Pagar" />
                <SubLink to="/financeiro/dashboard" label="Dashboard" />
              </SubMenu>
            )}

            {hasModuleAccess('faturamento') && (
              <SubMenu menuKey="faturamento" label="Faturamento" icon="🧾">
                <SubLink to="/faturamento/cotacoes" label="Cotações" />
                <SubLink to="/faturamento/nf-venda" label="NF-e Venda" />
                <SubLink to="/faturamento/nfse" label="NFSe" />
              </SubMenu>
            )}

            {hasModuleAccess('estoque') && (
              <SubMenu menuKey="estoque" label="Estoque" icon="📦">
                <SubLink to="/estoque/atual" label="Posição Atual" />
                <SubLink to="/estoque/movimentacoes" label="Movimentações" />
                <SubLink to="/estoque/transferencias" label="Transferências" />
                <SubLink to="/estoque/locais" label="Locais" />
                <SubLink to="/estoque/relatorio" label="Relatório" />
              </SubMenu>
            )}

            {hasModuleAccess('monitoramento') && (
              <SidebarLink to="/monitoramento" label="Monitoramento" icon="📡" />
            )}

            <div className="pt-2 mt-2 border-t border-slate-100">
              {hasModuleAccess('configuracoes') && (
                <SubMenu menuKey="configuracoes" label="Configurações" icon="⚙️">
                  <SubLink to="/configuracoes" label="Geral" />
                  <SubLink to="/usuarios" label="Usuários" />
                  <SubLink to="/configuracoes/roles" label="Roles e Permissões" />
                  <SubLink to="/configuracoes/filiais" label="Filiais" />
                  <SubLink to="/configuracoes/email" label="E-mail" />
                  <SubLink to="/subscription-management" label="Assinatura" />
                </SubMenu>
              )}
              <SidebarLink to="/perfil" label="Perfil" icon="👤" />
            </div>
          </>
        )}
      </nav>

      {/* Usuário logado */}
      <div className="border-t border-slate-100 p-3">
        {userInfo.empresa && (
          <div className="px-3 py-2 mb-2 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 truncate">{userInfo.empresa.nome}</div>
            {userInfo.filial && <div className="text-xs text-slate-400 truncate">{userInfo.filial.nome}</div>}
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-none">
            {userInitials || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{userDisplayName}</div>
            <div className="text-xs text-slate-400 truncate">{userInfo.user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 flex-none">
        {sidebar}
      </div>

      {/* Sidebar mobile — overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 flex flex-col shadow-2xl">{sidebar}</div>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center gap-4 px-4 lg:px-6">
          <button
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb simples */}
          <div className="flex-1 text-sm text-slate-400 capitalize truncate">
            {location.pathname.replace(/^\//, '').replace(/\//g, ' › ') || 'Início'}
          </div>

          {/* Badge tenant */}
          {tenantSlug && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              @{tenantSlug}
            </div>
          )}
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
