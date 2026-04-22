import { useState, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authService } from '../services/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

/** Template com `{slug}` para preview; ex.: https://{slug}.app.siscr.com.br */
const TENANT_URL_TEMPLATE =
  import.meta.env.VITE_TENANT_URL_TEMPLATE || 'https://{slug}.app.siscr.com.br';

const PLAN_LABELS: Record<string, string> = {
  free:       'Free',
  basico:     'Básico — R$ 99/mês',
  pro:        'Pro',
  enterprise: 'Enterprise — R$ 499/mês',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plan = searchParams.get('plan') || 'free';
  const planLabel = PLAN_LABELS[plan] || plan;

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugFeedback, setSlugFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Dados da empresa (step 1)
  const [empresaNome, setEmpresaNome] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  // Dados do usuário (step 2)
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleEmpresaChange = (value: string) => {
    setEmpresaNome(value);
    if (!slugEdited) {
      setTenantSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setTenantSlug(slugify(value));
    setSlugEdited(true);
    setSlugFeedback(null);
  };

  const previewSlug =
    tenantSlug.trim().length > 0
      ? tenantSlug.trim()
      : slugify(empresaNome.trim()) || 'sua-empresa';

  const previewUrl = TENANT_URL_TEMPLATE.replace('{slug}', previewSlug);

  const runSlugAvailability = async (): Promise<boolean> => {
    setError('');
    setSlugFeedback(null);
    const q = tenantSlug.trim();
    if (!q) {
      setSlugFeedback({
        type: 'ok',
        text: 'Será gerado automaticamente um subdomínio único a partir do nome da empresa.',
      });
      return true;
    }
    setSlugChecking(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/auth/tenant-slug/availability`, {
        params: { slug: q },
      });
      if (data.empty) {
        setSlugFeedback({ type: 'ok', text: data.message });
        return true;
      }
      if (data.available === false) {
        setSlugFeedback({ type: 'err', text: data.message });
        return false;
      }
      setSlugFeedback({
        type: 'ok',
        text: `O subdomínio "${data.normalized}" está disponível.`,
      });
      return true;
    } catch {
      setSlugFeedback({
        type: 'err',
        text: 'Não foi possível verificar agora. Tente de novo.',
      });
      return false;
    } finally {
      setSlugChecking(false);
    }
  };

  const nextStep = async (e: FormEvent) => {
    e.preventDefault();
    if (!empresaNome.trim()) return;
    const ok = await runSlugAvailability();
    if (!ok) return;
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const finalSlug = tenantSlug.trim() || slugify(empresaNome.trim());
      await authService.requestEmailVerification({
        nome,
        email,
        password,
        tenantNome: empresaNome,
        tenantSlug: finalSlug,
        plan,
      });
      setStep(3);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Erro ao enviar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg animate-fade-in">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">S</div>
          <span className="font-display font-bold text-lg text-white">SISCR</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600/15 border border-brand-600/20 text-brand-300 text-xs font-semibold mb-4">
            Plano: {planLabel}
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Criar conta</h1>
          <p className="text-slate-400">
            {step === 1 ? 'Vamos começar com sua empresa.' : step === 2 ? 'Agora crie seu acesso de administrador.' : 'Quase lá!'}
          </p>
        </div>

        {/* Indicador de etapas */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step ? 'bg-brand-600 text-white' :
                s < step ? 'bg-brand-600/30 text-brand-400' :
                'bg-surface-card border border-surface-border text-slate-600'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className={`text-sm ${s === step ? 'text-white font-semibold' : 'text-slate-500'}`}>
                {s === 1 ? 'Empresa' : s === 2 ? 'Acesso' : 'E-mail'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-surface-border mx-1" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 — Empresa */}
        {step === 1 && (
          <form onSubmit={nextStep} className="space-y-5">
            <div>
              <label className="input-label text-slate-300">Nome da empresa</label>
              <input
                type="text"
                value={empresaNome}
                onChange={(e) => handleEmpresaChange(e.target.value)}
                placeholder="Minha Empresa Ltda"
                required
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="input-label text-slate-300">
                Subdomínio <span className="text-slate-500 font-normal">(endereço do seu espaço)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                    https://
                  </span>
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="minha-empresa"
                    maxLength={30}
                    autoComplete="off"
                    className="input pl-[4.25rem] bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void runSlugAvailability()}
                  disabled={slugChecking || !tenantSlug.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-surface-border text-slate-200 hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {slugChecking ? 'Verificando…' : 'Validar disponibilidade'}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-300">Prévia:</span>{' '}
                <span className="break-all font-mono text-brand-300/90">{previewUrl}</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Somente letras minúsculas, números e hífens (3–30 caracteres). Se deixar em branco, o subdomínio será
                definido <strong className="text-slate-500">automaticamente</strong> a partir do nome da empresa,
                garantindo um nome único no sistema. A disponibilidade é verificada na base de cadastro de clientes.
              </p>
              {slugFeedback && (
                <p
                  className={`mt-2 text-xs ${
                    slugFeedback.type === 'ok' ? 'text-emerald-400/90' : 'text-red-400/90'
                  }`}
                >
                  {slugFeedback.text}
                </p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full py-3.5 text-base">
              Continuar →
            </button>
          </form>
        )}

        {/* Step 2 — Usuário */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label text-slate-300">Seu nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="João da Silva"
                required
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="input-label text-slate-300">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                required
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="input-label text-slate-300">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="input-label text-slate-300">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                required
                className="input bg-surface-card border-surface-border text-white placeholder-slate-600 focus:ring-brand-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost text-slate-400 border border-surface-border px-5 py-3.5"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-3.5 text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {plan === 'free' ? 'Criando conta...' : 'Indo para pagamento...'}
                  </span>
                ) : plan === 'free' ? 'Criar conta grátis' : 'Ir para pagamento →'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3 — Verificar e-mail */}
        {step === 3 && (
          <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 bg-brand-600/15 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Verifique seu e-mail</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enviamos um link de confirmação para <strong className="text-slate-200">{email}</strong>.
                <br />Clique no link para continuar o cadastro.
              </p>
            </div>
            <p className="text-xs text-slate-600">O link expira em 24 horas. Verifique também a pasta de spam.</p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              ← Corrigir e-mail
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Já tem conta?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
            Entrar
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-slate-700 leading-relaxed">
          Ao criar sua conta você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
