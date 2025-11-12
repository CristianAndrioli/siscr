/**
 * Utilitários para validação de dados
 */

/**
 * Valida CPF
 */
export function validateCPF(cpf: string | null | undefined): boolean {
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
 */
export function validateCNPJ(cnpj: string | null | undefined): boolean {
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
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function validateCPFCNPJ(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return validateCPF(value);
  if (cleaned.length === 14) return validateCNPJ(value);
  return false;
}

/**
 * Valida email
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida CEP
 */
export function validateCEP(cep: string | null | undefined): boolean {
  if (!cep) return false;
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Valida telefone
 */
export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Valida se campo é obrigatório
 */
export function validateRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Valida tamanho mínimo
 */
export function validateMinLength(value: string | null | undefined, min: number): boolean {
  if (!value) return false;
  return value.length >= min;
}

/**
 * Valida tamanho máximo
 */
export function validateMaxLength(value: string | null | undefined, max: number): boolean {
  if (!value) return true; // Não requerido
  return value.length <= max;
}

