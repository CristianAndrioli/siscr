/** Sistema de log de erros — envia para o banco via API (fire-and-forget). */
import api from '../services/api';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  friendly_message: string;
  technical?: string | null;
  url?: string | null;
  context?: string | null;
  created_at: string;
}

/** Extrai a parte técnica legível (sem stack trace). */
function extractTechnical(err: unknown): string {
  if (!err) return 'Erro desconhecido';

  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    if (e.response) {
      const res = e.response as Record<string, unknown>;
      const status = res.status;
      const data = res.data;
      const cfg = e.config as Record<string, unknown> | undefined;
      const reqUrl = cfg?.url ?? (res.config as Record<string, unknown> | undefined)?.url;

      let body = '';
      if (typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>;
        body = d.error ? String(d.error) : d.message ? String(d.message) : JSON.stringify(data);
      } else {
        body = String(data ?? '');
      }

      return [
        `HTTP ${status}`,
        reqUrl ? `URL: ${reqUrl}` : '',
        body ? `Resposta: ${body}` : '',
        e.message ? String(e.message) : '',
      ].filter(Boolean).join('\n');
    }

    if (e.request) {
      return `Sem resposta do servidor (timeout ou rede indisponível)\n${e.message ?? ''}`;
    }

    if (e.message) {
      return String(e.message);
    }

    try { return JSON.stringify(err); } catch { return String(err); }
  }

  return String(err);
}

/** Extrai apenas o stack trace (quando disponível). */
function extractStack(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  return typeof e.stack === 'string' ? e.stack : undefined;
}

/**
 * Envia o log de erro para a API (fire-and-forget).
 * Não bloqueia a execução — falhas silenciosas são ignoradas.
 * Retorna o ID gerado (para linkar no toast).
 */
export function logError(
  friendlyMessage: string,
  err: unknown,
  context?: string,
): string {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const technical = extractTechnical(err);
  const stackTrace = extractStack(err);
  const url = window.location.pathname;

  // Fire-and-forget: não aguarda nem propaga erros
  const payload = {
    id,
    timestamp,
    friendlyMessage,
    technical,
    stackTrace,
    url,
    context,
  };

  // Fire-and-forget — falhas silenciosas (usuário deslogado, rede indisponível, etc.)
  api.post('/tenant/logs/errors', payload).catch(() => {/* silencioso */});

  return id;
}

/** Busca a lista de logs do servidor. */
export async function fetchErrorLog(): Promise<ErrorLogEntry[]> {
  const res = await api.get('/tenant/logs/errors');
  return res.data.errors ?? [];
}

/** Busca um log específico pelo ID. */
export async function fetchErrorById(id: string): Promise<ErrorLogEntry | null> {
  try {
    const res = await api.get(`/tenant/logs/errors/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

/** Remove todos os logs do tenant. */
export async function clearErrorLog(): Promise<void> {
  await api.delete('/tenant/logs/errors');
}
