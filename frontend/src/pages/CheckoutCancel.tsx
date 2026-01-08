import { Link } from 'react-router-dom';

function CheckoutCancel() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">⚠</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Checkout Cancelado
          </h2>
          <p className="text-gray-600 mb-6">
            Você cancelou o processo de checkout. Nenhum pagamento foi
            processado.
          </p>
          <div className="flex gap-4">
            <Link
              to="/plans"
              className="flex-1 text-center bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Ver Planos
            </Link>
            <Link
              to="/checkout"
              className="flex-1 text-center bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
            >
              Tentar Novamente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutCancel;

