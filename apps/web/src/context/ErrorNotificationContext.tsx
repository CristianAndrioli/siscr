import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { logError } from '../utils/errorLogger';

export type ToastVariant = 'error' | 'warning' | 'success' | 'info';

export interface AppToast {
  id: string;
  /** Se definido, o toast oferece link para o log persistido. */
  logId?: string;
  friendlyMessage: string;
  variant: ToastVariant;
}

interface ErrorNotificationContextValue {
  notifications: AppToast[];
  /** Erro real: grava em error_logs e exibe toast vermelho. */
  reportError: (friendlyMessage: string, err?: unknown, context?: string) => void;
  /**
   * Aviso/sucesso operacional: só toast flutuante — não cria log de erro.
   * Use para confirmações, validações de leiaute, dicas de fluxo etc.
   */
  notify: (message: string, variant?: Exclude<ToastVariant, 'error'>) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ErrorNotificationContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  error: 8000,
  warning: 7000,
  success: 5000,
  info: 5000,
};

export function ErrorNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppToast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<AppToast, 'id'> & { id?: string }) => {
      const notif: AppToast = {
        id: toast.id ?? crypto.randomUUID(),
        logId: toast.logId,
        friendlyMessage: toast.friendlyMessage,
        variant: toast.variant,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 5));
      const timer = setTimeout(() => dismiss(notif.id), AUTO_DISMISS_MS[notif.variant]);
      timers.current.set(notif.id, timer);
    },
    [dismiss],
  );

  const reportError = useCallback(
    (friendlyMessage: string, err: unknown = null, context?: string) => {
      const logId = logError(friendlyMessage, err, context);
      pushToast({ logId, friendlyMessage, variant: 'error' });
    },
    [pushToast],
  );

  const notify = useCallback(
    (message: string, variant: Exclude<ToastVariant, 'error'> = 'info') => {
      pushToast({ friendlyMessage: message, variant });
    },
    [pushToast],
  );

  return (
    <Ctx.Provider value={{ notifications, reportError, notify, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}

export function useErrorNotification() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useErrorNotification deve ser usado dentro de ErrorNotificationProvider');
  return ctx;
}
