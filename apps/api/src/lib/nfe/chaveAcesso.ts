/**
 * DV da chave NF-e (módulo 11, pesos 2–9 da direita para a esquerda).
 * @param chave43 primeiros 43 dígitos (sem o DV)
 */
export function calcularDvNFe(chave43: string): string {
  if (!/^\d{43}$/.test(chave43)) {
    throw new Error('Chave sem DV deve ter exatamente 43 dígitos.')
  }
  let mult = 2
  let sum = 0
  for (let i = chave43.length - 1; i >= 0; i--) {
    sum += parseInt(chave43[i]!, 10) * mult
    mult = mult === 9 ? 2 : mult + 1
  }
  const mod = sum % 11
  const dv = mod === 0 || mod === 1 ? 0 : 11 - mod
  return String(dv)
}

/** Gera código numérico aleatório de 8 dígitos (cNF). */
export function randomCnf8(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 100_000_000
  return String(n).padStart(8, '0')
}

export type ChaveNFeParams = {
  cUF: string
  /** AAMM ex.: 2504 para abr/2025 */
  aamm: string
  cnpj14: string
  mod: string
  serie: string
  nNF: string
  tpEmis: string
  cNF8: string
}

/** Monta os 43 dígitos base + DV = chave 44 caracteres. */
export function montarChaveAcesso(p: ChaveNFeParams): string {
  const cnpj = p.cnpj14.replace(/\D/g, '').padStart(14, '0').slice(0, 14)
  const mod = p.mod.replace(/\D/g, '').padStart(2, '0').slice(-2)
  const serie = p.serie.replace(/\D/g, '').padStart(3, '0').slice(-3)
  const n = Math.min(999_999_999, Math.max(0, parseInt(String(p.nNF).replace(/\D/g, '') || '0', 10)))
  const nNF = String(n).padStart(9, '0')
  const tpEmis = (p.tpEmis || '1').slice(0, 1)
  const cNF = p.cNF8.replace(/\D/g, '').padStart(8, '0').slice(-8)
  const cUF = p.cUF.replace(/\D/g, '').padStart(2, '0').slice(-2)
  const aamm = p.aamm.replace(/\D/g, '').padStart(4, '0').slice(-4)

  const base43 = `${cUF}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  if (base43.length !== 43) {
    throw new Error(`Chave base inválida (${base43.length} dígitos).`)
  }
  return base43 + calcularDvNFe(base43)
}
