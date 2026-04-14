import { useState, FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/auth';

type TenantChoice = { slug: string; nome: string };

/* ---------- mini mockup do dashboard (SVG decorativo) ---------- */
function DashboardPreview() {
  return (
    <div className="w-full max-w-md mx-auto select-none">
      {/* barra superior */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-3 flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-3 bg-white/10 rounded h-5" />
        <div className="w-6 h-6 rounded-full bg-brand-400/60" />
      </div>

      {/* cards de métricas */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Faturamento', value: 'R$ 48.2k', color: 'from-brand-500/30 to-violet-500/20' },
          { label: 'Pedidos',     value: '1.284',    color: 'from-emerald-500/30 to-teal-500/20' },
          { label: 'A Receber',  value: 'R$ 12.7k',  color: 'from-amber-500/30 to-orange-500/20' },
        ].map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.color} border border-white/10 rounded-lg p-3`}>
            <div className="text-white/50 text-[10px] mb-1">{c.label}</div>
            <div className="text-white font-bold text-sm">{c.value}</div>
          </div>
        ))}
      </div>

      {/* gráfico de barras fake */}
      <div className="bg-white/10 border border-white/10 rounded-xl p-4 mb-3">
        <div className="text-white/60 text-xs mb-3">Vendas — últimos 6 meses</div>
        <div className="flex items-end gap-2 h-16">
          {[40, 65, 50, 80, 55, 90].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-brand-400/70"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'].map(m => (
            <span key={m} className="text-white/30 text-[9px]">{m}</span>
          ))}
        </div>
      </div>

      {/* tabela fake */}
      <div className="bg-white/10 border border-white/10 rounded-xl p-4">
        <div className="text-white/60 text-xs mb-2">Últimos pedidos</div>
        {['Cliente A — R$ 1.200', 'Cliente B — R$ 890', 'Cliente C — R$ 3.450'].map((row, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
            <div className="h-2.5 bg-white/20 rounded w-32" style={{ width: `${50 + i * 10}%` }} />
            <div className="h-2 bg-brand-400/40 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- componente principal ---------- */
export default function Login() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/app';

  const slugFromUrl = searchParams.get('tenant') || '';
  const slugFromStorage = localStorage.getItem('tenant_slug') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState(slugFromUrl || slugFromStorage);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTenantField, setShowTenantField] = useState(!!(slugFromUrl || slugFromStorage));
  const [tenantChoices, setTenantChoices] = useState<TenantChoice[]>([]);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setTenantChoices([]);
    setLoading(true);
    try {
      const slug = tenantSlug.trim() ? tenantSlug.toLowerCase().trim() : undefined;
      await authService.login(email, password, slug);
      const savedSlug = authService.getTenantSlug();
      if (savedSlug) {
        try {
          const u = new URL(redirectTo, window.location.origin);
          u.searchParams.set('tenant', savedSlug);
          navigate(`${u.pathname}${u.search}${u.hash}`);
        } catch {
          navigate(redirectTo);
        }
      } else {
        navigate(redirectTo);
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: {
          status?: number;
          data?: { error?: string; code?: string; tenants?: TenantChoice[] };
        };
      };
      const status = ax.response?.status;
      const data = ax.response?.data;

      if (status === 409 && data?.code === 'MULTIPLE_TENANTS' && data.tenants?.length) {
        setTenantChoices(data.tenants);
        setShowTenantField(true);
        setError(data.error || 'Informe o identificador da empresa.');
        return;
      }
      setError(data?.error || 'Credenciais inválidas. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ====== Painel esquerdo — branding + preview ====== */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-dark flex-col relative overflow-hidden">
        {/* blobs de fundo */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-950/40 rounded-full blur-[150px] pointer-events-none" />

        {/* conteúdo */}
        <div className="relative flex flex-col h-full px-10 py-10">
          {/* logo */}
          <Link to="/" className="flex items-center gap-3 w-fit mb-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-lg shadow-brand-600/30">
              <span className="text-white font-bold text-lg font-display">S</span>
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">SISCR</span>
          </Link>

          {/* headline + preview */}
          <div className="my-8">
            <h2 className="font-display text-3xl font-bold text-white mb-2 leading-snug">
              Gestão completa.<br />
              <span className="text-brand-400">Simples assim.</span>
            </h2>
            <p className="text-slate-400 text-sm mb-8 max-w-xs">
              ERP na nuvem para empresas que precisam de velocidade, controle e menos burocracia.
            </p>
            <DashboardPreview />
          </div>

          {/* features */}
          <div className="mt-auto grid grid-cols-3 gap-3">
            {[
              { icon: '⚡', label: 'Edge Computing', desc: '< 50ms no Brasil' },
              { icon: '🔒', label: 'Multi-tenant',   desc: 'Dados isolados' },
              { icon: '📊', label: 'Relatórios',     desc: 'Em tempo real' },
            ].map(f => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-xl mb-1">{f.icon}</div>
                <div className="text-white text-xs font-semibold">{f.label}</div>
                <div className="text-slate-500 text-[11px]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== Painel direito — formulário ====== */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* logo mobile */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-md">
              <span className="text-white font-bold font-display">S</span>
            </div>
            <span className="font-display font-bold text-xl text-slate-800">SISCR</span>
          </Link>

          {/* cabeçalho */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">
              Bem-vindo de volta
            </h1>
            <p className="text-slate-500 text-sm">
              Entre com seu e-mail e senha para acessar o sistema.
            </p>
          </div>

          {/* erro */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            {/* senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">Senha</label>
                <Link to="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* tenant */}
            {(showTenantField || tenantChoices.length > 0) && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Identificador da empresa</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={e => setTenantSlug(e.target.value)}
                    placeholder="minha-empresa"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    list="tenant-slug-suggestions"
                  />
                  {tenantChoices.length > 0 && (
                    <datalist id="tenant-slug-suggestions">
                      {tenantChoices.map(t => (
                        <option key={t.slug} value={t.slug}>{t.nome}</option>
                      ))}
                    </datalist>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Necessário apenas se você usa o mesmo e-mail em mais de uma empresa.
                </p>
              </div>
            )}

            {!showTenantField && tenantChoices.length === 0 && (
              <button
                type="button"
                onClick={() => setShowTenantField(true)}
                className="text-xs text-slate-400 hover:text-brand-600 transition-colors text-left"
              >
                Uso o mesmo e-mail em mais de uma empresa → informar identificador
              </button>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-brand-600/20 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>

          {/* rodapé */}
          <p className="mt-8 text-center text-sm text-slate-500">
            Não tem uma conta?{' '}
            <Link to="/plans" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors">
              Criar conta grátis
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} SISCR · LP Software
          </p>
        </div>
      </div>
    </div>
  );
}
