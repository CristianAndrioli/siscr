/**
 * ⚠️ Módulo de compatibilidade — código novo deve importar de
 * `./formatters` (ou do barrel `./`).
 *
 * Histórico
 * -----------------------------------------------------------------
 * Havia duas implementações paralelas de formatadores no frontend:
 *
 *   - `utils/format.ts`     → `fmtBRL`, `fmtDate`
 *   - `utils/formatters.ts` → `formatCurrency`, `formatDate`,
 *                             `formatCPF`, `formatCNPJ`, ...
 *
 * A implementação foi consolidada em `utils/formatters.ts`. Este
 * arquivo permanece apenas como re-export para que os ~19 imports
 * existentes de `'../utils/format'` continuem compilando. Em uma
 * próxima iteração, migrar os callers e remover este arquivo.
 */
export { fmtBRL, fmtDate, fmtDateISO } from './formatters';
