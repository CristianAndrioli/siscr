import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authService } from '../services/auth';

function ResetPassword() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid || !token) {
      setError('Link inválido ou expirado');
    }
  }, [uid, token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (!uid || !token) {
      setError('Link inválido');
      return;
    }

    setLoading(true);

    try {
      await authService.confirmPasswordReset(uid, token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string; detail?: string } } };
      setError(axiosError.response?.data?.error || axiosError.response?.data?.detail || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors shadow-sm';

  const logo = (
    <Link to="/" className="flex items-center gap-2 mb-10 justify-center">
      <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-md">
        <span className="text-white font-bold font-display">S</span>
      </div>
      <span className="font-display font-bold text-xl text-slate-800">SISCR</span>
    </Link>
  );

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {logo}
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Link inválido ou expirado</span>
          </div>
          <Link
            to="/login"
            className="block w-full text-center py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-lg shadow-brand-600/20 transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        {logo}

        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">
            Redefinir senha
          </h1>
          <p className="text-slate-500 text-sm">
            Escolha uma nova senha para a sua conta.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 mb-0.5">Senha redefinida com sucesso!</p>
                <p className="text-xs text-emerald-700">Redirecionando para o login...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nova senha
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Digite a senha novamente"
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-brand-600/20 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Redefinindo...
                  </>
                ) : 'Redefinir senha'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Lembrou a senha?{' '}
              <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors">
                Voltar ao login
              </Link>
            </p>
          </>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} SISCR · LP Software
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
