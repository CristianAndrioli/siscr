/**
 * Funções auxiliares diversas
 */

/**
 * Debounce - executa função após delay
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: unknown, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Remove caracteres especiais (mantém apenas números)
 */
export function removeSpecialChars(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Trunca string com ellipsis
 */
export function truncate(str: string | null | undefined, maxLength = 50): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Verifica se objeto está vazio
 */
export function isEmpty(obj: unknown): boolean {
  if (!obj) return true;
  if (typeof obj !== 'object') return false;
  return Object.keys(obj).length === 0;
}

/**
 * Copia texto para clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Erro ao copiar:', err);
    return false;
  }
}

/**
 * Extrai uma mensagem de erro amigável de uma exceção qualquer.
 *
 * Ordem de precedência
 * -----------------------------------------------------------------
 *   1) response.data.error           ← formato do backend SISCR (Hono)
 *   2) response.data.detail          ← formato DRF-like
 *   3) response.data.message
 *   4) response.data.non_field_errors[0]
 *   5) primeiro valor de campo em response.data (erros de validação)
 *   6) response.data quando string
 *   7) error.message (Error nativo)
 *   8) fallback fornecido (ou 'Erro ao processar requisição')
 *
 * Sempre retorna uma string exibível — nunca `undefined` — para que
 * o caller possa fazer `setError(formatApiError(err, 'Erro ao salvar.'))`
 * sem precisar de lógica extra.
 */
export function formatApiError(error: unknown, fallback = 'Erro ao processar requisição'): string {
  if (!error) return fallback;

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response?: { data?: unknown } };
    const data = axiosError.response?.data;

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.error === 'string') return record.error;
      if (typeof record.detail === 'string') return record.detail;
      if (typeof record.message === 'string') return record.message;

      const nonField = record.non_field_errors;
      if (Array.isArray(nonField) && nonField.length > 0) {
        return String(nonField[0]);
      }

      // Erros de campo (ex.: Zod flatten ou DRF): pega o primeiro disponível.
      const fieldErrors = Object.values(record).flat();
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0 && fieldErrors[0]) {
        return String(fieldErrors[0]);
      }
    }

    if (typeof data === 'string') return data;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

