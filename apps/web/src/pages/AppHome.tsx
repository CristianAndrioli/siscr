import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { authService } from '../services/auth';
import Layout from '../components/Layout';

interface ModuleInfo {
  code: string;
  name: string;
  description: string;
  route: string;
  color: string;
  icon: React.ReactNode;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const ModuleIcon = ({ d }: { d: React.ReactNode }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    {d}
  </svg>
);

const allModules: ModuleInfo[] = [
  {
    code: 'cadastros',
    name: 'Cadastros',
    description: 'Pessoas, produtos e serviços',
    route: '/cadastros/pessoas',
    color: 'bg-violet-50 text-violet-600 border-violet-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />} />,
  },
  {
    code: 'financeiro',
    name: 'Financeiro',
    description: 'Contas a receber e a pagar',
    route: '/financeiro/contas-receber',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />} />,
  },
  {
    code: 'faturamento',
    name: 'Faturamento',
    description: 'Cotações e notas fiscais',
    route: '/faturamento/cotacoes',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />} />,
  },
  {
    code: 'servico_logistico',
    name: 'Serviço Logístico',
    description: 'Processos e serviços aduaneiros',
    route: '/servico-logistico',
    color: 'bg-sky-50 text-sky-600 border-sky-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />} />,
  },
  {
    code: 'estoque',
    name: 'Estoque',
    description: 'Locais, movimentações e transferências',
    route: '/estoque/estoque-atual',
    color: 'bg-orange-50 text-orange-600 border-orange-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />} />,
  },
  {
    code: 'monitoramento',
    name: 'Monitoramento',
    description: 'Acompanhamento de processos',
    route: '/monitoramento',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
    icon: <ModuleIcon d={<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />} />,
  },
  {
    code: 'configuracoes',
    name: 'Configurações',
    description: 'Usuários, roles e assinatura',
    route: '/configuracoes',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <ModuleIcon d={<><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>} />,
  },
];

function AppHome() {
  const { hasModuleAccess, loading } = usePermissions();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const nome = localStorage.getItem('user_nome');
    if (nome) {
      setUserName(nome);
    } else {
      const localUser = authService.getLocalUser();
      setUserName(localUser?.nome || localUser?.email || '');
    }
  }, []);

  const availableModules = loading
    ? []
    : allModules.filter(m => hasModuleAccess(m.code));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Saudação */}
        <div>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mb-1">{greeting()},</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
            {userName ? userName.split(' ')[0] : 'Usuário'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Selecione um módulo para começar.</p>
        </div>

        {/* Grid de módulos */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : availableModules.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-800 text-sm">
              Você não tem acesso a nenhum módulo. Entre em contato com o administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableModules.map(module => (
              <Link
                key={module.code}
                to={module.route}
                className="group flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-800 hover:shadow-md hover:shadow-brand-100/50 dark:hover:shadow-brand-950/50 rounded-xl p-5 transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-none transition-transform duration-200 group-hover:scale-110 ${module.color}`}>
                  {module.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                    {module.name}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{module.description}</div>
                </div>
                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand-400 dark:group-hover:text-brand-500 ml-auto flex-none transition-all duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Acesso rápido */}
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Acesso rápido</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Perfil', to: '/perfil' },
              { label: 'Assinatura', to: '/subscription-management' },
              { label: 'Usuários', to: '/usuarios' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 font-medium hover:border-brand-200 dark:hover:border-brand-800 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950 transition-all duration-150"
              >
                {item.label}
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default AppHome;
