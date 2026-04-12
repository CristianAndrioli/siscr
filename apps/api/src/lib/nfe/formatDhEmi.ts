/** dhEmi NF-e no fuso America/Sao_Paulo (aprox. -03:00; sem DST fino). */
export function formatDhEmiSp(date: Date = new Date()): string {
  const s = date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T')
  return `${s}-03:00`
}
