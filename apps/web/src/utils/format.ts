const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata número como moeda BRL. Sempre exibe 2 casas decimais. */
export function fmtBRL(v: number | null | undefined): string {
  return BRL.format(v ?? 0);
}

/** Formata data ISO (YYYY-MM-DD) para dd/mm/aaaa. */
export function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
