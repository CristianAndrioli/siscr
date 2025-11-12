/**
 * Utilitários para formatação de dados
 */

/**
 * Formata valor como moeda brasileira (R$)
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (!value && value !== 0) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Formata CPF (000.000.000-00)
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF ou CNPJ automaticamente
 */
export function formatCPFCNPJ(value: string | null | undefined): string {
  if (!value || value === '') return '';
  const cleaned = String(value).replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  
  // Permite digitação incremental - formata conforme o usuário digita
  if (cleaned.length <= 11) {
    // Formata como CPF durante a digitação
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return cleaned.replace(/(\d{3})(\d+)/, '$1.$2');
    } else if (cleaned.length <= 9) {
      return cleaned.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    } else {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
    }
  } else {
    // Formata como CNPJ durante a digitação
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 5) {
      return cleaned.replace(/(\d{2})(\d+)/, '$1.$2');
    } else if (cleaned.length <= 8) {
      return cleaned.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    } else if (cleaned.length <= 12) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    } else {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
    }
  }
}

/**
 * Formata CEP (00000-000)
 */
export function formatCEP(cep: string | null | undefined): string {
  if (!cep || cep === '') return '';
  const cleaned = String(cep).replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  // Permite digitação incremental
  if (cleaned.length <= 5) {
    return cleaned;
  } else {
    return cleaned.replace(/(\d{5})(\d+)/, '$1-$2');
  }
}

/**
 * Formata telefone ((00) 00000-0000)
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone || phone === '') return '';
  const cleaned = String(phone).replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  
  // Permite digitação incremental
  if (cleaned.length <= 2) {
    return `(${cleaned}`;
  } else if (cleaned.length <= 6) {
    return cleaned.replace(/(\d{2})(\d+)/, '($1) $2');
  } else if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  } else {
    // 11 dígitos (celular com 9)
    return cleaned.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  }
}

/**
 * Formata data (DD/MM/YYYY)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata datetime (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(datetime: string | Date | null | undefined): string {
  if (!datetime) return '';
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

