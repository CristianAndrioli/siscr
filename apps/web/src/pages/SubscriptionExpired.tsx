import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authService } from '../services/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function SubscriptionExpired() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userNome = authService.getLocalUser()?.nome || '';

  const handleOpenPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const token = authService.getToken();
      const res = await axios.post<{ url: string }>(
        `${API_BASE_URL}/api/subscriptions/reactivation-portal`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? (err.response?.data as { error?: string })?.error
          : undefined;
      setError(msg || 'Não foi possível abrir o portal de assinatura. Tente novamente.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Card principal */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden">

          {/* Cabeçalho vermelho */}
          <div className="bg-gradient-to-br from-red-500 to-rose-600 px-8 py-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Assinatura Suspensa</h1>
            {userNome && (
              <p className="text-red-100 text-sm">Olá, {userNome}</p>
            )}
          </div>

          {/* Corpo */}
          <div className="px-8 py-8">
            <p className="text-slate-600 dark:text-slate-300 text-center mb-6 leading-relaxed">
              O acesso ao sistema está temporariamente suspenso porque sua assinatura foi
              cancelada ou ocorreu uma falha no pagamento.
            </p>

            {/* Lista explicativa */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Seus dados estão seguros e preservados.</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Reative a assinatura pelo Stripe para recuperar o acesso imediatamente.</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Após a reativação, o acesso é restaurado automaticamente.</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-5">
                {error}
              </div>
            )}

            {/* Botão principal — portal Stripe */}
            <button
              onClick={handleOpenPortal}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm mb-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Abrindo portal...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  Reativar assinatura no Stripe
                </>
              )}
            </button>

            {/* Botão secundário — escolher novo plano */}
            <a
              href="/plans"
              className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-3 rounded-xl transition-colors text-sm mb-6"
            >
              Ver planos disponíveis
            </a>

            {/* Sair */}
            <div className="text-center">
              <button
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors underline"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>

        {/* Nota de suporte */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}

export default SubscriptionExpired;
