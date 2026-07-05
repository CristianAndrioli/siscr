import { useNavigate } from 'react-router-dom';
import Button from './Button';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}

/**
 * Componente para exibir quando o usuário não tem acesso a uma funcionalidade
 */
export default function AccessDenied({
  title = 'Acesso Negado',
  message = 'Você não tem permissão para acessar esta funcionalidade.',
  showBackButton = true,
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card p-8 text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{message}</p>

        {showBackButton && (
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/app')}
            >
              Ir para Início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
