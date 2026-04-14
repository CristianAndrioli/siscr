import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

type State = 'loading' | 'redirecting' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setErrorMsg('Link inválido. Solicite um novo e-mail de verificação.');
      setState('error');
      return;
    }

    authService.verifyEmail(token).then((result) => {
      setState('redirecting');

      if (result.action === 'free') {
        authService.saveSession({ token: result.token, user: result.user, tenant: result.tenant });
        navigate(`/checkout/success?tenant=${result.tenantSlug}&free=1`, { replace: true });
      } else {
        window.location.href = result.url;
      }
    }).catch((err) => {
      const msg = err?.response?.data?.error ?? 'Link inválido ou expirado.';
      setErrorMsg(msg);
      setState('error');
    });
  }, []);

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <svg className="animate-spin w-10 h-10 text-indigo-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-300 text-lg font-medium">
            {state === 'loading' ? 'Verificando seu e-mail…' : 'Redirecionando…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Link inválido</h1>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <a
          href="/signup"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          Fazer cadastro novamente
        </a>
      </div>
    </div>
  );
}
