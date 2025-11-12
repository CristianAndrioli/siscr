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
 * Formata erro da API para exibição
 */
export function formatApiError(error: unknown): string {
  if (!error) return 'Erro desconhecido';
  
  if (typeof error === 'object' && 'response' in error) {
    // Erro da API (Axios)
    const axiosError = error as { response?: { data?: unknown } };
    const data = axiosError.response?.data;
    
    if (data && typeof data === 'object') {
      if ('detail' in data && typeof data.detail === 'string') return data.detail;
      if ('message' in data && typeof data.message === 'string') return data.message;
      if ('non_field_errors' in data && Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        return String(data.non_field_errors[0]);
      }
      
      // Erros de campo
      const fieldErrors = Object.values(data).flat();
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        return String(fieldErrors[0]);
      }
    }
    
    if (typeof data === 'string') return data;
  }
  
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  
  return 'Erro ao processar requisição';
}

