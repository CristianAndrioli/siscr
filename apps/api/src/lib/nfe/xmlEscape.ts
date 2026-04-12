export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function onlyDigits(s: string, maxLen?: number): string {
  const d = s.replace(/\D/g, '')
  return maxLen != null ? d.slice(0, maxLen) : d
}
