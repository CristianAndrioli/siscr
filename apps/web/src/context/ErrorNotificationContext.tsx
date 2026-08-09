import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { logError } from '../utils/errorLogger';

export type ToastVariant = 'error' | 'warning' | 'success' | 'info';

export interface AppToast {
  id: string;
  /** Se definido, o toast % link para o log persistido. */
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
  /** Pausa o auto-dismiss enquanto o mouse está sobre o toast (global). */
  pauseDismiss: (id: string) => void;
  /** Retoma o auto-dismiss após o mouse sair do toast. */
  resumeDismiss: (id: string) => void;
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
  const remainingMs = useRef<Map<string, number>>(new Map());
  const startedAt = useRef<Map<string, number>>(new Map());
  const paused = useRef<Set<string>>(new Set());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      remainingMs.current.delete(id);
      startedAt.current.delete(id);
      paused.current.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    },
    [clearTimer],
  );

  const scheduleDismiss = useCallback(
    (id: string, ms: number) => {
      clearTimer(id);
      remainingMs.current.set(id, ms);
      startedAt.current.set(id, Date.now());
      const timer = setTimeout(() => dismiss(id), ms);
      timers.current.set(id, timer);
    },
    [clearTimer, dismiss],
  );

  const pauseDismiss = useCallback(
    (id: string) => {
      if (paused.current.has(id)) return;
      const start = startedAt.current.get(id);
      const remaining = remainingMs.current.get(id);
      if (start == null || remaining == null) return;
      const elapsed = Date.now() - start;
      const left = Math.max(500, remaining - elapsed);
      remainingMs.current.set(id, left);
      clearTimer(id);
      paused.current.add(id);
    },
    [clearTimer],
  );

  const resumeDismiss = useCallback(
    (id: string) => {
      if (!paused.current.has(id)) return;
      paused.current.delete(id);
      const left = remainingMs.current.get(id) ?? AUTO_DISMISS_MS.info;
      scheduleDismiss(id, left);
    },
    [scheduleDismiss],
  );

  const pushToast = useCallback(
    (toast: Omit<AppToast, 'id'> & { id?: string }) => {
      const notif: AppToast = {
        id: toast.id ?? crypto.randomUUID(),
        logId: toast.logId,
        friendlyMessage: toast.friendlyMessage,
        variant: toast.variant,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 5));
      scheduleDismiss(notif.id, AUTO_DISMISS_MS[notif.variant]);
    },
    [scheduleDismiss],
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
    <Ctx.Provider
      value={{ notifications, reportError, notify, dismiss, pauseDismiss, resumeDismiss }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useErrorNotification() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useErrorNotification deve ser usado dentro de ErrorNotificationProvider');
  return ctx;
}
