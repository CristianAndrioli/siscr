import { useState, useEffect, ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../hooks/useTheme';
import OnboardingEmpresaGate from './OnboardingEmpresaGate';
import WhatsAppSupportButton from './WhatsAppSupportButton';
import CommandPalette from './commandPalette/CommandPalette';

interface LayoutProps { children: ReactNode }
type MenuKey = 'cadastros' | 'financeiro' | 'faturamento' | 'entrada' | 'estoque' | 'configuracoes';

// ─── Ícones SVG inline ────────────────────────────────────────────
const icons = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
  users: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  money: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />,
  invoice: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />,
  truck: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
  box: <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  gear: <><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  person: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
  chevron: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />,
  logout: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />,
  menu: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />,
  sun: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />,
  moon: <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />,
};

function Icon({ d, className = 'w-4 h-4' }: { d: ReactNode; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      {d}
    </svg>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState<Record<MenuKey, boolean>>({
    cadastros: false, financeiro: false, faturamento: false, entrada: false, estoque: false, configuracoes: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasModuleAccess } = usePermissions();
  const { isDark, toggleTheme } = useTheme();
  const [permAlert, setPermAlert] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')
    ? '⌘'
    : 'Ctrl';

  useEffect(() => {
    const fn = (e: Event) => {
      const d = (e as CustomEvent<{ message?: string }>).detail;
      setPermAlert(d?.message || 'Sem permissão para esta ação.');
      window.setTimeout(() => setPermAlert(null), 6000);
    };
    window.addEventListener('siscr:forbidden', fn);
    return () => window.removeEventListener('siscr:forbidden', fn);
  }, []);

  const userName = localStorage.getItem('user_nome') || 'Usuário';
  const tenantSlug = localStorage.getItem('tenant_slug') || '';
  const userInitials = userName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U';

  useEffect(() => {
    const status = localStorage.getItem('tenant_status');
    if (status && status !== 'active') {
      const exempt = ['/subscription-expired', '/perfil', '/subscription-management'];
      if (!exempt.some(p => location.pathname.startsWith(p))) {
        navigate('/subscription-expired');
      }
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname.startsWith('/entrada')) {
      setMenuOpen((prev) => ({ ...prev, entrada: true }));
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const toggleMenu = (menu: MenuKey) =>
    setMenuOpen(prev => ({ ...prev, [menu]: !prev[menu] }));

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const SidebarLink = ({ to, label, iconD }: { to: string; label: string; iconD: ReactNode }) => (
    <Link
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive(to)
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span className={`flex-none ${isActive(to) ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`}>
        <Icon d={iconD} />
      </span>
      <span>{label}</span>
    </Link>
  );

  const SubMenu = ({ menuKey, label, iconD, children: sub }: {
    menuKey: MenuKey; label: string; iconD: ReactNode; children: ReactNode
  }) => (
    <div>
      <button
        onClick={() => toggleMenu(menuKey)}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          menuOpen[menuKey]
            ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="flex-none text-slate-400 dark:text-slate-500"><Icon d={iconD} /></span>
          <span>{label}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${menuOpen[menuKey] ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          {icons.chevron}
        </svg>
      </button>
      {menuOpen[menuKey] && (
        <div className="ml-7 mt-0.5 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-0.5">
          {sub}
        </div>
      )}
    </div>
  );

  const SubLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={`block px-3 py-1.5 rounded-md text-sm transition-all duration-150 ${
        isActive(to)
          ? 'text-brand-700 dark:text-brand-300 font-semibold bg-brand-50 dark:bg-brand-950'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </Link>
  );

  const sidebar = (
    <aside className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-100 dark:border-slate-800 flex-none">
        <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-xs flex-none">S</div>
        <div className="min-w-0">
          <div className="font-display font-bold text-slate-900 dark:text-white text-sm leading-none">SISCR</div>
          {tenantSlug && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">@{tenantSlug}</div>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <SidebarLink to="/app" label="Início" iconD={icons.home} />

        {hasModuleAccess('faturamento') && (
          <SubMenu menuKey="entrada" label="Entrada" iconD={icons.truck}>
            <SubLink to="/entrada/nf-e/nova" label="NF-e de entrada" />
            <SubLink to="/entrada/notas" label="Notas importadas" />
          </SubMenu>
        )}

        {hasModuleAccess('cadastros') && (
          <SubMenu menuKey="cadastros" label="Cadastros" iconD={icons.users}>
            <SubLink to="/cadastros/pessoas" label="Pessoas" />
            <SubLink to="/cadastros/produtos" label="Produtos" />
            <SubLink to="/cadastros/servicos" label="Serviços" />
          </SubMenu>
        )}

        {hasModuleAccess('financeiro') && (
          <SubMenu menuKey="financeiro" label="Financeiro" iconD={icons.money}>
            <SubLink to="/financeiro/contas-receber" label="Contas a Receber" />
            <SubLink to="/financeiro/contas-pagar" label="Contas a Pagar" />
            <SubLink to="/financeiro/contas-bancarias" label="Contas Bancárias" />
            <SubLink to="/financeiro/dashboard" label="Dashboard" />
          </SubMenu>
        )}

        {hasModuleAccess('faturamento') && (
          <SubMenu menuKey="faturamento" label="Faturamento" iconD={icons.invoice}>
            <SubLink to="/faturamento/cotacoes" label="Cotações" />
            <SubLink to="/faturamento/nf-venda" label="NF-e Venda" />
            <SubLink to="/configuracoes/faturamento" label="Configuração NF-e" />
            <SubLink to="/faturamento/ncm" label="Tabela NCM" />
            <SubLink to="/faturamento/nfse" label="NFSe" />
          </SubMenu>
        )}

        {hasModuleAccess('estoque') && (
          <SubMenu menuKey="estoque" label="Estoque" iconD={icons.box}>
            <SubLink to="/estoque/posicao" label="Posição Atual" />
            <SubLink to="/estoque/movimentacoes" label="Movimentações" />
            <SubLink to="/estoque/transferencias" label="Transferências" />
            <SubLink to="/estoque/locais" label="Locais" />
            <SubLink to="/estoque/instrucoes" label="Instruções" />
          </SubMenu>
        )}

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
          {hasModuleAccess('configuracoes') && (
            <SubMenu menuKey="configuracoes" label="Configurações" iconD={icons.gear}>
              <SubLink to="/configuracoes" label="Visão Geral" />
              <SubLink to="/configuracoes/usuarios" label="Usuários" />
              <SubLink to="/configuracoes/permissoes" label="Permissões" />
              <SubLink to="/configuracoes/filiais" label="Empresas e Filiais" />
              <SubLink to="/configuracoes/faturamento" label="Faturamento (NF-e)" />
              <SubLink to="/subscription-management" label="Assinatura" />
              <SubLink to="/configuracoes/logs" label="Log de Erros" />
            </SubMenu>
          )}
          <SidebarLink to="/perfil" label="Perfil" iconD={icons.person} />
        </div>
      </nav>

      {/* Footer da sidebar — usuário + tema */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex-none space-y-1">
        {/* Toggle de tema */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          <span className="font-medium">{isDark ? 'Modo Escuro' : 'Modo Claro'}</span>
          <span className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            <Icon d={isDark ? icons.sun : icons.moon} className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Usuário */}
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-none">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{userName}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{tenantSlug && `@${tenantSlug}`}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
          >
            <Icon d={icons.logout} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200">
      <OnboardingEmpresaGate />
      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-60 flex-none">
        {sidebar}
      </div>

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-60 flex flex-col shadow-2xl">{sidebar}</div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 lg:px-6 transition-colors duration-200">
          <button
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon d={icons.menu} className="w-5 h-5" />
          </button>

          <div className="flex-1 text-sm text-slate-400 dark:text-slate-500 capitalize truncate min-w-0">
            {location.pathname.replace(/^\//, '').replace(/\//g, ' › ') || 'Início'}
          </div>

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors flex-none"
            title="Busca universal"
          >
            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden md:inline">Buscar</span>
            <kbd className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600">
              {modKey}K
            </kbd>
          </button>

          {/* Toggle de tema (topbar mobile) */}
          <button
            onClick={toggleTheme}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon d={isDark ? icons.sun : icons.moon} className="w-4 h-4" />
          </button>

          {tenantSlug && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950 border border-brand-100 dark:border-brand-900 text-brand-700 dark:text-brand-300 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-none" />
              @{tenantSlug}
            </div>
          )}
        </header>

        {permAlert && (
          <div
            role="alert"
            className="mx-4 mt-3 lg:mx-6 lg:mt-4 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-sm font-medium shadow-sm"
          >
            {permAlert}
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>

      <WhatsAppSupportButton />

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
