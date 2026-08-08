/**
 * Escopo operacional dentro de um tenant (banco único no Cloudflare).
 *
 * Isolamento em duas camadas
 * -----------------------------------------------------------------
 * 1) `tenant_id` — cliente/conta. Nenhum dado de um tenant vaza para outro.
 * 2) `empresa_id` (+ `filial_id` opcional) — dentro do tenant, cada
 *    documento pertence a uma empresa. Sem filial = matriz.
 *
 * Toda tabela operacional nova (pedidos, notas, cotações, estoque,
 * financeiro…) DEVE ter estes campos. Cadastros auxiliares globais do
 * tenant (ex.: NCM) são a exceção.
 *
 * No repositório: herde `BaseTenantRepository` e filtre sempre por
 * `tenant_id`. Quando a tabela tiver empresa, filtre também por
 * `empresa_id` nas listagens; trate `filial_id` nulo como matriz.
 */

export type EscopoEmpresaFilial = {
  empresaId: string
  /** `null` / omitido = matriz. */
  filialId?: string | null
}

/** Converte string vazia / undefined em `null` (matriz). */
export function filialOuMatriz(filialId: string | null | undefined): string | null {
  if (filialId === undefined || filialId === null || filialId === '') return null
  return filialId
}
