import { useState, FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/auth';

type TenantChoice = { slug: string; nome: string };

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/app';

  const slugFromUrl = searchParams.get('tenant') || '';
  const slugFromStorage = localStorage.getItem('tenant_slug') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      navigate(redirectTo);
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
        setError(data.error || 'Informe o identificador da empresa em que deseja entrar.');
        return;
      }

      setError(data?.error || 'Credenciais inválidas. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/15 rounded-full blur-[80px]" />
        </div>

        <Link to="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold">S</div>
          <span className="font-display font-bold text-xl text-white">SISCR</span>
        </Link>

        <div className="relative">
          <blockquote className="text-2xl font-display font-semibold text-white leading-snug mb-6">
            "Gestão completa para empresas que precisam de mais velocidade e menos complexidade."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm">LP</div>
            <div>
              <div className="text-white text-sm font-semibold">LP Software</div>
              <div className="text-slate-400 text-xs">Produto SISCR</div>
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-4">
          {[
            { v: '99.99%', l: 'Uptime' },
            { v: '< 50ms', l: 'Latência' },
            { v: '100%', l: 'Edge' },
          ].map((s) => (
            <div key={s.l} className="bg-surface-card/60 border border-surface-border rounded-xl p-4 text-center">
              <div className="font-display text-2xl font-bold text-white">{s.v}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-display font-bold text-lg text-white">SISCR</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-white mb-2">Bem-vindo de volta</h1>
            <p className="text-slate-400">Entre com seu e-mail e senha. O sistema identifica sua empresa automaticamente.</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span className="text-base mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label text-slate-300">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="input-label text-slate-300 mb-0">Senha</label>
                <Link to="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            {(showTenantField || tenantChoices.length > 0) && (
              <div className="rounded-xl border border-surface-border bg-surface-card/40 p-4 space-y-3">
                <div>
                  <label className="input-label text-slate-300">Identificador da empresa</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                    <input
                      type="text"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                      placeholder="minha-empresa"
                      className="input pl-8 bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
                      list="tenant-slug-suggestions"
                    />
                    {tenantChoices.length > 0 && (
                      <datalist id="tenant-slug-suggestions">
                        {tenantChoices.map((t) => (
                          <option key={t.slug} value={t.slug}>{t.nome}</option>
                        ))}
                      </datalist>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Só é necessário se você usa o mesmo e-mail em mais de uma empresa, ou se preferir informar manualmente.
                  </p>
                </div>
              </div>
            )}

            {!showTenantField && tenantChoices.length === 0 && (
              <button
                type="button"
                onClick={() => setShowTenantField(true)}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors text-left"
              >
                Uso o mesmo e-mail em mais de uma empresa → informar identificador
              </button>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Não tem uma conta?{' '}
            <Link to="/plans" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
