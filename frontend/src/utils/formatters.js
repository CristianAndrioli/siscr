/**
 * Utilitários para formatação de dados
 */

/**
 * Formata valor como moeda brasileira (R$)
 * @param {number|string} value - Valor a formatar
 * @returns {string} - Valor formatado (ex: R$ 1.234,56)
 */
export function formatCurrency(value) {
  if (!value && value !== 0) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Formata CPF (000.000.000-00)
 * @param {string} cpf - CPF sem formatação
 * @returns {string} - CPF formatado
 */
export function formatCPF(cpf) {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 * @param {string} cnpj - CNPJ sem formatação
 * @returns {string} - CNPJ formatado
 */
export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF ou CNPJ automaticamente
 * @param {string} value - CPF ou CNPJ
 * @returns {string} - Valor formatado
 */
export function formatCPFCNPJ(value) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return formatCPF(value);
  if (cleaned.length === 14) return formatCNPJ(value);
  return value;
}

/**
 * Formata CEP (00000-000)
 * @param {string} cep - CEP sem formatação
 * @returns {string} - CEP formatado
 */
export function formatCEP(cep) {
  if (!cep) return '';
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return cep;
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Formata telefone ((00) 00000-0000)
 * @param {string} phone - Telefone sem formatação
 * @returns {string} - Telefone formatado
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formata data (DD/MM/YYYY)
 * @param {string|Date} date - Data a formatar
 * @returns {string} - Data formatada
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata datetime (DD/MM/YYYY HH:mm)
 * @param {string|Date} datetime - Data e hora a formatar
 * @returns {string} - Data e hora formatada
 */
export function formatDateTime(datetime) {
  if (!datetime) return '';
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

