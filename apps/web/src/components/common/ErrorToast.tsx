import { useNavigate } from 'react-router-dom';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

/** Renderiza o stack de balões de erro no canto inferior direito. */
export default function ErrorToastStack() {
  const { notifications, dismiss } = useErrorNotification();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 w-80 max-w-[calc(100vw-2rem)]">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex flex-col gap-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-xl shadow-xl px-4 py-3 animate-slide-in"
          role="alert"
        >
          {/* Linha superior: ícone + fechar */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
              {n.friendlyMessage}
            </p>
            <button
              onClick={() => dismiss(n.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Fechar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Link para log de detalhes */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                dismiss(n.id);
                navigate(`/configuracoes/logs/${n.logId}`);
              }}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 underline underline-offset-2 transition-colors"
            >
              Ver detalhes do erro →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
