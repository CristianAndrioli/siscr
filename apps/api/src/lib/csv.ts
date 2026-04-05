export function csvCell(v: unknown): string {
  const t = v === null || v === undefined ? '' : String(v)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [
    columns.join(','),
    ...rows.map((r) => columns.map((h) => csvCell(r[h])).join(',')),
  ]
  return lines.join('\r\n')
}

export function csvAttachment(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
