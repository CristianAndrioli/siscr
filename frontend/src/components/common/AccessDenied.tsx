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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        
        {showBackButton && (
          <div className="flex gap-4 justify-center">
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
              Ir para Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

