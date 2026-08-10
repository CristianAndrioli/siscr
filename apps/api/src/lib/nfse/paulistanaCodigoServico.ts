import { onlyDigits } from '../nfe/xmlEscape'

/**
 * Código de serviço na Nota Fiscal Paulistana = código municipal (4–5 dígitos),
 * NÃO o item da LC 116 (ex.: 01.01). `onlyDigits("01.01")` vira "0101" → "00101"
 * e a Prefeitura rejeita com 306 ("Código de Serviço informado (101) inexistente").
 */
const LC116_RE = /^\d{1,2}\.\d{2}$/

export function looksLikeLc116Item(raw: string): boolean {
  const t = raw.trim()
  if (LC116_RE.test(t)) return true
  // Variantes comuns: "1.01", "01.01 ", "0101" com ponto omitido curto demais
  if (/^\d{1,2}\.\d{1,2}$/.test(t)) return true
  return false
}

export type PaulistanaCodigoServicoResult =
  | { ok: true; codigo: string }
  | { ok: false; message: string }

/**
 * Normaliza e valida código municipal Paulistana (sempre 5 dígitos no XML).
 */
export function normalizePaulistanaCodigoServico(raw: string): PaulistanaCodigoServicoResult {
  const t = String(raw ?? '').trim()
  if (!t) {
    return {
      ok: false,
      message:
        'Código de serviço municipal obrigatório para NFS-e Paulistana (4–5 dígitos da lista da Prefeitura de SP). Configure em Configurações → NFS-e ou na nota. Não use item da LC 116 (ex.: 01.01).',
    }
  }
  if (looksLikeLc116Item(t)) {
    return {
      ok: false,
      message: `Código "${t}" parece item da LC 116. Na Paulistana use o código municipal de 4–5 dígitos (ex.: 02800 para licenciamento de software), não 01.01.`,
    }
  }
  const digits = onlyDigits(t)
  if (digits.length < 4 || digits.length > 5) {
    return {
      ok: false,
      message: `Código de serviço municipal inválido ("${t}"). Informe 4 ou 5 dígitos da lista da Nota Fiscal Paulistana.`,
    }
  }
  const padded = digits.padStart(5, '0').slice(-5)
  // Conversões clássicas de LC 116 → rejeição 306 (ex.: 01.01 / 0101 → 00101 → Prefeitura lê 101).
  const lc116Ghost = new Set(['00101', '00102', '00103', '00104', '00105', '01001'])
  if (lc116Ghost.has(padded)) {
    return {
      ok: false,
      message: `Código "${t}" (normalizado ${padded}) parece conversão de LC 116, não código municipal SP. Consulte o CCM / lista da Prefeitura (ex.: 02800) e configure o padrão em Configurações → NFS-e.`,
    }
  }
  return { ok: true, codigo: padded }
}
