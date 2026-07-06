import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface TenantInfo {
  nome: string;
  slug: string;
  plan_id: string;
  status: string;
}

function ConfigCard({ to, icon, title, desc, badge }: { to: string; icon: React.ReactNode; title: string; desc: string; badge?: string }) {
  return (
    <Link to={to} className="group flex gap-4 items-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm rounded-xl p-5 transition-all duration-150">
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-none group-hover:bg-brand-50 dark:group-hover:bg-brand-950 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{title}</p>
          {badge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">{badge}</span>}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand-400 flex-none mt-0.5 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </Link>
  );
}

function Configuracoes() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    api.get('/tenant/info').then(r => setTenant(r.data.tenant)).catch(() => {});
  }, []);

  const PLAN_LABEL: Record<string, string> = {
    free: 'Free', basico: 'Básico', pro: 'Pro', enterprise: 'Enterprise',
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Configurações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie usuários, empresas, filiais e permissões</p>
      </div>

      {/* Info do tenant */}
      {tenant && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Tenant</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{tenant.nome}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{tenant.slug}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Plano</p>
            <span className="inline-flex mt-0.5 items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
              {PLAN_LABEL[tenant.plan_id] ?? tenant.plan_id}
            </span>
          </div>
        </div>
      )}

      {/* Seção: Acesso */}
      <div>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Acesso e Usuários</p>
        <div className="space-y-2">
          <ConfigCard
            to="/configuracoes/usuarios"
            title="Usuários"
            desc="Adicionar, editar e remover usuários que acessam o sistema"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
          />
          <ConfigCard
            to="/configuracoes/permissoes"
            title="Permissões"
            desc="Definir o que cada perfil (admin, gerente, usuário) pode acessar"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
          />
        </div>
      </div>

      {/* Seção: Empresa */}
      <div>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Empresa e Estrutura</p>
        <div className="space-y-2">
          <ConfigCard
            to="/configuracoes/filiais"
            title="Empresas e Filiais"
            desc="Gerenciar empresas do tenant e suas filiais"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
          />
          <ConfigCard
            to="/configuracoes/faturamento"
            title="Faturamento (NF-e)"
            desc="Ambiente SEFAZ (homologação ou produção), série, numeração e regime tributário (CRT)"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
          />
          <ConfigCard
            to="/configuracoes/conexoes"
            title="Conexões"
            desc="Credenciais de integração — contabilidade (Domínio, Alterdata), ponte SEFAZ e APIs externas"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
          />
        </div>
      </div>

      {/* Seção: Conta */}
      <div>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Conta e Assinatura</p>
        <div className="space-y-2">
          <ConfigCard
            to="/perfil"
            title="Meu Perfil"
            desc="Nome, e-mail, senha e preferências pessoais"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <ConfigCard
            to="/subscription-management"
            title="Assinatura"
            desc="Ver plano atual, fazer upgrade ou gerenciar pagamento"
            badge="Stripe"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
          />
        </div>
      </div>
    </div>
  );
}

export default Configuracoes;
