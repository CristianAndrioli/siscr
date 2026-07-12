/** Exportação client-side simples (CSV) para as ações "Exportar" das listagens. */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => unknown;
}

/** Deriva CsvColumn[] a partir das colunas do SmartGrid (ignora `render`, usa o valor bruto). */
export function smartColumnsToCsv<T extends object>(columns: { key: string; label: string }[]): CsvColumn<T>[] {
  return columns.map(c => ({
    label: c.label,
    value: (row: T) => (row as Record<string, unknown>)[c.key],
  }));
}

export function exportRowsToCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const header = columns.map(c => csvEscape(c.label)).join(';');
  const lines = rows.map(row => columns.map(c => csvEscape(c.value(row))).join(';'));
  const csv = '﻿' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
