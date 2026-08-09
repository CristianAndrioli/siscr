/**
 * Espelho da regra fiscal de idDest/CFOP usada na API (prepareNfeEnvio).
 * Mantido no frontend para sugerir CFOP no assistente como ERPs fazem.
 */

export type IdDest = '1' | '2' | '3'

function onlyDigits(v: string, max?: number): string {
  const d = v.replace(/\D/g, '')
  return max != null ? d.slice(0, max) : d
}

export function normalizeUf(uf: string | null | undefined): string {
  return (uf ?? '').trim().toUpperCase()
}

export function resolveIdDest(params: {
  ufEmitente: string | null | undefined
  ufDestinatario: string | null | undefined
  codigoPaisDestinatario?: string | null
}): IdDest {
  const pais = onlyDigits(params.codigoPaisDestinatario ?? '1058', 4) || '1058'
  const ufDest = normalizeUf(params.ufDestinatario)
  if (pais !== '1058' || ufDest === 'EX') return '3'
  const ufEmit = normalizeUf(params.ufEmitente)
  if (!ufEmit || !ufDest) return '1'
  return ufEmit === ufDest ? '1' : '2'
}

export function digitoCfopSaida(idDest: IdDest): '5' | '6' | '7' {
  if (idDest === '2') return '6'
  if (idDest === '3') return '7'
  return '5'
}

export function ajustarCfopSaida(
  cfop: string | null | undefined,
  idDest: IdDest,
  fallback = '5102',
): string {
  const raw = onlyDigits(cfop || '', 4)
  const base =
    raw.length === 4 ? raw.padStart(4, '0') : onlyDigits(fallback, 4).padStart(4, '0').slice(0, 4)
  return `${digitoCfopSaida(idDest)}${base.slice(1)}`
}

export function cfopPadraoSaida(idDest: IdDest): string {
  return `${digitoCfopSaida(idDest)}102`
}

export function rotuloIdDest(idDest: IdDest): string {
  if (idDest === '2') return 'interestadual'
  if (idDest === '3') return 'com o exterior'
  return 'interna (mesma UF)'
}
