import { onlyDigits } from './xmlEscape'

/** idDest da NF-e (ide): 1 interna · 2 interestadual · 3 exterior */
export type IdDest = '1' | '2' | '3'

export function normalizeUf(uf: string | null | undefined): string {
  return (uf ?? '').trim().toUpperCase()
}

/**
 * Destino da operação a partir das UFs (e país) — mesma regra dos ERPs fiscais BR:
 * exterior se país ≠ Brasil (1058) ou UF EX; senão compara UF emitente × destinatário.
 */
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

/** 1º dígito do CFOP de saída conforme idDest (5 / 6 / 7). */
export function digitoCfopSaida(idDest: IdDest): '5' | '6' | '7' {
  if (idDest === '2') return '6'
  if (idDest === '3') return '7'
  return '5'
}

/**
 * Ajusta CFOP de saída para o destino: preserva os 3 últimos dígitos (tipo da operação)
 * e corrige o 1º (5 interno · 6 interestadual · 7 exterior).
 * CFOPs de entrada (1/2/3xxx) viram a família de saída correspondente.
 */
export function ajustarCfopSaida(
  cfop: string | null | undefined,
  idDest: IdDest,
  fallback = '5102',
): string {
  const raw = onlyDigits(cfop || '', 4)
  const base =
    raw.length === 4 ? raw.padStart(4, '0') : onlyDigits(fallback, 4).padStart(4, '0').slice(0, 4)
  const suffix = base.slice(1)
  return `${digitoCfopSaida(idDest)}${suffix}`
}

/** CFOP padrão de venda de mercadoria para o destino. */
export function cfopPadraoSaida(idDest: IdDest): string {
  return `${digitoCfopSaida(idDest)}102`
}

/**
 * Sugere natureza da operação quando o texto ainda é genérico ("Venda" / "Venda de mercadorias").
 * Naturezas customizadas são preservadas.
 */
export function naturezaOperacaoParaDestino(
  idDest: IdDest,
  atual?: string | null,
): string {
  const a = (atual ?? '').trim()
  const generica = !a || /^venda(\s+de\s+mercadorias)?$/i.test(a)
  if (!generica) return a
  if (idDest === '2') return 'Venda interestadual de mercadorias'
  if (idDest === '3') return 'Exportação de mercadorias'
  return a || 'Venda de mercadorias'
}

export function rotuloIdDest(idDest: IdDest): string {
  if (idDest === '2') return 'interestadual'
  if (idDest === '3') return 'com o exterior'
  return 'interna'
}
