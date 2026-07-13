import { useState, useEffect, ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../hooks/useTheme';
import { useUserPreferences } from '../hooks/useUserPreferences';
import OnboardingEmpresaGate from './OnboardingEmpresaGate';
import WhatsAppSupportButton from './WhatsAppSupportButton';
import CommandPalette from './commandPalette/CommandPalette';
import { icons, Icon } from './icons';
import { SIDEBAR_SECTIONS, type SidebarNavItem } from '../config/hubConfig';

interface LayoutProps { children: ReactNode }

// ─── Mapa de rotas → labels legíveis (breadcrumb) ─────────────────
const ROUTE_LABELS: Record<string, string> = {
  app: 'Início',
  relatorios: 'Relatórios',
  'vendas-crm': 'Vendas & CRM',
  pedidos: 'Pedidos',
  novo: 'Novo',
  metas: 'Metas de Vendas',
  interacoes: 'Histórico de Interações',
  compras: 'Compras',
  cadastros: 'Cadastros',
  clientes: 'Clientes',
  fornecedores: 'Fornecedores',
  vendedores: 'Vendedores',
  transportadoras: 'Transportadoras',
  funcionarios: 'Funcionários / Operadores',
  pessoas: 'Pessoas',
  produtos: 'Produtos',
  servicos: 'Serviços',
  'grupos-produtos': 'Grupos de Produtos',
  'unidades-medida': 'Unidades de Medida',
  'tabelas-preco': 'Tabelas de Preço',
  'categorias-financeiras': 'Categorias Financeiras',
  'centros-custo': 'Centros de Custo',
  'condicoes-pagamento': 'Condições de Pagamento',
  financeiro: 'Financeiro',
  'contas-receber': 'Contas a Receber',
  'contas-pagar': 'Contas a Pagar',
  'contas-bancarias': 'Contas Bancárias',
  conciliacao: 'Conciliação Bancária',
  'fluxo-caixa': 'Fluxo de Caixa',
  'regua-cobranca': 'Régua de Cobrança',
  dashboard: 'Dashboard',
  faturamento: 'Faturamento',
  cotacoes: 'Cotações',
  'nf-venda': 'NF-e Venda',
  ncm: 'Tabela NCM',
  nfse: 'NFSe',
  entrada: 'Entrada',
  notas: 'Notas Importadas',
  dfe: 'Distribuição DFe',
  nova: 'Nova',
  'nf-e': 'NF-e',
  estoque: 'Estoque',
  posicao: 'Posição Atual',
  movimentacoes: 'Movimentações',
  transferencias: 'Transferências',
  locais: 'Locais',
  instrucoes: 'Instruções',
  frota: 'Frota & OS',
  'ordens-servico': 'Ordens de Serviço',
  maquinas: 'Máquinas',
  obras: 'Obras / Projetos',
  contabilidade: 'Contabilidade',
  'plano-contas': 'Plano de Contas',
  lancamentos: 'Lançamentos',
  balancete: 'Balancete',
  dre: 'DRE',
  exportacoes: 'Exportações',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
  permissoes: 'Permissões',
  filiais: 'Empresas e Filiais',
  conexoes: 'Conexões',
  logs: 'Log de Erros',
  'subscription-management': 'Assinatura',
  perfil: 'Perfil',
  personalizacao: 'Personalização',
};

function buildBreadcrumb(pathname: string): string {
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (segments.length === 0) return 'Início';
  return segments.map(s => ROUTE_LABELS[s] ?? s).join(' › ');
}

const BADGE_CLS: Record<'NOVO' | 'DEV', string> = {
  NOVO: 'bg-[rgb(var(--tint-rgb)/0.9)] text-white',
  DEV: 'bg-[#3a3323] text-[#e8a33d]',
};

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasModuleAccess } = usePermissions();
  const { isDark, toggleTheme } = useTheme();
  const { prefs, updatePrefs } = useUserPreferences();

  const handleToggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    toggleTheme();
    updatePrefs({ theme: next });
  };
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

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const visibleSections = SIDEBAR_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.permissionKey || hasModuleAccess(item.permissionKey)),
    }))
    .filter(section => section.items.length > 0);

  const iconsOnly = prefs.sidebarMode === 'icons';

  const NavLink = ({ item }: { item: SidebarNavItem }) => {
    const active = isActive(item.to);
    if (iconsOnly) {
      return (
        <Link
          to={item.to}
          title={item.label}
          onClick={() => setSidebarOpen(false)}
          className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            active
              ? 'bg-[rgb(var(--tint-rgb)/0.12)] dark:bg-[rgb(var(--tint-rgb)/0.16)] text-brand-700 dark:text-[var(--acc-light)]'
              : 'text-slate-500 dark:text-sidebar-text hover:bg-slate-100 dark:hover:bg-sidebar-hover hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Icon d={icons[item.icon]} className="w-4 h-4" />
        </Link>
      );
    }
    return (
      <Link
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-2.5 py-[7px] rounded-lg text-[13.5px] font-medium transition-colors ${
          active
            ? 'bg-[rgb(var(--tint-rgb)/0.12)] dark:bg-[rgb(var(--tint-rgb)/0.16)] text-brand-700 dark:text-[var(--acc-light)]'
            : 'text-slate-600 dark:text-sidebar-text hover:bg-slate-100 dark:hover:bg-sidebar-hover hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span className="flex-none"><Icon d={icons[item.icon]} className="w-4 h-4" /></span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-none ${BADGE_CLS[item.badge]}`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <aside className="flex flex-col h-full bg-white dark:bg-sidebar border-r border-slate-200 dark:border-sidebar-border transition-colors duration-200">
      {/* Logo */}
      <div className={`flex items-center gap-3 h-[60px] border-b border-slate-100 dark:border-sidebar-divider flex-none ${iconsOnly ? 'justify-center' : 'px-5'}`}>
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-brand flex items-center justify-center text-white font-display font-extrabold text-xs flex-none">S</div>
        {!iconsOnly && (
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-900 dark:text-white text-sm leading-none">SISCR</div>
            {tenantSlug && <div className="text-[11px] font-mono text-slate-400 dark:text-sidebar-text mt-1 truncate">@{tenantSlug}</div>}
          </div>
        )}
      </div>

      {/* Nav por seções */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${iconsOnly ? 'flex flex-col items-center px-1.5' : 'px-3'}`}>
        {visibleSections.map(section => (
          <div key={section.title} className={iconsOnly ? 'w-full flex flex-col items-center gap-1' : 'space-y-0.5'}>
            {!iconsOnly && (
              <p className="px-2.5 mb-1 text-[10px] font-bold text-slate-400 dark:text-sidebar-section uppercase tracking-[0.14em]">
                {section.title}
              </p>
            )}
            {section.items.map(item => <NavLink key={item.key} item={item} />)}
          </div>
        ))}
      </nav>

      {/* Footer — tema + usuário + logout */}
      <div className={`border-t border-slate-100 dark:border-sidebar-divider py-3 flex-none space-y-1 ${iconsOnly ? 'flex flex-col items-center px-1.5' : 'px-3'}`}>
        <button
          onClick={handleToggleTheme}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          className={`flex items-center rounded-lg text-slate-500 dark:text-sidebar-text hover:bg-slate-100 dark:hover:bg-sidebar-hover hover:text-slate-900 dark:hover:text-white transition-colors ${
            iconsOnly ? 'w-9 h-9 justify-center' : 'w-full justify-between px-2.5 py-2 text-xs font-medium'
          }`}
        >
          {!iconsOnly && <span>{isDark ? 'Modo Escuro' : 'Modo Claro'}</span>}
          <Icon d={isDark ? icons.sun : icons.moon} className="w-4 h-4" />
        </button>

        <div className={`flex items-center gap-2.5 ${iconsOnly ? 'flex-col' : 'px-1 py-1'}`}>
          <Link
            to="/perfil"
            onClick={() => setSidebarOpen(false)}
            title={userName}
            className={`flex items-center gap-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-sidebar-hover transition-colors ${iconsOnly ? 'p-1' : 'flex-1 min-w-0 px-1 py-1'}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-none">
              {userInitials}
            </div>
            {!iconsOnly && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">{userName}</div>
                <div className="text-[11px] text-slate-400 dark:text-sidebar-text truncate">Administrador</div>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogout}
            title="Sair"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-sidebar-text hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all flex-none"
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
      {prefs.sidebarMode !== 'hidden' && (
        <div className={`hidden lg:flex lg:flex-col flex-none h-screen sticky top-0 overflow-hidden transition-all duration-200 print:hidden ${iconsOnly ? 'lg:w-14' : 'lg:w-[236px]'}`}>
          {sidebarContent}
        </div>
      )}

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div className="w-[236px] flex flex-col shadow-2xl">{sidebarContent}</div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-[60px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 lg:px-6 transition-colors duration-200 print:hidden">
          <button
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon d={icons.menu} className="w-5 h-5" />
          </button>

          <div className="flex-1 text-[13.5px] text-slate-400 dark:text-slate-500 truncate min-w-0">
            {buildBreadcrumb(location.pathname)}
          </div>

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 h-8 rounded-control border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors flex-none"
            title="Busca universal"
          >
            <Icon d={icons.search} className="w-4 h-4 opacity-70" />
            <span className="hidden md:inline">Buscar em tudo</span>
            <kbd className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600">
              {modKey}K
            </kbd>
          </button>

          <button
            onClick={handleToggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-none"
            title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            <Icon d={isDark ? icons.sun : icons.moon} className="w-4 h-4" />
          </button>

          {tenantSlug && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgb(var(--tint-rgb)/0.12)] dark:bg-[rgb(var(--tint-rgb)/0.16)] text-brand-700 dark:text-brand-300 text-xs font-bold flex-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none" />
              @{tenantSlug}
            </div>
          )}
        </header>

        {permAlert && (
          <div
            role="alert"
            className="mx-4 mt-3 lg:mx-6 lg:mt-4 px-4 py-3 rounded-card border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-sm font-medium shadow-sm"
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
