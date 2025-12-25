import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { paymentsService } from '../services/payments';
import { authService } from '../services/auth';

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!sessionId) {
      setError('ID da sessão não encontrado');
      setLoading(false);
      return;
    }

    // Verificar se usuário está autenticado
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Verificar status da sessão
    let countdownInterval: NodeJS.Timeout | null = null;
    
    const checkSessionStatus = async () => {
      if (!sessionId) return;

      try {
        const status = await paymentsService.getCheckoutSession(sessionId);
        setSessionStatus(status);
        
        // Se pagamento foi bem-sucedido, aguardar alguns segundos e redirecionar
        if (status.payment_status === 'paid') {
          // Contador regressivo visível
          countdownInterval = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                if (countdownInterval) clearInterval(countdownInterval);
                navigate('/app');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
          'Erro ao verificar status do pagamento'
        );
      } finally {
        setLoading(false);
      }
    };

    checkSessionStatus();

    // Limpar intervalo se componente for desmontado
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando pagamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">✗</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Erro ao Processar Pagamento
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/checkout"
              className="block w-full text-center bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
            >
              Tentar Novamente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = sessionStatus?.payment_status === 'paid';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center">
          {isPaid ? (
            <>
              <div className="text-green-500 text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Pagamento Confirmado!
              </h2>
              <p className="text-gray-600 mb-6">
                Sua assinatura foi ativada com sucesso. Você será redirecionado
                para a home em <strong className="text-indigo-600">{countdown}</strong> segundo{countdown !== 1 ? 's' : ''}.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">
                  <strong>Status:</strong> {sessionStatus?.payment_status}
                </p>
                {sessionStatus?.subscription_id && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>ID da Assinatura:</strong>{' '}
                    {sessionStatus.subscription_id}
                  </p>
                )}
              </div>
              <Link
                to="/app"
                className="block w-full text-center bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
              >
                Ir para Home
              </Link>
            </>
          ) : (
            <>
              <div className="text-yellow-500 text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Processando Pagamento
              </h2>
              <p className="text-gray-600 mb-6">
                Seu pagamento está sendo processado. Isso pode levar alguns
                minutos.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Você receberá um email de confirmação assim que o pagamento for
                confirmado.
              </p>
              <Link
                to="/app"
                className="block w-full text-center bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 font-semibold"
              >
                Ir para Home
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccess;

