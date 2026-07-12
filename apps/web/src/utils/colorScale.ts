/**
 * Deriva uma escala de cores (estilo Tailwind, 50–950) e os tokens de
 * acento (tint/accLight/accDeep) a partir de um único hex escolhido
 * pelo usuário em Personalização. Consumido por `useUserPreferences`
 * para popular custom properties (`--brand-*`, `--tint-rgb`, etc.)
 * que o `tailwind.config.js` referencia via `rgb(var(--brand-600) / <alpha-value>)`.
 */

export interface Rgb { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d) % 6; break
      case gn: h = (bn - rn) / d + 2; break
      default: h = (rn - gn) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rp = 0, gp = 0, bp = 0
  if (h < 60) { rp = c; gp = x } else if (h < 120) { rp = x; gp = c }
  else if (h < 180) { gp = c; bp = x } else if (h < 240) { gp = x; bp = c }
  else if (h < 300) { rp = x; bp = c } else { rp = c; bp = x }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))

/** Alvos de luminosidade (0–1) por step — modelado na curva do Tailwind. */
const LIGHTNESS_TARGETS: Record<number, number> = {
  50: 0.97, 100: 0.94, 200: 0.87, 300: 0.77, 400: 0.66,
  500: 0.55, 600: 0.45, 700: 0.37, 800: 0.30, 900: 0.24, 950: 0.15,
}

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** Gera as 11 variações (50–950) a partir do hex escolhido pelo usuário. */
export function generateScale(hex: string): Record<number, Rgb> {
  const { h, s } = rgbToHsl(hexToRgb(hex))
  const scale: Record<number, Rgb> = {}
  for (const step of SCALE_STEPS) {
    scale[step] = hslToRgb(h, s, LIGHTNESS_TARGETS[step])
  }
  return scale
}

export function rgbTriple({ r, g, b }: Rgb): string {
  return `${r} ${g} ${b}`
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Tokens derivados do acento (fórmula do handoff de redesign):
 * - accLight: acento +60 por canal — texto ativo em fundo escuro.
 * - accDeep: acento ×0.6 — ponta escura do gradiente do avatar.
 */
export function deriveAccentTokens(hex: string) {
  const base = hexToRgb(hex)
  const accLight: Rgb = { r: clamp(base.r + 60), g: clamp(base.g + 60), b: clamp(base.b + 60) }
  const accDeep: Rgb = { r: clamp(base.r * 0.6), g: clamp(base.g * 0.6), b: clamp(base.b * 0.6) }
  return {
    baseRgb: rgbTriple(base),
    accLightHex: rgbToHex(accLight),
    accDeepHex: rgbToHex(accDeep),
  }
}
