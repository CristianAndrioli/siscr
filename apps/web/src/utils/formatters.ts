/**
 * Utilitários de formatação (BR).
 *
 * Fonte canônica
 * -----------------------------------------------------------------
 * Este arquivo é a ÚNICA fonte de formatação pt-BR no frontend.
 * O arquivo `utils/format.ts` existia historicamente com as mesmas
 * funções sob nomes diferentes (`fmtBRL`, `fmtDate`); hoje ele apenas
 * reexporta daqui para manter compatibilidade retroativa — código
 * novo deve importar daqui direto (ou via barrel `utils/index`).
 *
 * Convenções
 * -----------------------------------------------------------------
 * - `formatCurrency(v)` → "R$ 1.234,56" (2 casas). `null/undefined` → "R$ 0,00".
 * - `fmtBRL(v)` (alias tolerante) → idem, mas "R$ 0,00" para `null`; usado
 *   extensivamente nas páginas de faturamento/financeiro.
 * - `formatDate(v)` → usa `Date` nativo; aceita `Date|string|null`.
 *   Para datas ISO YYYY-MM-DD já puras, `fmtDateISO` é preferível
 *   pois evita o bug de fuso horário do `new Date('2025-01-15')`
 *   (que interpreta como UTC 00:00 e exibe 14/01 em fusos -03:00).
 * - `fmtDateISO(v)` → slicing simples da string ISO, retorna `—` para null.
 * - Funções de máscara (`formatCPF`, `formatCNPJ`, `formatCEP`,
 *   `formatPhone`) suportam digitação incremental para uso em
 *   `onChange` de inputs.
 */

// ─── Moeda ─────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formata valor como moeda BRL (R$ 1.234,56).
 *
 * Aceita número, string numérica ou `null/undefined`. Strings não
 * parseáveis viram zero. Retorno sempre tem 2 casas decimais.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return BRL.format(isNaN(numValue) ? 0 : numValue);
}

/**
 * Alias curto histórico de `formatCurrency`, mantido para não quebrar
 * as páginas existentes. Preferir `formatCurrency` em código novo.
 */
export function fmtBRL(v: number | null | undefined): string {
  return BRL.format(v ?? 0);
}

// ─── Data / Hora ───────────────────────────────────────────────────

/**
 * Formata ISO "YYYY-MM-DD" (ou string ISO completa) para "dd/mm/aaaa".
 *
 * IMPORTANTE: esta função faz slicing textual — NÃO usa `new Date()`
 * — portanto é imune a drift de fuso horário para datas puras.
 * Retorna `"—"` para `null/undefined/empty` (placeholder visual).
 */
export function fmtDateISO(s?: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

/**
 * Alias histórico de `fmtDateISO` usado em páginas de faturamento/
 * financeiro. Preferir `fmtDateISO` em código novo por ser o nome
 * que descreve o comportamento real (slicing ISO, sem fuso).
 */
export const fmtDate = fmtDateISO;

/**
 * Formata data usando Date nativo (toLocaleDateString 'pt-BR').
 *
 * Aceita `Date | string | null`. Retorna string vazia para `null`
 * (comportamento diferente de `fmtDateISO`, que retorna "—").
 *
 * ATENÇÃO: ao passar uma string ISO "YYYY-MM-DD" pura, o `Date`
 * nativo interpreta como UTC 00:00, podendo exibir o dia anterior
 * em fusos ocidentais. Para datas puras, preferir `fmtDateISO`.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata datetime (dd/mm/aaaa HH:mm:ss) via `toLocaleString('pt-BR')`.
 */
export function formatDateTime(datetime: string | Date | null | undefined): string {
  if (!datetime) return '';
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

// ─── Documentos ────────────────────────────────────────────────────

/**
 * Formata CPF (000.000.000-00). Suporta digitação incremental —
 * pode ser chamado em `onChange` de input.
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1.$2');
  if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ (00.000.000/0000-00). Suporta digitação incremental.
 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const d = cnpj.replace(/\D/g, '').slice(0, 14);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, '$1.$2');
  if (d.length <= 8) return d.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (d.length <= 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
}

/**
 * Decide CPF vs CNPJ pelo comprimento (≤11 → CPF, >11 → CNPJ).
 * Útil em campos genéricos tipo "Documento".
 */
export function formatCPFCNPJ(value: string | null | undefined): string {
  if (!value) return '';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.length <= 11 ? formatCPF(cleaned) : formatCNPJ(cleaned);
}

// ─── Endereço / contato ────────────────────────────────────────────

/**
 * Formata CEP (00000-000). Suporta digitação incremental.
 */
export function formatCEP(cep: string | null | undefined): string {
  if (!cep) return '';
  const cleaned = String(cep).replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 5) return cleaned;
  return cleaned.replace(/(\d{5})(\d+)/, '$1-$2');
}

/**
 * Formata telefone brasileiro: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX (celular).
 * Suporta digitação incremental.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return `(${cleaned}`;
  if (cleaned.length <= 6) return cleaned.replace(/(\d{2})(\d+)/, '($1) $2');
  if (cleaned.length <= 10) return cleaned.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  // 11 dígitos (celular com 9)
  return cleaned.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
}
