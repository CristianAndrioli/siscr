/**
 * Funções auxiliares diversas
 */

/**
 * Debounce - executa função após delay
 * @param {function} func - Função a executar
 * @param {number} delay - Delay em milissegundos
 * @returns {function} - Função com debounce
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Remove caracteres especiais (mantém apenas números)
 * @param {string} value - Valor a limpar
 * @returns {string} - Valor limpo
 */
export function removeSpecialChars(value) {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Capitaliza primeira letra de cada palavra
 * @param {string} str - String a capitalizar
 * @returns {string} - String capitalizada
 */
export function capitalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Trunca string com ellipsis
 * @param {string} str - String a truncar
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} - String truncada
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Verifica se objeto está vazio
 * @param {object} obj - Objeto a verificar
 * @returns {boolean} - True se vazio
 */
export function isEmpty(obj) {
  if (!obj) return true;
  if (typeof obj !== 'object') return false;
  return Object.keys(obj).length === 0;
}

/**
 * Copia texto para clipboard
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} - True se sucesso
 */
export async function copyToClipboard(text) {
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
 * @param {object} error - Erro da API
 * @returns {string} - Mensagem de erro formatada
 */
export function formatApiError(error) {
  if (!error) return 'Erro desconhecido';
  
  if (error.response) {
    // Erro da API
    const data = error.response.data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (typeof data === 'string') return data;
    if (data.non_field_errors) return data.non_field_errors[0];
    
    // Erros de campo
    const fieldErrors = Object.values(data).flat();
    if (fieldErrors.length > 0) return fieldErrors[0];
  }
  
  if (error.message) return error.message;
  return 'Erro ao processar requisição';
}

