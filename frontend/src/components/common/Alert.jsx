/**
 * Componente Alert reutilizável para mensagens
 * @param {string} type - Tipo de alerta (success, error, warning, info)
 * @param {string} message - Mensagem a exibir
 * @param {function} onClose - Função para fechar o alerta (opcional)
 * @param {string} className - Classes CSS adicionais
 */
export default function Alert({ type = 'info', message, onClose, className = '' }) {
  if (!message) return null;

  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };

  return (
    <div
      className={`
        border-l-4 p-4 rounded-md mb-4
        ${typeClasses[type]}
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-center justify-between">
        <p>{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-current opacity-70 hover:opacity-100"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

