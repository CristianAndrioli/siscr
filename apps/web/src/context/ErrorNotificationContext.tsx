import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { logError } from '../utils/errorLogger';

export interface ErrorNotification {
  id: string;
  logId: string;
  friendlyMessage: string;
  technical: string;
}

interface ErrorNotificationContextValue {
  notifications: ErrorNotification[];
  /** Reporta um erro: registra no log e exibe o balão */
  reportError: (friendlyMessage: string, err?: unknown, context?: string) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ErrorNotificationContextValue | null>(null);

export function ErrorNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const reportError = useCallback(
    (friendlyMessage: string, err: unknown = null, context?: string) => {
      const logId = logError(friendlyMessage, err, context);

      const notif: ErrorNotification = {
        id: crypto.randomUUID(),
        logId,
        friendlyMessage,
        technical: '',
      };

      setNotifications((prev) => [notif, ...prev].slice(0, 5));

      // Auto-dismiss após 8 segundos
      const timer = setTimeout(() => dismiss(notif.id), 8000);
      timers.current.set(notif.id, timer);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ notifications, reportError, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}

export function useErrorNotification() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useErrorNotification deve ser usado dentro de ErrorNotificationProvider');
  return ctx;
}
