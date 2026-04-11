/** Sistema de log de erros do frontend. Armazena no localStorage. */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  /** Mensagem amigável exibida ao usuário */
  friendlyMessage: string;
  /** Detalhes técnicos (stack, mensagem da API, status HTTP, etc.) */
  technical: string;
  /** URL da página onde ocorreu */
  url: string;
  /** Contexto adicional (nome da tela, ação) */
  context?: string;
}

const STORAGE_KEY = 'siscr_error_log';
const MAX_ENTRIES = 100;

function load(): ErrorLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(entries: ErrorLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // localStorage cheio ou indisponível — ignora
  }
}

/**
 * Extrai uma descrição técnica legível de qualquer tipo de erro.
 */
export function extractTechnical(err: unknown): string {
  if (!err) return 'Erro desconhecido';

  // Erro Axios (resposta HTTP)
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    if (e.response) {
      const res = e.response as Record<string, unknown>;
      const status = res.status;
      const data = res.data;
      const url = (res.config as Record<string, unknown> | undefined)?.url ?? (e as Record<string,unknown>)?.config
        ? ((e as Record<string,unknown>).config as Record<string,unknown>)?.url
        : undefined;

      let body = '';
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>;
        body = d.error
          ? String(d.error)
          : d.message
          ? String(d.message)
          : JSON.stringify(data);
      } else {
        body = String(data ?? '');
      }

      return [
        `HTTP ${status}`,
        url ? `URL: ${url}` : '',
        body ? `Resposta: ${body}` : '',
        e.message ? `${e.message}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // Erro de rede (sem resposta)
    if (e.request) {
      return `Sem resposta do servidor (timeout ou rede indisponível)\n${e.message ?? ''}`;
    }

    // Error padrão JS
    if (e.message) {
      const stack = typeof e.stack === 'string' ? `\n${e.stack}` : '';
      return `${e.message}${stack}`;
    }

    return JSON.stringify(err);
  }

  return String(err);
}

/**
 * Registra um erro no log local.
 * @returns O ID gerado para o registro (útil para linkar no toast)
 */
export function logError(
  friendlyMessage: string,
  err: unknown,
  context?: string,
): string {
  const id = crypto.randomUUID();
  const entry: ErrorLogEntry = {
    id,
    timestamp: new Date().toISOString(),
    friendlyMessage,
    technical: extractTechnical(err),
    url: window.location.pathname,
    context,
  };

  const entries = load();
  entries.unshift(entry); // mais recente primeiro
  save(entries);

  return id;
}

export function getErrorLog(): ErrorLogEntry[] {
  return load();
}

export function clearErrorLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getErrorById(id: string): ErrorLogEntry | undefined {
  return load().find((e) => e.id === id);
}
