import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';

type Phase = 'loading' | 'logging-in' | 'done' | 'timeout' | 'manual';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 20; // 20 × 2s = 40s antes de timeout

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tenantSlug = searchParams.get('tenant') || '';
  const isFree = searchParams.get('free') === '1';

  const [phase, setPhase] = useState<Phase>('loading');
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const doAutoLogin = (data: { token: string; user: { id: string; email: string; nome: string; role: string }; tenant: { id: string; slug: string } }) => {
    setPhase('logging-in');
    authService.saveSession(data);
    const slug = data.tenant.slug;
    setTimeout(() => {
      setPhase('done');
      navigate(`/app?tenant=${encodeURIComponent(slug)}`, { replace: true });
    }, 800);
  };

  // ── Fluxo free: token já vem via sessionStorage gravado pelo Signup ──
  useEffect(() => {
    if (!isFree || !tenantSlug) return;

    const raw = sessionStorage.getItem('signup_session');
    if (raw) {
      sessionStorage.removeItem('signup_session');
      try {
        const session = JSON.parse(raw);
        doAutoLogin(session);
        return;
      } catch {
        // fallback: ir para login
      }
    }
    // Se não tiver sessão no sessionStorage, ir para login manual
    setPhase('manual');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fluxo pago: polling até o webhook processar ──
  useEffect(() => {
    if (isFree || !tenantSlug || phase !== 'loading') return;

    const poll = async () => {
      try {
        const result = await authService.sessionStatus(tenantSlug);

        if (result.status === 'pending') {
          setAttempts((a) => {
            const next = a + 1;
            if (next >= MAX_ATTEMPTS) {
              stopPolling();
              setPhase('timeout');
            }
            return next;
          });
          return;
        }

        stopPolling();

        if (result.status === 'ready' && !result.requiresLogin && result.token) {
          doAutoLogin(result);
        } else {
          setPhase('manual');
        }
      } catch {
        setAttempts((a) => {
          const next = a + 1;
          if (next >= MAX_ATTEMPTS) {
            stopPolling();
            setPhase('timeout');
          }
          return next;
        });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min((attempts / MAX_ATTEMPTS) * 100, 95);

  // ── Tela de configurando ambiente (loading / logging-in) ──
  if (phase === 'loading' || phase === 'logging-in') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-brand-600/15 border border-brand-600/20 flex items-center justify-center mx-auto mb-6">
            <svg className="animate-spin w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-3">
            {phase === 'logging-in' ? 'Entrando no sistema...' : 'Configurando seu ambiente...'}
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            {phase === 'logging-in'
              ? 'Você será redirecionado em instantes.'
              : 'Aguarde enquanto confirmamos o pagamento e preparamos seu ERP.'}
          </p>

          {!isFree && phase === 'loading' && (
            <div className="w-full bg-surface-card rounded-full h-1.5 overflow-hidden mb-3">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tela de timeout ──
  if (phase === 'timeout') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center text-4xl mx-auto mb-6">
            ⏳
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-3">
            Pagamento confirmado!
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Seu ambiente está sendo preparado. Isso pode levar mais alguns segundos.
            Faça login normalmente para acessar o sistema.
          </p>

          {tenantSlug && (
            <div className="card-dark border border-surface-border p-4 mb-6 text-left text-sm space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Suas credenciais de acesso</div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-slate-500">Identificador:</span>
                <code className="text-brand-300 font-mono">@{tenantSlug}</code>
              </div>
              <div className="text-slate-400 text-xs">Use o e-mail e senha que você cadastrou.</div>
            </div>
          )}

          <Link
            to={`/login${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
            className="btn-primary w-full py-4 text-base"
          >
            Acessar o sistema
          </Link>
        </div>
      </div>
    );
  }

  // ── Login manual (token já consumido ou expirado) ──
  if (phase === 'manual') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="font-display text-3xl font-bold text-white mb-3">
            {isFree ? 'Conta criada!' : 'Pagamento confirmado!'}
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            {isFree
              ? 'Sua conta gratuita está pronta.'
              : 'Sua assinatura foi processada e seu ambiente está configurado.'}
            {' '}Faça login para começar.
          </p>

          {tenantSlug && (
            <div className="card-dark border border-surface-border p-5 mb-8 text-left space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Como acessar</div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-none mt-0.5">1</div>
                <div>
                  <div className="text-white text-sm font-semibold">Identificador da empresa</div>
                  <code className="text-brand-300 font-mono text-sm">@{tenantSlug}</code>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-none mt-0.5">2</div>
                <div>
                  <div className="text-white text-sm font-semibold">E-mail e senha</div>
                  <div className="text-slate-400 text-xs mt-0.5">Os mesmos que você usou no cadastro.</div>
                </div>
              </div>
            </div>
          )}

          <Link
            to={`/login${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
            className="btn-primary w-full py-4 text-base mb-4"
          >
            Acessar o sistema
          </Link>

          <Link to="/" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
