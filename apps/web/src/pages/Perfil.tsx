import { useState } from 'react';
import { authService } from '../services/auth';
import { useTheme } from '../hooks/useTheme';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
  viewer: 'Visualizador',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  manager: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function Perfil() {
  const { theme, setTheme } = useTheme();

  // Dados lidos do localStorage (salvos no login)
  const localUser = authService.getLocalUser();
  const tenantSlug = localStorage.getItem('tenant_slug') || '';
  const nome = localUser?.nome || localStorage.getItem('user_nome') || 'Usuário';
  const email = localUser?.email || '';
  const role = localUser?.role || 'user';

  const initials = nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || 'U';

  // Nome editável (apenas localmente)
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(nome);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('user_nome', editNome);
    const user = authService.getLocalUser();
    if (user) {
      localStorage.setItem('user', JSON.stringify({ ...user, nome: editNome }));
    }
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Meu Perfil</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie suas informações e preferências</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm">
          <svg className="w-4 h-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Alterações salvas com sucesso.
        </div>
      )}

      {/* Card — Dados do usuário */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Avatar + nome */}
        <div className="flex items-center gap-5 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold flex-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{nome}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLOR[role] ?? ROLE_COLOR.viewer}`}>
                {ROLE_LABEL[role] ?? role}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{email}</p>
          </div>
        </div>

        {/* Campos */}
        <div className="p-6 space-y-5">
          {/* Nome de exibição */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Nome de exibição
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => { setEditNome(nome); setIsEditing(false); }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-800 dark:text-slate-200">{nome}</p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              E-mail
            </label>
            <p className="text-sm text-slate-800 dark:text-slate-200">{email || '—'}</p>
          </div>

          {/* Tenant */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Empresa (tenant)
            </label>
            <p className="text-sm text-slate-800 dark:text-slate-200 font-mono">@{tenantSlug || '—'}</p>
          </div>
        </div>
      </div>

      {/* Card — Aparência */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Aparência</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Modo Claro */}
          <button
            onClick={() => setTheme('light')}
            className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
              theme === 'light'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {theme === 'light' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500" />
            )}
            {/* Preview light */}
            <div className="w-full h-16 rounded-lg bg-white border border-slate-200 overflow-hidden">
              <div className="h-4 bg-slate-100 border-b border-slate-200 flex items-center px-2 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="w-8 h-1 rounded bg-slate-200" />
              </div>
              <div className="flex h-12">
                <div className="w-10 bg-slate-50 border-r border-slate-100" />
                <div className="flex-1 p-2 space-y-1">
                  <div className="h-1.5 w-16 rounded bg-slate-200" />
                  <div className="h-1.5 w-12 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SunIcon />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo Claro</span>
            </div>
          </button>

          {/* Modo Escuro */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
              theme === 'dark'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {theme === 'dark' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500" />
            )}
            {/* Preview dark */}
            <div className="w-full h-16 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="h-4 bg-slate-900 border-b border-slate-800 flex items-center px-2 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="w-8 h-1 rounded bg-slate-700" />
              </div>
              <div className="flex h-12">
                <div className="w-10 bg-slate-900 border-r border-slate-800" />
                <div className="flex-1 p-2 space-y-1">
                  <div className="h-1.5 w-16 rounded bg-slate-700" />
                  <div className="h-1.5 w-12 rounded bg-slate-800" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MoonIcon />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo Escuro</span>
            </div>
          </button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          A preferência de tema é salva por usuário neste dispositivo.
        </p>
      </div>

      {/* Card — Segurança */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Segurança</h3>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Senha</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Altere sua senha de acesso</p>
          </div>
          <a
            href="/forgot-password"
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
          >
            Redefinir senha
          </a>
        </div>
      </div>
    </div>
  );
}

export default Perfil;
