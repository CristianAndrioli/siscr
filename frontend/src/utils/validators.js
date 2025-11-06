/**
 * Utilitários para validação de dados
 */

/**
 * Valida CPF
 * @param {string} cpf - CPF a validar
 * @returns {boolean} - True se válido
 */
export function validateCPF(cpf) {
  if (!cpf) return false;
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Todos os dígitos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Valida CNPJ
 * @param {string} cnpj - CNPJ a validar
 * @returns {boolean} - True se válido
 */
export function validateCNPJ(cnpj) {
  if (!cnpj) return false;
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false; // Todos os dígitos iguais

  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ
 * @param {string} value - CPF ou CNPJ
 * @returns {boolean} - True se válido
 */
export function validateCPFCNPJ(value) {
  if (!value) return false;
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return validateCPF(value);
  if (cleaned.length === 14) return validateCNPJ(value);
  return false;
}

/**
 * Valida email
 * @param {string} email - Email a validar
 * @returns {boolean} - True se válido
 */
export function validateEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida CEP
 * @param {string} cep - CEP a validar
 * @returns {boolean} - True se válido
 */
export function validateCEP(cep) {
  if (!cep) return false;
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Valida telefone
 * @param {string} phone - Telefone a validar
 * @returns {boolean} - True se válido
 */
export function validatePhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Valida se campo é obrigatório
 * @param {any} value - Valor a validar
 * @returns {boolean} - True se válido (não vazio)
 */
export function validateRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Valida tamanho mínimo
 * @param {string} value - Valor a validar
 * @param {number} min - Tamanho mínimo
 * @returns {boolean} - True se válido
 */
export function validateMinLength(value, min) {
  if (!value) return false;
  return value.length >= min;
}

/**
 * Valida tamanho máximo
 * @param {string} value - Valor a validar
 * @param {number} max - Tamanho máximo
 * @returns {boolean} - True se válido
 */
export function validateMaxLength(value, max) {
  if (!value) return true; // Não requerido
  return value.length <= max;
}

