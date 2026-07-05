/**
 * Componente de Mensagem de Erro reutilizável
 */
interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
}

export default function ErrorMessage({
  message,
  onClose,
  type = 'error',
  dismissible = true,
}: ErrorMessageProps) {
  const typeClasses = {
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-200',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200',
    info: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/50 dark:border-sky-900 dark:text-sky-200',
  };

  const iconColors = {
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-sky-500',
  };

  const icons = {
    error: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-start gap-3 border rounded-lg px-4 py-3 text-sm ${typeClasses[type]}`}
      role="alert"
    >
      <span className={`flex-none mt-0.5 ${iconColors[type]}`}>{icons[type]}</span>
      <p className="flex-1 min-w-0 font-medium">{message}</p>
      {dismissible && onClose && (
        <button
          onClick={onClose}
          className="flex-none -m-1 p-1 rounded-md text-current opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Fechar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
